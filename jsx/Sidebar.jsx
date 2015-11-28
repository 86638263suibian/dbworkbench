/* jshint -W097,-W117 */
'use strict';

var action = require('./action.js');
var api = require('./api.js');

var TableInformation = React.createClass({
  renderTableInfo: function(info) {
    if (info && !$.isEmptyObject(info)) {
      return (
        <ul>
          <li>Size: <span>{info.total_size}</span></li>
          <li>Data size: <span>{info.data_size}</span></li>
          <li>Index size: <span>{info.index_size}</span></li>
          <li>Estimated rows: <span>{info.rows_count}</span></li>
        </ul>
      );
    }
  },

  render: function() {
    var info = this.renderTableInfo(this.props.tableInfo);
    return (
      <div className="table-information">
        <div className="wrap">
          <div className="title">Table Information</div>
          {info}
        </div>
      </div>
    );
  }
});

var Sidebar = React.createClass({
  getInitialState: function() {
    return {
      tables: this.props.tables,
    };
  },

  componentWillMount: function() {
    var tables = this.refreshTables();
  },


  handleRefreshDatabase: function(e) {
    e.preventDefault();

    this.refreshTables();
  },

  handleSelectTable: function(e, table) {
    e.preventDefault();
    action.tableSelected(table);
  },

  refreshTables: function() {
    var connectionId = gUserInfo ? gUserInfo.ConnectionID : 0;

    var self = this;
    api.getTables(connectionId, function(data) {
      self.setState({
        tables: data,
      });
    });
  },

  renderTables: function(tables) {
    var self = this;

    var res = tables.map(function(table) {
      var cls = (table == self.props.selectedTable) ? ' selected' : '';
      var handler = function(e) {
        self.handleSelectTable(e, table);
      };
      return (
        <li onClick={handler} key={table} className={cls}>
          <span><i className='fa fa-table'></i>{table}</span>
        </li>
      );
    });
    return res;
  },

  // TODO: remove id="tables"
  render: function() {

    var tables = this.state.tables ? this.renderTables(this.state.tables) : null;

    return (
      <div id="sidebar">
        <div className="tables-list">
          <div className="wrap">
            <div className="title">
              <i className="fa fa-database"></i>
              <span className="current-database" id="current">{this.props.databaseName}</span>
              <span className="refresh" id="refresh_tables"
                    title="Refresh tables list" onClick={this.handleRefreshDatabase}> <i className="fa fa-refresh"></i>
              </span>
            </div>
            <ul id="tables">
              {tables}
            </ul>
          </div>
        </div>
        <TableInformation tableInfo={this.props.selectedTableInfo} />
      </div>
    );
  }

});

module.exports = Sidebar;
