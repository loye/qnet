var net = require('net'),
    http = require('http'),
    url = require('url'),
    util = require('util'),
    events = require("events"),
    WSConnection = require('./ws-connection');


var Node = (function () {
    function _(options) {
        events.EventEmitter.call(this);
        this.profile = {};
        var path = '/';
        if (options.url) {
            this.profile.endpoint = { type: 'websocket', url: options.url };
            path = url.parse(options.url).pathname;
        }
        this.endpoint = new Endpoint(options.port, options.host);



        //connect

    };
    util.inherits(_, events.EventEmitter);



    (function (proto) {
        proto.listen = function (path, onconnection) {
            WSConnection.listen({ server: this.endpoint.server, path: path }, function (conn) {
                onconnection.call(null, conn);
            });
            return this;
        };

    })(_.prototype);

    return _;
})();

var Endpoint = (function () {
    function _(port, host) {
        events.EventEmitter.call(this);

        var self = this;
        self.server = http.createServer(function (req, res) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('I\'m working');
        }).listen(port, host, function () {
            self.address = this.address();
        });
    };
    util.inherits(_, events.EventEmitter);

    return _;
})();


exports = Node;



if (require.main === module) {
    var n = new Node({ port: 1337, url: 'ws://localhost:1337/qnode' });
    console.log(n.profile);
}