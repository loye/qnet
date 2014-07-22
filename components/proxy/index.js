var proxy = require('./proxy_tunnel');

module.exports.ProxyTunnel = proxy.ProxyTunnel;

module.exports.component = {
    start: function (node, config) {
        this._server = node.listen(config.path || '/proxy', function (conn) {
            conn.pipe(new proxy.ProxyTunnel(config.proxy)).pipe(conn);
        });
    },
    stop: function (node, config) {
        if (this._server) {
            this._server.close();
            delete this._server;
        }
    }
};
