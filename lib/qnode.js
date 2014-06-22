var net = require('net'),
    http = require('http'),
    util = require('util'),
    stream = require('stream'),
    events = require("events"),
    WebSocket = require('ws');


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
            self.server = new WebSocket.Server({ server: this });
            self.server.on('connection', function (ws) {
                self.emit('connection', new Connection(ws));
            });
            self.emit('listening');
        });
    };
    util.inherits(_, events.EventEmitter);

    return _;
})();


var Connection = (function () {
    function _(ws) {
        events.EventEmitter.call(this);

        this.node = node;

        var self = this;
        ws.on('message', function (data, flags) {
            console.log('receive message: ', data, flags);
            flags.binary ? ondata(self, data) : oncommand(self, data);

        });

    };
    util.inherits(_, events.EventEmitter);


    function oncommand(self, data) {
        var str = JSON.parse(data);


    };

    function ondata(self, data) {
        self.emit('data', data)
    };

    (function (proto) {


    })(_.prototype);
    return _;
})();


exports = Node;



if (require.main === module) {
    var n = new Node({ port: 1337 });

}