import "babel-polyfill";
import React from "react";
import ReactDOM from "react-dom";

import ConnectionWindow from "./ConnectionWindow.jsx";
import Sidebar from "./Sidebar.jsx";
import MainContainer from "./MainContainer.jsx";
import DragBarVert from "./DragBarVert.jsx";
import * as api from "./api.js";
import * as action from "./action.js";
import * as store from "./store.js";
import * as view from "./view.js";
import AlertContainer from "./alert/ReactAlert.jsx";

let g_alert = null;

function runOnLoad(f) {
  if (window.addEventListener) {
    window.addEventListener("DOMContentLoaded", f);
  } else {
    window.attachEvent("onload", f);
  }
}

if (window) {
  window.runOnLoad = runOnLoad;
}

function isCreateOrDropQuery(query) {
  return query.match(/(create|drop) table/i);
}

function isSelectQuery(query) {
  return query.match(/select/i);
}

// rows is [ [name, val], ...]
function databaseNameFromConnectionInfoRows(rows) {
  for (let row of rows) {
    if (row[0] == "current_database") {
      return row[1];
    }
  }
  return "";
}

class App extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.handleAlertBox = this.handleAlertBox.bind(this);
    this.handleDidConnect = this.handleDidConnect.bind(this);
    this.handleDisconnectDatabase = this.handleDisconnectDatabase.bind(this);
    this.handleExecuteQuery = this.handleExecuteQuery.bind(this);
    this.handleExplainQuery = this.handleExplainQuery.bind(this);
    this.handleTableSelected = this.handleTableSelected.bind(this);
    this.handleViewSelected = this.handleViewSelected.bind(this);
    this.handleResetPagination = this.handleResetPagination.bind(this);
    this.handleSelectedCellPosition = this.handleSelectedCellPosition.bind(
      this
    );
    this.handleEditedCells = this.handleEditedCells.bind(this);
    this.getAllTablesStructures = this.getAllTablesStructures.bind(this);
    this.getQueryAsyncStatus = this.getQueryAsyncStatus.bind(this);
    this.getQueryAsyncData = this.getQueryAsyncData.bind(this);
    this.handleQueryAsync = this.handleQueryAsync.bind(this);
    this.handleQuerySync = this.handleQuerySync.bind(this);

    this.alertOptions = {
      offset: 14,
      position: "bottom left",
      time: 7000,
      theme: "light", // Can be 'dark'
      transition: "scale",
    };

    this.state = {
      selectedView: view.SQLQuery,
      connectionId: gUserInfo ? gUserInfo.ConnectionID : 0,
      connected: gUserInfo ? gUserInfo.ConnectionID !== 0 : false,

      databaseName: "No Database Selected",

      queryIdInProgress: null,
      queryStatus: null,

      tables: null,
      tableStructures: {},
      selectedTable: "",
      selectedTableInfo: null,
      results: null,
      resetPagination: false,

      selectedCellPosition: {
        rowId: -1,
        colId: -1,
      },
      editedCells: {},

      capabilities: {},
    };
  }

  componentWillMount() {
    //this.adHocTest();

    action.onViewSelected(this.handleViewSelected, this);
    action.onTableSelected(this.handleTableSelected, this);
    action.onExecuteQuery(this.handleExecuteQuery, this);
    action.onExplainQuery(this.handleExplainQuery, this);
    action.onDisconnectDatabase(this.handleDisconnectDatabase, this);
    action.onAlertBox(this.handleAlertBox, this);
    action.onResetPagination(this.handleResetPagination, this);
    action.onSelectedCellPosition(this.handleSelectedCellPosition, this);
    action.onEditedCells(this.handleEditedCells, this);

    var connId = this.state.connectionId;
    if (connId == 0) {
      return;
    }

    this.getAllTablesStructures();

    api.getConnectionInfo(connId, data => {
      const dbName = databaseNameFromConnectionInfoRows(data.rows);
      this.setState({
        databaseName: dbName,
      });
    });
  }

  componentWillUnmount() {
    action.offAllForOwner(this);
  }

  getAllTablesStructures() {
    var connId = this.state.connectionId;
    api.getTables(connId, data => {
      console.log("getAllTablesStructures", data);

      let tableNames = [];
      let tableStructures = [];
      for (var key in data) {
        const table = data[key];
        const tableName = table["table_name"];
        tableNames.push(tableName);

        if (tableStructures[tableName] == undefined) {
          tableStructures[tableName] = [];
          tableStructures[tableName]["table_schema"] = table["table_schema"];
        }

        for (let key in table["columns"]) {
          tableStructures[tableName].push(table["columns"][key]);
        }
      }

      // console.log('tableNames ', tableNames);
      // console.log('tableStructures ', tableStructures);

      this.setState({
        tables: tableNames,
        tableStructures: tableStructures,
      });
    });
  }

  handleDidConnect(connectionStr, connectionId, databaseName, capabilities) {
    this.setState({
      connected: true,
      connectionId: connectionId,
      databaseName: databaseName,
      capabilities: capabilities,
    });

    this.getAllTablesStructures();
  }

  handleTableSelected(table) {
    console.log("handleTableSelected: ", table);

    this.setState({
      selectedTable: table,
    });

    // must delay otherwise this.state.selectedTable will not be visible yet
    // in handleViewSelected
    setTimeout(() => this.handleViewSelected(view.SQLQuery), 200);

    var connId = this.state.connectionId;
    api.getTableInfo(connId, table, data => {
      this.setState({
        selectedTableInfo: data,
      });
    });
  }

  getTableContent() {
    const table = this.state.selectedTable;
    const query = `SELECT * FROM ${table};`;
    this.handleExecuteQuery(query);
  }

  getTableStructure() {
    var connId = this.state.connectionId;
    var selectedTable = this.state.selectedTable;
    api.getTableStructure(connId, selectedTable, data => {
      console.log("getTableStructure: ", data);
      this.setState({
        results: data,
        selectedCellPosition: {
          rowId: -1,
          colId: -1,
        },
        editedCells: {},
      });
    });
  }

  getTableIndexes() {
    var connId = this.state.connectionId;
    var selectedTable = this.state.selectedTable;
    api.getTableIndexes(connId, selectedTable, data => {
      console.log("getTableIndexes: ", data);
      this.setState({
        results: data,
        selectedCellPosition: {
          rowId: -1,
          colId: -1,
        },
        editedCells: {},
      });
    });
  }

  getHistory() {
    var connId = this.state.connectionId;
    api.getHistory(connId, data => {
      console.log("getHistory: ", data);
      this.setState({
        results: data,
        selectedCellPosition: {
          rowId: -1,
          colId: -1,
        },
        editedCells: {},
      });
    });
  }

  handleViewSelected(viewName) {
    console.log("handleViewSelected: ", viewName);
    this.setState({
      selectedView: viewName,
    });

    if (this.state.connectionId === 0) {
      console.log(
        "handleViewSelected: not connected, connectionId: ",
        this.state.connectionId
      );
      return;
    }

    // those don't require table being selected
    switch (viewName) {
      case view.History:
        this.getHistory();
        break;
    }

    if (this.state.selectedTable === "") {
      //console.log("handleViewSelected: no selectedTable");
      return;
    }

    switch (viewName) {
      case view.SQLQuery:
        if (this.state.selectedTable == "") {
          this.setState({
            results: null,
          });
        } else {
          this.getTableContent();
        }
        return;
      case view.Structure:
        this.getTableStructure();
        break;
      case view.Indexes:
        this.getTableIndexes();
        break;
      default:
        console.log("handleViewSelected: unknown view: ", viewName);
    }
  }

  handleQuerySync(query) {
    console.log("handleQuerySync", query);
    var connId = this.state.connectionId;
    api.executeQuery(connId, query, data => {
      this.setState({
        results: data,
        resetPagination: true,
        selectedCellPosition: {
          rowId: -1,
          colId: -1,
        },
        editedCells: {},
      });

      // refresh tables list if table was added or removed
      if (!isCreateOrDropQuery(query)) {
        return;
      }
      this.getAllTablesStructures();
    });
  }

  getQueryAsyncData() {
    const queryId = this.state.queryIdInProgress;
    console.log(`getQueryAsyncData: queryId=${queryId}`);
    if (queryId == "") {
      console.log("no async query in progress");
      return;
    }
    const count = this.state.queryStatus.rows_count;
    if (count == 0) {
      this.setState({
        results: null,
        resetPagination: true,
        selectedCellPosition: {
          rowId: -1,
          colId: -1,
        },
        editedCells: {},
      });
      return;
    }
    const connId = this.state.connectionId;
    const start = 0;
    const columns = this.state.queryStatus.columns;
    api.queryAsyncData(connId, queryId, start, count, data => {
      const results = {
        columns: columns,
        rows: data.rows,
      };
      this.setState({
        results: results,
        resetPagination: true,
        selectedCellPosition: {
          rowId: -1,
          colId: -1,
        },
        editedCells: {},
      });
    });
  }

  getQueryAsyncStatus() {
    const queryId = this.state.queryIdInProgress;
    console.log(`getQueryAsyncStatus: queryId=${queryId}`);
    if (queryId == "") {
      console.log("no async query in progress");
      return;
    }
    const connId = this.state.connectionId;
    api.queryAsyncStatus(connId, queryId, data => {
      const queryStatus = data;
      this.setState({
        queryStatus: queryStatus,
      });
      // repeat until async query finishes
      if (!queryStatus.finished) {
        setTimeout(this.getQueryAsyncStatus, 1000);
      } else {
        this.getQueryAsyncData();
        store.spinnerHide();
      }
    });
  }

  handleQueryAsync(query) {
    console.log("handleQueryAsync", query);
    const connId = this.state.connectionId;
    store.spinnerShow(); // TODO: probably wil not get reset in case of error response
    api.queryAsync(connId, query, data => {
      this.setState({
        queryIdInProgress: data.query_id,
        // TODO: not sure if should reset the data right away
        // maybe only after received some data or an error message
        resetPagination: true,
        selectedCellPosition: {
          rowId: -1,
          colId: -1,
        },
        editedCells: {},
      });
      setTimeout(this.getQueryAsyncStatus, 1000);
    });
  }

  handleExecuteQuery(query) {
    console.log("handleExecuteQuery", query);
    query = query.trim();
    if (isSelectQuery(query)) {
      this.handleQueryAsync(query);
    } else {
      this.handleQuerySync(query);
    }
  }

  handleExplainQuery(query) {
    console.log("handleExplainQuery", query);
    var connId = this.state.connectionId;
    api.explainQuery(connId, query, data => {
      this.setState({
        selectedView: view.SQLQuery,
        results: data,
        resetPagination: true,
        selectedCellPosition: {
          rowId: -1,
          colId: -1,
        },
        editedCells: {},
      });
    });
  }

  adHocTest() {}

  handleDisconnectDatabase() {
    api.disconnect(this.state.connectionId, data => {
      console.log("disconnect");

      this.setState({
        connectionId: 0,
        connected: false,
        tables: null,
        selectedTable: "",
        selectedTableInfo: null,
        results: null,
        errorMessage: "",
        errorVisible: false,
        resetPagination: false,
        selectedCellPosition: {
          rowId: -1,
          colId: -1,
        },
        editedCells: {},
      });
    });
  }

  handleAlertBox(message) {
    // type can be 'info', 'success', 'error'
    g_alert.show(message, {
      type: "error",
    });
  }

  handleResetPagination(toggle) {
    this.setState({
      resetPagination: toggle,
    });
  }

  handleSelectedCellPosition(newPosition) {
    this.setState({
      selectedCellPosition: newPosition,
    });
  }

  handleEditedCells(newCells) {
    this.setState({
      editedCells: newCells,
    });
  }

  handlePosChanged(dx) {
    store.setSidebarDx(dx);
  }

  setAlertNode(el) {
    console.log("setAlertNode:", el);
    g_alert = el;
  }

  render() {
    if (!this.state.connected) {
      return (
        <div>
          <div>
            <AlertContainer ref={this.setAlertNode} {...this.alertOptions} />
          </div>
          <ConnectionWindow onDidConnect={this.handleDidConnect} />
        </div>
      );
    }

    return (
      <div>
        <div>
          <AlertContainer ref={this.setAlertNode} {...this.alertOptions} />
        </div>
        <div>
          <Sidebar
            refreshAllTableInformation={this.getAllTablesStructures}
            connectionId={this.state.connectionId}
            tables={this.state.tables}
            selectedTable={this.state.selectedTable}
            selectedTableInfo={this.state.selectedTableInfo}
            databaseName={this.state.databaseName}
          />
          <DragBarVert
            min={128}
            max={128 * 3}
            initialX={store.getSidebarDx()}
            onPosChanged={this.handlePosChanged}
          />
          <MainContainer
            results={this.state.results}
            supportsExplain={this.state.capabilities.HasAnalyze}
            selectedView={this.state.selectedView}
            resetPagination={this.state.resetPagination}
            tableStructures={this.state.tableStructures}
            selectedTable={this.state.selectedTable}
            selectedCellPosition={this.state.selectedCellPosition}
            editedCells={this.state.editedCells}
          />
        </div>
      </div>
    );
  }
}

function appStart() {
  ReactDOM.render(<App />, document.getElementById("main"));
}

window.appStart = appStart;
