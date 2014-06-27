var net = require('net'),
    http = require('http'),
    url = require('url'),
    util = require('util'),
    events = require("events"),
    fs = require('fs'),
    WSConnection = require('./ws-connection');


var Node = (function () {
    function _(options) {
        events.EventEmitter.call(this);
        this.options = options;
        this.profile = {};
        this.context = {
            endpoint: {
                port: options.port,
                host: options.host || '0.0.0.0'
            },
            componentsPath: url.resolve(process.cwd() + '\\', 'components/')
        };
        this.started = false;

        if (options.url) {
            this.profile.endpoint = { type: 'websocket', url: options.url };
            this.context.endpoint.path = options.path ? options.path : url.parse(options.url).pathname;
        }
    };
    util.inherits(_, events.EventEmitter);

    function loadComponents(self) {
        var path = self.context.componentsPath + 'index.json';
        if (fs.existsSync(path)) {
            var config = self.profile.components = require(path);
            var components = self.context.components = {};
            Object.keys(config).forEach(function (k) {
                var c = config[k];
                if (c.startup === 0 || c.startup === 1) {
                    try {
                        components[k] = new Component(self, c, require(self.context.componentsPath + k));
                    } catch (e) { }
                }
            });
        }
    };

    function createEndpoint(self) {
        var endpoint = {};
        endpoint._server = http.createServer(function (req, res) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            fs.readFile(self.context.componentsPath + 'endpoint/index.html', function (err, data) {
                if (err) {
                    res.end('I\'m working.');
                } else {
                    res.end(data);
                }
            });
        }).listen(self.context.endpoint.port, self.context.endpoint.host, function () {
            endpoint.address = this.address();
        });
        return endpoint;
    };

    function onconnection(conn) {

    };

    function connect() {


    };

    (function (proto) {
        proto.start = function () {
            if (!this.started) {
                if (this.profile.endpoint) {
                    this.endpoint = createEndpoint(this);
                    this.listen(this.context.endpoint.path, onconnection);
                }
                loadComponents(this);

                this.started = true;
                console.log('qnode start');
            }
            return this;
        };

        proto.stop = function () {
            if (this.started) {
                this.started = false;
                this.endpoint._server.close();
                console.log('qnode close');
            }
            return this;
        };

        proto.restart = function () {
            return this.stop().start();
        };

        proto.listen = function (path, onconn) {
            WSConnection.listen({ server: this.endpoint._server, path: path }, function (conn) {
                onconn.call(null, conn);
            });
            return this;
        };



    })(_.prototype);

    return _;
})();

var Component = (function () {
    function _(qnode, config, component) {
        this.qnode = qnode;
        this.config = config;
        this.startFunction = component.start;
        this.stopFunction = component.stop;
        this.started = false;
        if (this.config.startup === 1) {
            this.start();
        }
    };

    (function (proto) {
        proto.start = function () {
            if (!this.started && typeof this.startFunction === 'function') {
                this.startFunction.call(null, this.qnode, this.config);
                this.started = true;
            }
            return this;
        };

        proto.stop = function () {
            if (this.started && typeof this.stopFunction === 'function') {
                this.started = false;
                this.stopFunction.call(null, this.qnode, this.config);
            }
            return this;
        };

        proto.restart = function () {
            return this.stop().start();
        };

    })(_.prototype);

    return _
})();


module.exports = Node;

