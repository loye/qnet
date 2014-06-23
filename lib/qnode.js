var net = require('net'),
    http = require('http'),
    util = require('util'),
    stream = require('stream'),
    events = require("events"),
    WebSocket = require('ws'),
    WSConnection = require('./ws-connection');


var Node = (function () {
    function _(options) {
        events.EventEmitter.call(this);

        this.EndPoints = [];

        //listen
        this.listen(options.port, options.host);

        //connect

    };
    util.inherits(_, events.EventEmitter);



    (function (proto) {
        proto.listen = function (port, host) {
            if (port && port > 0) {
                this.EndPoints.push(new EndPoint(port, host, function () {
                    console.log('start listening on', this.address);
                }).on('connection', function (c) {
                    console.log('new connection');
                }));
            }
        };

    })(_.prototype);

    return _;
})();

var EndPoint = (function () {
    function _(port, host, onlistening) {
        events.EventEmitter.call(this);

        var self = this;
        if (typeof onlistening === 'function') {
            this.on('listening', onlistening);
        }
        var webServer = http.createServer(function (req, res) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('I\'m working');

        }).listen(port, host, function () {
            self.address = this.address();
            self.server = WSConnection.listen({ server: this }, function (c) {
                self.emit('connection', c);
            });
            self.emit('listening');
        });
    };
    util.inherits(_, events.EventEmitter);

    return _;
})();


exports = Node;



if (require.main === module) {
    var n = new Node({ port: 1337 });

}