import React from "react";
import PropTypes from "prop-types";
import SpinnerCircle from "./SpinnerCircle.jsx";
import * as api from "./api.js";
import * as action from "./action.js";

const initialConnectionName = "New connection";

// must match bookmarks.go
const dbTypePostgres = "postgres";
const dbTypeMysql = "mysql";

const defaultPortPostgres = "5432";
const defaultPortMysql = "3306";

const maxBookmarks = 10;

// we need unique ids for unsaved bookmarks. We use negative numbers
// to make sure they don't clash with saved bookmarks (those have positive numbers)
let emptyBookmarkId = -10;

const pagilaDemoBookmarkId = -1;

// connecting is async process which might be cancelled
// we use this to uniquely identify connection attempt so that
// when api.connect() finishes, we can tell if it has been cancelled
// Note: could be state on CoonectionWindow, but we only have one
// of those at any given time so global is just as good
let currConnectionId = 1;

// http://stackoverflow.com/questions/26187189/in-react-js-is-there-any-way-to-disable-all-children-events
// var sayHi = guard("enabled", function(){ alert("hi"); });
// guard.deactivate("enabled");
// sayHi(); // nothing happens
// guard.activate("enabled");
// sayHi(); // shows the alert
var guard = function(key, fn) {
  return function() {
    if (guard.flags[key]) {
      return fn.apply(this, arguments);
    }
  };
};

guard.flags = {};
guard.activate = function(key) {
  guard.flags[key] = true;
};
guard.deactivate = function(key) {
  guard.flags[key] = false;
};

function newEmptyBookmark() {
  emptyBookmarkId -= 1;
  // Maybe: change to a class?
  return {
    id: emptyBookmarkId,
    type: dbTypePostgres,
    nick: initialConnectionName,
    database: "",
    url: "",
    host: "",
    user: "",
    password: "",
    port: "",
  };
}

function newTestDbBookmark() {
  return {
    id: pagilaDemoBookmarkId,
    type: dbTypePostgres,
    nick: "demo database",
    database: "pagila_demo",
    url: "",
    host: "banana-pepper-468.db.databaselabs.io",
    user: "pagila_demo_user",
    password: "pwd",
    port: "",
  };
}

export default class ConnectionWindow extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.newConnection = this.newConnection.bind(this);
    this.deleteBookmark = this.deleteBookmark.bind(this);
    this.handleCancel = this.handleCancel.bind(this);
    this.handleConnect = this.handleConnect.bind(this);
    this.handleFormChanged = this.handleFormChanged.bind(this);
    this.handleRememberChange = this.handleRememberChange.bind(this);
    this.selectBookmark = this.selectBookmark.bind(this);
    this.getSelectedBookmark = this.getSelectedBookmark.bind(this);
    this.connectToDatabase = this.connectToDatabase.bind(this);
    this.handleTestDatabase = this.handleTestDatabase.bind(this);

    // create default bookmark if no bookmarks saved in the backend
    var bookmarks = [newEmptyBookmark()];
    if (gBookmarkInfo && gBookmarkInfo.length > 0) {
      // need to make a copy of the array or else changing bookmark
      // will change gBookmarkInfo
      bookmarks = Array.from(gBookmarkInfo);
    }

    this.state = {
      remember: true,

      connectionErrorMessage: "",
      isConnecting: false,

      bookmarks: bookmarks,
      selectedBookmarkIdx: 0,
    };
  }

  componentDidMount() {
    this.getBookmarks();
  }

  newConnection(e) {
    var bookmarks = this.state.bookmarks;
    if (bookmarks.length >= maxBookmarks) {
      action.alertBox("Reached connections limit of " + maxBookmarks);
      return;
    }

    bookmarks.push(newEmptyBookmark());
    this.setState({
      bookmarks: bookmarks,
      selectedBookmarkIdx: bookmarks.length - 1,
    });
  }

  getSelectedBookmark() {
    const bookmarks = this.state.bookmarks;
    const nBookmarks = bookmarks.length;
    const i = this.state.selectedBookmarkIdx;
    if (i < nBookmarks) {
      return bookmarks[i];
    }
  }

  getBookmarks() {
    api.getBookmarks(data => {
      console.log("getBookmarks: ", data);
      if (!data) {
        data = [newEmptyBookmark()];
      }
      this.setState({
        bookmarks: data,
      });
    });
  }

  deleteBookmark(e) {
    e.stopPropagation();

    const idStr = e.target.attributes["data-custom-attribute"].value;
    const id = parseInt(idStr, 10);
    // bookmarks with negative id are not yet saved (only exist in the frontend)
    if (id < 0) {
      let selectedIdx = this.state.selectedBookmarkIdx;
      let bookmarks = this.state.bookmarks.filter(b => b.id != id);
      if (selectedIdx >= bookmarks.length) {
        selectedIdx = bookmarks.length - 1;
      }
      if (bookmarks.length == 0) {
        bookmarks = [newEmptyBookmark()];
        selectedIdx = 0;
      }
      this.setState({
        bookmarks: bookmarks,
        selectedBookmarkIdx: selectedIdx,
      });
      return;
    }

    api.removeBookmark(id, data => {
      console.log("deleteBookmarks removing: ", id, " data: ", data);

      let bookmarks = [newEmptyBookmark()];
      let selectedBookmarkIdx = 0;
      if (data !== undefined && data.length > 0) {
        bookmarks = data;
      }

      this.setState({
        bookmarks: bookmarks,
        selectedBookmarkIdx: selectedBookmarkIdx,
      });
    });
  }

  selectBookmark(e) {
    e.stopPropagation();

    var idxStr = e.currentTarget.attributes["data-custom-attribute"].value;
    var idx = parseInt(idxStr, 10);
    console.log("selectBookmark, idx:", idx);

    this.setState({
      selectedBookmarkIdx: idx,
      connectionErrorMessage: "",
    });
  }

  handleFormChanged(e) {
    const name = e.target.id;
    const val = e.target.value;
    console.log(`handleFormChanged: name=${name} val=${val}`);

    const b = this.getSelectedBookmark();
    const prevDatabase = b["database"];
    b[name] = val;
    const dbName = b["database"];

    // if nick has not been modified by user, make it equal to database name
    const nick = b["nick"];
    if (nick == initialConnectionName || nick == prevDatabase) {
      if (dbName != "") {
        b["nick"] = dbName;
      }
    }

    const bookmarks = this.state.bookmarks;
    bookmarks[this.selectedBookmarkIdx] = b;
    this.setState({
      bookmarks: bookmarks,
      connectionErrorMessage: "",
    });
  }

  handleRememberChange(e) {
    var newRemeber = !this.state.remember;
    this.setState({
      remember: newRemeber,
    });
    //console.log("remember changed to: " + newRemeber);
  }

  connectToDatabase(b) {
    let id = b["id"];
    let nick = b["nick"];
    let dbType = b["type"];
    let host = b["host"];
    let port = b["port"];
    let user = b["user"];
    let pass = b["password"];
    let db = b["database"];
    let rememberConnection = this.state.remember;
    if (id == pagilaDemoBookmarkId) {
      rememberConnection = false;
    }

    let url = "";
    let urlSafe = "";
    if (dbType == dbTypePostgres) {
      if (port.length == 0) {
        port = defaultPortPostgres;
      }
      url =
        "postgres://" + user + ":" + pass + "@" + host + ":" + port + "/" + db;
      urlSafe = url;
      if (pass != "") {
        urlSafe =
          "postgres://" +
          user +
          ":" +
          "***" +
          "@" +
          host +
          ":" +
          port +
          "/" +
          db;
      }
    } else if (dbType == dbTypeMysql) {
      // mysql format:
      // username:password@protocol(address)/dbname?param=value
      // dbname can be empty
      if (port.length == 0) {
        port = defaultPortMysql;
      }
      // pareTime: conver time from []byte to time.Time
      // https://github.com/go-sql-driver/mysql#parsetime
      url =
        user +
        ":" +
        pass +
        "@tcp(" +
        host +
        ":" +
        port +
        ")/" +
        db +
        "?parseTime=true&allowOldPasswords=true";
      urlSafe = url;
      if (pass != "") {
        urlSafe =
          user +
          ":" +
          "***" +
          "@tcp(" +
          host +
          ":" +
          port +
          ")/" +
          db +
          "?parseTime=true&allowOldPasswords=true";
      }
    } else {
      console.log("invalid type: " + dbType);
      // TODO: how to error out?
    }

    console.log("URL:" + url);
    this.setState({
      isConnecting: true,
    });
    const myConnectionId = currConnectionId;
    api.connect(dbType, url, urlSafe, resp => {
      if (myConnectionId != currConnectionId) {
        console.log("ignoring completion of a cancelled connection");
        return;
      }
      ++currConnectionId;
      if (resp.error) {
        console.log("handleConnect: resp.error: ", resp.error);

        this.setState({
          connectionErrorMessage: resp.error,
          isConnecting: false,
        });
        return;
      }

      if (rememberConnection) {
        console.log("did connect, saving a bookmark ", b);
        api.addBookmark(this.getSelectedBookmark());
      } else {
        console.log("did connect, not saving a bookmark");
      }
      const connId = resp.ConnectionID;
      const connStr = url;
      const databaseName = resp.CurrentDatabase;
      const capabilities = resp.Capabilities;
      this.props.onDidConnect(connStr, connId, databaseName, capabilities);
    });
  }

  handleTestDatabase(e) {
    console.log("handleTestDatabase");
    e.preventDefault();
    const b = newTestDbBookmark();
    this.connectToDatabase(b);
  }

  handleConnect(e) {
    console.log("handleConnect");
    e.preventDefault();
    const b = this.getSelectedBookmark();
    this.connectToDatabase(b);
  }

  handleCancel(e) {
    e.preventDefault();
    console.log("handleCancel");
    // to tell api.connec() callback that we've been cancelled
    ++currConnectionId;

    this.setState({
      isConnecting: false,
    });
  }

  renderErrorOptional(errorText) {
    if (errorText != "") {
      return (
        <div className="col-md-12 connection-error">
          Error:
          {errorText}
        </div>
      );
    }
  }

  renderBookMarks() {
    guard.activate("bookmarksEnabled");
    if (this.state.isConnecting) {
      guard.deactivate("bookmarksEnabled");
    }

    let bookmarks = [];
    for (var i = 0; i < this.state.bookmarks.length; i++) {
      const b = this.state.bookmarks[i];
      const id = b["id"];
      const nick = b["nick"];

      let className = "list-group-item";
      if (i == this.state.selectedBookmarkIdx) {
        className = "list-group-item active";
      }

      bookmarks.push(
        <a
          key={id}
          data-custom-attribute={i}
          href="#"
          className={className}
          onClick={guard("bookmarksEnabled", this.selectBookmark)}
        >
          {nick}
          {" "}
          <i
            data-custom-attribute={id}
            onClick={guard("bookmarksEnabled", this.deleteBookmark)}
            className="fa fa-times pull-right hover-highlight"
          />
          &gt;
        </a>
      );
    }

    const style = {
      border: 0,
      fontSize: 14,
    };

    // TODO: "Connections" text should change color on hover
    return (
      <div className="list-group list-special">
        <span className="list-group-item title">Connections</span>
        <hr />
        {bookmarks}
        <div className="list-group list-group-item pull-right" style={style}>
          <a href="#" onClick={guard("bookmarksEnabled", this.newConnection)}>
            New connection
          </a>
        </div>
      </div>
    );
  }

  renderTestDatabases() {
    const style = {
      border: 0,
      clear: "both",
      fontSize: 14,
    };
    return (
      <div className="list-group list-group-item" style={style}>
        <a
          href="#"
          onClick={guard("bookmarksEnabled", this.handleTestDatabase)}
        >
          Try demo database
        </a>
      </div>
    );
  }

  renderFormElements() {
    let b = this.getSelectedBookmark();

    let dbType = b["type"];
    let defaultPort = "0";
    if (dbType == dbTypePostgres) {
      defaultPort = defaultPortPostgres;
    } else if (dbType == dbTypeMysql) {
      defaultPort = defaultPortMysql;
    } else {
      console.log("Unknown type: " + dbType);
    }

    let disable = this.state.isConnecting;

    return (
      <div>
        <div className="col-md-8">
          <div className="form-group">
            <label className="control-label" htmlFor="nick">
              Nickname
            </label>
            <input
              type="text"
              id="nick"
              className="form-control input-sm"
              value={b["nick"]}
              disabled={disable}
              onChange={this.handleFormChanged}
            />
          </div>
        </div>
        <div className="col-md-4">
          <div className="form-group">
            <label className="control-label" htmlFor="type">
              Type
            </label>
            <select
              id="type"
              className="form-control input-sm"
              value={dbType}
              disabled={disable}
              onChange={this.handleFormChanged}
            >
              <option value={dbTypePostgres}>
                PostgreSQL
              </option>
              <option value={dbTypeMysql}>
                MySQL
              </option>
            </select>
          </div>
        </div>
        <div className="col-md-8">
          <div className="form-group">
            <label className="control-label" htmlFor="host">
              Hostname
            </label>
            <input
              type="text"
              id="host"
              className="form-control input-sm"
              value={b["host"]}
              disabled={disable}
              onChange={this.handleFormChanged}
            />
          </div>
        </div>
        <div className="col-md-4">
          <div className="form-group">
            <label className="control-label" htmlFor="port">
              Port
            </label>
            <input
              type="text"
              id="port"
              className="form-control input-sm"
              value={b["port"]}
              disabled={disable}
              onChange={this.handleFormChanged}
              placeholder={defaultPort}
            />
          </div>
        </div>
        <div className="col-md-12">
          <div className="form-group">
            <label className="control-label" htmlFor="database">
              Database
            </label>
            <input
              type="text"
              id="database"
              className="form-control input-sm"
              value={b["database"]}
              disabled={disable}
              onChange={this.handleFormChanged}
            />
          </div>
        </div>
        <div className="col-md-6">
          <div className="form-group">
            <label className="control-label" htmlFor="user">
              User
            </label>
            <input
              type="text"
              id="user"
              className="form-control input-sm"
              value={b["user"]}
              disabled={disable}
              onChange={this.handleFormChanged}
            />
          </div>
        </div>
        <div className="col-md-6">
          <div className="form-group">
            <label className="control-label" htmlFor="password">
              Password
            </label>
            <input
              type="password"
              id="password"
              className="form-control input-sm"
              value={b["password"]}
              disabled={disable}
              onChange={this.handleFormChanged}
            />
          </div>
        </div>
        <div className="col-md-12 right">
          <label className="control-label" htmlFor="pwd-remember">
            <input
              type="checkbox"
              id="pwd-remember"
              checked={this.state.remember}
              disabled={disable}
              onChange={this.handleRememberChange}
            />
            {" "}
            Remember
          </label>
        </div>
        <div className="col-md-12 right light-text smaller-text">
          <i className="fa fa-lock fa1" />
          &nbsp;Database crendentials are stored securely on your computer
        </div>
        <div className="col-md-12" />
        {this.renderErrorOptional(this.state.connectionErrorMessage)}
        {this.renderConnectOrCancel()}
      </div>
    );
  }

  renderConnectOrCancel() {
    let styleDiv = {
      position: "relative",
    };

    let styleSpinner = {
      zIndex: 5,
      position: "absolute",
      right: "-32px",
      top: 8,
    };

    if (this.state.isConnecting) {
      return (
        <div className="col-md-12" style={styleDiv}>
          <button
            onClick={this.handleCancel}
            className="btn btn-block btn-danger small"
          >
            Cancel
          </button>
          <SpinnerCircle forceVisible style={styleSpinner} />
        </div>
      );
    }

    return (
      <div className="col-md-12">
        <button
          onClick={this.handleConnect}
          className="btn btn-block btn-primary small"
        >
          Connect
        </button>
      </div>
    );
  }

  renderForm() {
    if (this.state.selectedBookmarkIdx >= 0) {
      return (
        <form role="form">
          {this.renderFormElements()}
        </form>
      );
    }

    // TODO: I don't think it ever happens
    var imageStyle = {
      width: "30%",
      height: "30%",
    };

    return (
      <form role="form">
        <div className="col-md-12 text-center">
          <img
            className="img-responsive center-block small"
            src="/s/img/icon.png"
            alt=""
            style={imageStyle}
          />
          <h5>Please add a connection</h5>
        </div>
      </form>
    );
  }

  renderConnectionWindow() {
    return (
      <div className="container small">
        <div className="row">
          <div className="col-md-4">
            {this.renderBookMarks()}
            {this.renderTestDatabases()}
          </div>
          <div className="col-md-8">
            {this.renderForm()}
          </div>
        </div>
      </div>
    );
  }

  render() {
    let versionStyle = {
      position: "absolute",
      bottom: "0px",
      right: "0",
      padding: "5px",
      fontSize: "12px",
      color: "#A9A9A9",
    };

    return (
      <div id="connection-window">
        <div className="logo-container">
          <img className="resize_fit_center" src="/s/img/dbhero-sm.png" />
        </div>
        <div className="connection-settings">
          {this.renderConnectionWindow()}
          <hr />
        </div>
        <div style={versionStyle}>
          Version:
          {gVersionNumber}
        </div>
      </div>
    );
  }
}

ConnectionWindow.propTypes = {
  onDidConnect: PropTypes.func.isRequired,
};
