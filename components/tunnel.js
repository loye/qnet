var net = require('net');

function Tunnel(port, host) {
    this.port = port;
    this.host = host || '0.0.0.0';
};

(function (proto) {
    proto.to = function (port, host) {
        host || (host = '127.0.0.1');
        net.createServer(function (s) {
            var rs = net.connect(port, host, function () {
                s.on('close', function () {
                    rs && rs.end();
                }).on('error', function (err) {
                    console.log('[local] ', err);
                });
                s.pipe(rs).pipe(s);
            }).on('close', function () {
                s && s.end();
            }).on('error', function (err) {
                console.log('[remote] ', err);
            });
        }).listen(this.port, this.host);

        console.log('tunnel created from ' + this.host + ":" + this.port + " to " + host + ":" + port);

        return this;
    };

})(Tunnel.prototype);

exports.Tunnel = Tunnel;

if (require.main === module) {
    new Tunnel(13389).to(3389);

}