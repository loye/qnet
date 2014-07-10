var net = require('net'),
    http = require('http'),
    util = require('util'),
    fs = require('fs'),
    crypto = require('crypto'),
    EventEmitter = require("events").EventEmitter,
    resolvePath = require('path').resolve,
    parseUrl = require('url').parse,
    wsc = require('./ws-connection');


var Node = (function () {
    function _(opts) {
        EventEmitter.call(this);

        opts = defaultOptions(opts);

        this.started = false;
        this.profile = {
            id: crypto.createHash('sha1').update(Math.abs(Math.random() * Math.random() * Date.now() | 0).toString()).digest('hex'),
            name: opts.name,
            endpoint: opts.endpoint
        };
        this.context = {
            endpoint: {
                port: opts.port,
                host: opts.host,
                path: opts.path
            },
            componentsPath: resolvePath(process.cwd(), 'components')
        };
        this.nodeLinks = [];
        this.connector = new Connector(this.nodeLinks, opts);
    };
    util.inherits(_, EventEmitter);

    function defaultOptions(opts) {
        return {
            name: opts.name || 'anonymous',
            port: opts.port || 80,
            host: opts.host || '0.0.0.0',
            path: opts.path || (opts.endpoint && opts.endpoint.url ? parseUrl(opts.endpoint.url).pathname : '/'),
            endpoint: opts.endpoint,
            nodes: opts.nodes || []
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
                        components[k] = new Component(self, c, require(resolvePath(self.context.componentsPath, k)).component);
                    } catch (e) { }
                }
            });
        }
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
                this.listen(endpoint.path, this.connector.onconnection);

                // load components
                loadAllComponents.call(this);

                this.started = true;

                this.connector.start();
                console.log('node start');
            }
            return this;
        };

        proto.stop = function () {
            if (this.started) {
                this.started = false;
                this.context.endpoint._server.close();
                this.connector.stop();
                console.log('node close');
            }
            return this;
        };

        proto.restart = function () {
            return this.stop().start();
        };

        proto.listen = function (path, onconnection) {
            return wsc.listen({ server: this.context.endpoint._server, path: path }, function (conn) {
                onconnection.call(null, conn);
            });
        };

        proto.broadcast = function (msg, exceptNodeId) {
            var nodeLinks = this.nodeLinks;
            for (var i = 0; i < nodeLinks.length; i++) {
                var nodeLink = nodeLinks[i];
                if (nodeLink.id !== this.profile.id && nodeLink.id !== exceptNodeId) {
                    nodeLink.message(msg);
                }
            }
        };

    })(_.prototype);

    return _;
})();

var Connector = (function () {
    function _(nodeLinks, opts) {
        this.nodeLinks = nodeLinks;
        this.opts = opts;
    };

    function authenticate(conn) {
        return true;
    };

    function establishAsServer(conn) {
        conn.once('message')


        var nl = new NodeLink(conn);



    };

    (function (proto) {
        proto.onconnection = function (conn) {
            console.log('new connection');
            if (authenticate(conn)) {
                console.log('authentication sucess');
                establishAsServer(conn);
            } else {
                console.log('authentication failed');
            }
        };

        proto.start = function () {
            setTimeout(function () {

            }, 1);
        };

        proto.stop = function () {


        };

    })(_.prototype);

    return _;
})();

var NodeLink = (function () {
    function _(conn) {
        EventEmitter.call(this);

        (this.connections = {})[conn.type] = conn;
    };
    util.inherits(_, EventEmitter);

    function bindEvents(conn) {
        var self = this;
        conn.once('close', function () {
            if (self.connections[conn.type] === conn) {
                delete self.connections[conn.type];
            };
            //TODO
        });
        conn.on('message', function (msg) {
            self.emit('message', msg);
            if (Array.isArray(msg)) {
                for (var i = 0; i < msg.length; i++) {
                    handlePackage.call(self, msg[i]);
                }
            } else {
                handlePackage.call(self, msg);
            }
        });
    };

    function handlePackage(pkg) {
        var self = this;
        if (pkg && typeof pkg.command === 'string') {
            self.emit(pkg.command, pkg.data);
        }
    };

    (function (proto) {
        proto.command = function (command, data, callback) {
            if (typeof data === 'function') {
                callback = data;
                data = undefined;
            }
            if (this.connections.server && this.connections.server.connected) {
                this.connections.server.message({ command: command, data: data }, callback);
            } else if (this.connections.client && this.connections.client.connected) {
                this.connections.client.message({ command: command, data: data }, callback);
            } else {
                typeof callback === 'function' && callback.call(null, new Error('lost connection'));
            }
        };

        proto.addConnection = function (conn) {
            var oldConn = this.connections[conn.type];
            this.connections[conn.type] = conn;
            if (oldConn && oldConn.connected) {
                oldConn.close();
            }
        };

        proto.close = function () {
            this.connection.close();
        };

    })(_.prototype);

    return _;
})();

//var Commander = (function () {
//    function _(connections) {


//    };

//    function bindEvents(conn) {
//    };

//    (function (proto) {

//    })(_.prototype);

//    return _;
//})();

var Component = (function () {
    function _(node, config, cmp) {
        this.node = node;
        this.config = config;
        this._cmp = cmp;
        this.started = false;
        if (this.config.startup === 1) {
            this.start();
        }
    };

    (function (proto) {
        proto.start = function () {
            if (!this.started && this._cmp && typeof this._cmp.start === 'function') {
                this._cmp.start.call(this._cmp, this.node, this.config);
                this.started = true;
            }
            return this;
        };

        proto.stop = function () {
            if (this.started && this._cmp && typeof this._cmp.stop === 'function') {
                this.started = false;
                this._cmp.stop.call(this._cmp, this.node, this.config);
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

