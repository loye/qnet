var net = require('net');

function Tunnel() {
    this.from.apply(this, arguments);
};

function connect(src, endpoint) {
    switch (this.endpoint.type) {
        case 'stream':
            src.pipe(endpoint.stream).pipe(src);
        case 'websocket':

            break;

        case 'socket':
        default:
            var dest = net.connect(port, host, function () {
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
            break;
    }
};

(function (proto) {
    proto.from = function (port, host) {
        if (typeof port === 'number') {
            port = { port: port, host: host };
        }
        this.endpoint = port;

        return this;
    };

    proto.to = function (port, host) {
        var endpoint = port;
        if (typeof port === 'number') {
            endpoint = { port: port, host: host };
        }
        switch (this.endpoint.type) {
            case 'stream':
                connect(this.endpoint.src, endpoint);
                break;

            default:
                net.createServer(function (s) {
                    connect(s, endpoint);
                }).listen(this.endpoint.port, this.endpoint.host);
                break;
        }

        return this;
    };

    proto.close = function () {

    };

})(Tunnel.prototype);

module.exports.Tunnel = Tunnel;

module.exports.component = {
    start: function (qnode, config) {
        //this._server = qnode.listen(config.path, function (conn) {

        //});
    },
    stop: function (qnode, config) {
        if (this._server) {
            this._server.close();
            delete this._server;
        }
    }
};

if (require.main === module) {
    new Tunnel(13389).to(3389);

}