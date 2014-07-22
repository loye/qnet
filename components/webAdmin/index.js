var fs = require('fs'),
    resolvePath = require('path').resolve;

var WebAdmin = (function () {
    function _(node, config) {
        this.node = node;
        this.config = config;
    };

    function handleCommand(conn, command, data, callback) {
        var self = this, commandar = this.node.net.commandar;
        switch (command) {
            case 'get.profile':
            case 'get.links':
                commandar.execute(null, command, data, callback);
                break;
            default:
                callback.call(null, new Error('command not supported'));
                break;
        }
    };

    (function (proto) {
        proto.onconnection = function (conn) {
            var self = this;
            conn.on('message', function (msg) {
                if (msg && typeof msg.command === 'string') {
                    console.log('receive command:', msg);
                    handleCommand.call(self, conn, msg.command, msg.data, function (err, res) {
                        if (msg.id) {
                            conn.message({ id: msg.id, response: { error: err, response: res } });
                        }
                    });
                }
            });
        };

    })(_.prototype);

    return _;
})();

module.exports.component = {
    start: function (node, config) {
        var webAdmin = node.context.endpoint.webAdmin = new WebAdmin(node, config);
        fs.readFile(resolvePath(__dirname, 'index.html'), function (err, data) {
            if (err) {
                webAdmin.indexPage = 'I\'m working. (loading web admin page failed)';
            } else {
                webAdmin.indexPage = data;
            }
        });
        this._server = node.listen(config.path || '/webadmin', function (conn) {
            webAdmin.onconnection(conn);
        });
    },
    stop: function (node, config) {
        if (this._server) {
            this._server.close();
            delete this._server;
        }
        if (node.context.endpoint.webAdmin) {
            delete node.context.endpoint.webAdmin;
        }
    }
};
