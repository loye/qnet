var proxy = require('./proxy_tunnel');

module.exports.start = function (qnode, config) {
    this._server = qnode.listen(config.path, function (conn) {
        conn.pipe(new proxy.ProxyTunnel(config.proxy)).pipe(conn);
    });
};

module.exports.stop = function (qnode, config) {
    if (this._server) {
        this._server.close();
        delete this._server;
    }
};