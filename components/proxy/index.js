var proxy = require('./proxy_tunnel');

module.exports.ProxyTunnel = proxy.ProxyTunnel;

module.exports.qnodeComponent = {
    start: function (qnode, config) {
        this._server = qnode.listen(config.path, function (conn) {
            conn.pipe(new proxy.ProxyTunnel(config.proxy)).pipe(conn);
        });
    },
    stop: function (qnode, config) {
        if (this._server) {
            this._server.close();
            delete this._server;
        }
    }
};
