var proxy = require('./proxy_tunnel');

module.exports.start = function (qnode, config) {
    qnode.listen(config.path, function (conn) {
        conn.pipe(new proxy.ProxyTunnel(config.proxy)).pipe(conn);
    });
};

module.exports.stop = function (qnode, config) {

};