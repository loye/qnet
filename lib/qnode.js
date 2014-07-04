var net = require('net'),
    http = require('http'),
    util = require('util'),
    fs = require('fs'),
    EventEmitter = require("events").EventEmitter,
    resolvePath = require('path').resolve,
    parseUrl = require('url').parse,
    WSConnection = require('./ws-connection');


var Node = (function () {
    function _(options) {
        EventEmitter.call(this);
        this.started = false;
        this.options = opts = defaultOptions(options);
        this.profile = {
            endpoint: {
                type: 'websocket',
                url: opts.url
            }
        };
        this.context = {
            endpoint: {
                port: opts.port || 80,
                host: opts.host || '0.0.0.0',
                path: opts.path
            },
            componentsPath: resolvePath(process.cwd(), 'components')
        };

    };
    util.inherits(_, EventEmitter);

    function defaultOptions(options) {
        var u = options.url || 'ws://'
            + (options.host ? options.host : 'localhost')
            + (options.port ? ':' + options.port : '')
            + (options.path ? options.path : '/');
        return {
            port: options.port || 80,
            host: options.host || '0.0.0.0',
            path: options.path || parseUrl(u).pathname,
            url: u
        };
    };

    function loadAllComponents() {
        var self = this, config;
        try {
            config = require(self.context.componentsPath);
        } catch (e) { }
        if (config) {
            self.profile.components = config;
            var components = self.context.components = {};
            Object.keys(config).forEach(function (k) {
                var c = config[k];
                if (c.startup === 0 || c.startup === 1) {
                    try {
                        components[k] = new Component(self, c, require(resolvePath(self.context.componentsPath, k)));
                    } catch (e) { }
                }
            });
        }
    };

    function onconnection(conn) {
        // do when new connection

    };

    function connect() {


    };

    (function (proto) {
        proto.start = function () {
            if (!this.started) {
                // start endpoint web server
                var endpoint = this.context.endpoint;
                endpoint._server || (endpoint._server = http.createServer(function (req, res) {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    fs.readFile(resolvePath(__dirname, 'endpoint.html'), function (err, data) {
                        if (err) {
                            res.end('I\'m working.');
                        } else {
                            res.end(data);
                        }
                    });
                }));
                endpoint._server.listen(endpoint.port, endpoint.host);

                // start listen web socket of path
                this.listen(endpoint.path, onconnection);

                // load components
                loadAllComponents.call(this);

                this.started = true;
                console.log('qnode start');
            }
            return this;
        };

        proto.stop = function () {
            if (this.started) {
                this.started = false;
                this.context.endpoint._server.close();
                console.log('qnode close');
            }
            return this;
        };

        proto.restart = function () {
            return this.stop().start();
        };

        proto.listen = function (path, onconn) {
            return WSConnection.listen({ server: this.context.endpoint._server, path: path }, function (conn) {
                onconn.call(null, conn);
            });
        };

    })(_.prototype);

    return _;
})();

var Component = (function () {
    function _(qnode, config, m) {
        this.qnode = qnode;
        this.config = config;
        this._module = m;
        this.started = false;
        if (this.config.startup === 1) {
            this.start();
        }
    };

    (function (proto) {
        proto.start = function () {
            if (!this.started && typeof this._module.start === 'function') {
                this._module.start.call(this._module, this.qnode, this.config);
                this.started = true;
            }
            return this;
        };

        proto.stop = function () {
            if (this.started && typeof this._module.stop === 'function') {
                this.started = false;
                this._module.stop.call(this._module, this.qnode, this.config);
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

