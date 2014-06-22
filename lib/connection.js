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
            flags.binary ? self.push(data) : oncommand.call(self, data);
        }).on('close', function () {
            self.connected = false;
            self.push(null);
            self.emit('close');
        }).on('error', function (err) {
            self.emit('error', err);
        });

        this.on('finish', function () {
            self.close();
        }).on('error', function (err) {
            //console.log(err);
        });

        this.connected = true;
        this.emit('connection', this);
    };

    function oncommand(data) {
        var command = JSON.parse(data);
        console.log(command);

        this.emit('command', command);
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
            this.connected = false;
            this._socket.close();

            return this;
        };

        proto.command = function (command) {
            console.log(typeof command.date);
            var str = JSON.stringify(command);
            this.connected && this._socket.send(str);
            console.log('send: ', str);
            return this;
        };

    })(_.prototype);

    return _;
})();


module.exports = WSConnection;

module.exports.connect = function (address, protocols, options) {
    return new WSConnection(address, protocols, options);
};

module.exports.listen = function (options, onconnect) {
    new WebSocket.Server(options).on('connection', function (ws) {
        onconnect.call(null, new WSConnection(ws));
    });
};

// test
if (require.main === module) {
    module.exports.listen({ port: 1337 }, function (s) {
        s.command({ date: new Date() });
    });
}
