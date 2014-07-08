var util = require('util'),
    stream = require('stream'),
    WebSocket = require('ws');

var WSConnection = (function () {
    function _(address, protocols, options) {
        stream.Duplex.call(this);

        this.status = { sent: 0, received: 0 };

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
                self.status.received += data.length;
            }
            else {
                ontext.call(self, data);
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

    function ontext(text) {
        var message = JSON.parse(text, dateReviver);
        if (message) this.emit('message', message);
    };

    function dateReviver(key, value) {
        return typeof value === 'string' && (e = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d*))Z$/.exec(value))
            ? new Date(Date.UTC(+e[1], +e[2] - 1, +e[3], +e[4], +e[5], +e[6], +e[7]))
            : value;
    };


    (function (proto) {
        proto._write = function (chunk, encoding, callback) {
            var self = this;
            if (!this.connected) {
                this.once('connection', function () {
                    self._write(chunk, encoding, callback);
                });
            } else {
                var data = typeof chunk === 'string' ? new Buffer(chunk, encoding) : chunk;
                this._socket.send(data, { binary: true }, function (err) {
                    if (!err)
                        self.status.sent += data.length;
                    callback.call(null, err);
                });
            }
        };

        proto._read = function (n) { };

        proto.close = function () {
            this._socket.close();
            return this;
        };

        proto.message = function (message, callback) {
            if (this.connected) {
                var str = JSON.stringify(message);
                if (typeof str === 'string') this._socket.send(str, callback);
            } else {
                callback.call(null, new Error('connection closed'));
            }
            return this;
        };

    })(_.prototype);

    return _;
})();


module.exports.WSConnection = WSConnection;

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

