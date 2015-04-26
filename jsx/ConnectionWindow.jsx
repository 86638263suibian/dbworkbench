/* jshint -W097,-W117 */
'use strict';

var ConnectionScheme = 0;
var ConnectionStandard = 1;
var ConnectionSSH = 2;

var ConnectionWindow = React.createClass({

  getInitialState: function() {
    return {
      connectionType: ConnectionScheme
    };
  },

  handleChangeConnectionTypeToScheme: function(e) {
    console.log("handleChangeConnectionTypeToScheme");
    e.preventDefault();
    this.setState({
      connectionType: ConnectionScheme
    });
  },

  handleChangeConnectionTypeToStandard: function(e) {
    console.log("handleChangeConnectionTypeToStandard");
    e.preventDefault();
    this.setState({
      connectionType: ConnectionStandard
    });
  },

  handleChangeConnectionTypeToSSH: function(e) {
    console.log("handleChangeConnectionTypeToSSH");
    e.preventDefault();
    this.setState({
      connectionType: ConnectionSSH
    });
  },

  handleConnect: function(e) {
    e.preventDefault();
    console.log("handleConnect");
  },

  handleCancel: function(e) {
    e.preventDefault();
    console.log("handleCancel");
  },

  renderConnectionFormHeader: function() {
    var clsScheme = "btn btn-default";
    var clsStandard = "btn btn-default";
    var clsSSH = "btn btn-default";
    switch (this.state.connectionType) {
      case ConnectionScheme:
        clsScheme += ' active';
        break;
      case ConnectionStandard:
        clsStandard += ' active';
        break;
      case ConnectionSSH:
        clsSSH += ' active';
        break;
    }

    // TODO: add SSH section
    // <button onClick={this.handleChangeConnectionTypeToSSH} className={clsSSH}>SSH</button>

    return (
        <div className="text-center">
          <div className="btn-group btn-group-sm connection-group-switch">
            <button onClick={this.handleChangeConnectionTypeToScheme} className={clsScheme}>Scheme</button>
            <button onClick={this.handleChangeConnectionTypeToStandard} className={clsStandard} >Standard</button>
          </div>
        </div>
    );
  },

  renderStandardGroup: function() {
    return (
      <div className="connection-standard-group">
        <div className="form-group bookmarks">
          <label className="col-sm-3 control-label">Bookmark</label>
          <div className="col-sm-9">
            <select className="form-control" id="connection_bookmarks"></select>
          </div>
        </div>

        <div className="form-group">
          <label className="col-sm-3 control-label">Host</label>
          <div className="col-sm-9">
            <input type="text" id="pg_host" className="form-control" />
          </div>
        </div>

        <div className="form-group">
          <label className="col-sm-3 control-label">Username</label>
          <div className="col-sm-9">
            <input type="text" id="pg_user" className="form-control" />
          </div>
        </div>

        <div className="form-group">
          <label className="col-sm-3 control-label">Password</label>
          <div className="col-sm-9">
            <input type="text" id="pg_password" className="form-control" />
          </div>
        </div>

        <div className="form-group">
          <label className="col-sm-3 control-label">Database</label>
          <div className="col-sm-9">
            <input type="text" id="pg_db" className="form-control" />
          </div>
        </div>

        <div className="form-group">
          <label className="col-sm-3 control-label">Port</label>
          <div className="col-sm-9">
            <input type="text" id="pg_port" className="form-control" placeholder="5432" />
          </div>
        </div>

        <div className="form-group">
          <label className="col-sm-3 control-label">SSL</label>
          <div className="col-sm-9">
            <select className="form-control" id="connection_ssl" defaultValue="require">
              <option value="disable">disable</option>
              <option value="require">require</option>
              <option value="verify-full">verify-full</option>
            </select>
          </div>
        </div>
      </div>
    );
  },

  renderSchemeGroup: function() {
    return (
      <div className="connection-scheme-group">
        <div className="form-group">
          <div className="col-sm-12">
            <label>Enter server URL scheme</label>
            <input type="text" className="form-control" id="connection_url" name="url" />
            <p className="help-block">URL format: postgres://user:password@host:port/db?sslmode=mode
            </p>
          </div>
        </div>
      </div>
    );
  },

  renderSSHGroup: function() {
    return (
      <div className="connection-ssh-group">
        <div className="form-group">
          <label className="col-sm-3 control-label">SSH Host</label>
          <div className="col-sm-9">
            <input type="text" id="ssh_host" className="form-control" />
          </div>
        </div>

        <div className="form-group">
          <label className="col-sm-3 control-label">SSH User</label>
          <div className="col-sm-9">
            <input type="text" id="ssh_user" className="form-control" />
          </div>
        </div>

        <div className="form-group">
          <label className="col-sm-3 control-label">SSH Password</label>
          <div className="col-sm-9">
            <input type="text" id="ssh_password" className="form-control" placeholder="optional" />
          </div>
        </div>

        <div className="form-group">
          <label className="col-sm-3 control-label">SSH Port</label>
          <div className="col-sm-9">
            <input type="text" id="pg_host" className="form-control" placeholder="optional" />
          </div>
        </div>
      </div>
    );
  },

  renderError: function(errorText) {
    return (
      <div id="connection_error" className="alert alert-danger">{errorText}</div>
    );
  },

  render: function() {
    var connectionFormHeader = this.renderConnectionFormHeader();
    var group;
    switch (this.state.connectionType) {
      case ConnectionScheme:
        group = this.renderSchemeGroup();
        break;
      case ConnectionStandard:
        group = this.renderStandardGroup();
        break;
      case ConnectionSSH:
        group = this.renderSSHGroup();
        break;
      default:
        console.log("unknown connectionType: ", this.state.connectionType);
    }
    var error;
    if (this.props.errorMessage) {
      error = this.renderError(this.props.errorMessage);
    }

    return (
      <div id="connection_window">
        <div className="connection-settings">
          <h1>Postgres Database Workbench</h1>
            <form role="form" className="form-horizontal" id="connection_form">
            {connectionFormHeader}
            <hr/>

            {group}
            {error}

            <div className="form-group">
              <div className="col-sm-12">
                <button onClick={this.handleConnect} className="btn btn-block btn-primary">Connect</button>
                <button onClick={this.handleCancel} type="reset" id="close_connection_window" className="btn btn-block btn-default">Cancel</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }
});

module.exports = ConnectionWindow;
