var util = require('util'),
    stream = require('stream'),
    WebSocket = require('ws');

var WSConnection = (function () {
    function _(address, protocols, options) {
        stream.Duplex.call(this);

        this.connected = false;

        if (typeof address === 'string') {
            this._socket = new WebSocket(address, protocols, options).on('open', onopen.bind(this));
        } else {
            this._socket = address;
            onopen.call(this);
        }
    };
    util.inherits(_, stream.Duplex);

    function onopen() {
        var self = this;
        this._socket.on('message', function (data, flags) {
            if (flags.binary) {
                self.push(data);
            }
            else {
                oncommand.call(self, data);
            }
        }).on('close', function () {
            self.connected = false;
            self.push(null);
            self.emit('close');
        }).on('error', function (err) {
            self.emit('error', err);
        });

        this.on('finish', function () {
            self.close();
        }).on('error', function (err) { });

        this.connected = true;
        this.emit('connection', this);
    };

    function oncommand(data) {
        var command = JSON.parse(data, dateReviver);

        this.emit('command', command);
    };

    function dateReviver(key, value) {
        return typeof value === 'string' && (e = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d*))Z$/.exec(value))
            ? new Date(Date.UTC(+e[1], +e[2] - 1, +e[3], +e[4], +e[5], +e[6], +e[7]))
            : value;
    };


    (function (proto) {
        proto._write = function (chunk, encoding, callback) {
            var data = typeof chunk === 'string' ? new Buffer(chunk, encoding) : chunk;
            var self = this;
            if (!this.connected) {
                this.once('connection', function () {
                    self._socket.send(data, { binary: true }, callback);
                });
            } else {
                self._socket.send(data, { binary: true }, callback);
            }
        };

        proto._read = function (n) { };

        proto.close = function () {
            this._socket.close();
            return this;
        };

        proto.command = function (command) {
            if (this.connected) {
                var str = JSON.stringify(command);
                if (typeof str === 'string') this._socket.send(str);
            }

            return this;
        };

    })(_.prototype);

    return _;
})();


module.exports = WSConnection;

module.exports.connect = connent = function (address, protocols, options) {
    return new WSConnection(address, protocols, options);
};

module.exports.listen = listen = function (options, onconnection) {
    var server = new WebSocket.Server(options);
    if (typeof onconnection === 'function') {
        server.on('connection', function (ws) {
            onconnection.call(null, new WSConnection(ws));
        });
    }
    return server;
};

// test
if (require.main === module) {
    listen({ port: 1337 }, function (s) {
        s.on('command', function (c) {
            console.log(c);
        });
        s.command({ message: 'welcome', date: new Date() });
        s.pipe(s);
    });

}
