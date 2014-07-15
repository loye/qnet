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

        this.started = false;
        this.options = opts = defaultOptions(opts);
        this.profile = {
            id: crypto.createHash('sha1').update(Math.abs(Math.random() * Math.random() * Date.now() | 0).toString()).digest('hex'),
            name: opts.name,
            domain: opts.domain,
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
        this.net = new Net(this);
    };
    util.inherits(_, EventEmitter);

    function defaultOptions(opts) {
        var reconnect = opts.reconnect || {};
        reconnect.interval || (reconnect.interval = 30);
        reconnect.retries || (reconnect.retries = 10);
        return {
            name: opts.name || 'anonymous',
            port: opts.port || 80,
            host: opts.host || '0.0.0.0',
            path: opts.path || (opts.endpoint && opts.endpoint.url ? parseUrl(opts.endpoint.url).pathname : '/'),
            domain: opts.domain || '',
            endpoint: opts.endpoint,
            nodes: opts.nodes || [],
            reconnect: reconnect
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
                this.listen(endpoint.path, this.net.onconnection.bind(this.net));

                // load components
                loadAllComponents.call(this);

                this.started = true;

                this.net.start();
                console.log('node start');
            }
            return this;
        };

        proto.stop = function () {
            if (this.started) {
                this.started = false;
                this.context.endpoint._server.close();
                this.net.stop();
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

    })(_.prototype);

    return _;
})();

var Net = (function () {
    function _(node) {
        this.node = node;
        this.nodeLinks = node.nodeLinks = [];
        this.commandar = new Commandar(this);
    };

    function authAsServer(conn, callback) {
        var timeout = new Timeout(callback, 10000, new Error('[authAsServer] timeout'));
        var onmsg1;

        //conn.message({ command: 'authentication', data: { type: 'none' } }, callback);

        conn.message({ command: 'authentication', data: { type: 'token' } }, function (err) {
            if (!err) {
                conn.on('message', onmsg1 = function (msg1) {
                    if (msg1.command === 'authentication') {
                        conn.removeListener('message', onmsg1);
                        var success = msg1.data && msg1.data.token === '5f1ddedc02a5abdc2d5c6a703ebe0f11fc87c9b4';
                        conn.message({ command: 'authentication', data: { success: success } }, function (err) {
                            timeout.immediate(success && !err ? null : new Error('[authAsServer] failed'));
                        });
                    }
                });
            } else {
                timeout.immediate(err);
            }
        });
    };

    function authAsClient(conn, callback) {
        var timeout = new Timeout(callback, 10000, new Error('[authAsClient] timeout'));
        var onmsg1, onmsg2;
        conn.on('message', onmsg1 = function (msg1) {
            if (msg1.command === 'authentication') {
                conn.removeListener('message', onmsg1);
                var type = msg1.data && msg1.data.type ? msg1.data.type : 'none';
                switch (type) {
                    case 'token':
                        conn.message({ command: 'authentication', data: { token: '5f1ddedc02a5abdc2d5c6a703ebe0f11fc87c9b4' } }, function (err) {
                            if (!err) {
                                conn.on('message', onmsg2 = function (msg2) {
                                    if (msg2.command === 'authentication') {
                                        conn.removeListener('message', onmsg2);
                                        var success = msg2.data && msg2.data.success;
                                        timeout.immediate(success ? null : new Error('[authAsClient] failed\n' + '{ type: ' + type + ' }'));
                                    }
                                });
                            } else {
                                timeout.immediate(err);
                            }
                        });
                        break;
                    case 'none':
                        timeout.immediate();
                        break;
                    default:
                        timeout.immediate(new Error('[authAsClient] type not support\n' + '{ type: ' + type + ' }'));
                        break;
                }
            }
        });
    };

    function establish(conn, callback) {
        var timeout = new Timeout(callback, 10000, new Error('[establish] timeout'));
        var self = this, onmsg;
        conn.on('message', onmsg = function (msg) {
            if (msg.command === 'establish') {
                conn.removeListener('message', onmsg);
                if (msg.data && msg.data.profile) {
                    var link = addNodeLink.call(self, conn, msg.data.profile);
                    console.log('establish link: ', link);
                    timeout.immediate(null, link);
                } else {
                    timeout.immediate(new Error('[establish] no profile received'));
                }
            }
        }).message({ command: 'establish', data: { profile: self.node.profile } });
    };

    function addNodeLink(conn, profile) {
        var self = this, links = this.nodeLinks;
        for (var i = 0; i < links.length; i++) {
            if (links[i].profile.id === profile.id) {
                links[i].addConnection(conn);
                return links[i];
            }
        }
        var newLink = links[links.length] = new NodeLink(conn, profile);
        newLink.on('close', removeNodeLink.bind(self, newLink));
        bindNodeLink.call(self, newLink);
        return newLink;
    };

    function removeNodeLink(id) {
        var links = this.nodeLinks, isId = typeof id === 'string', nl = null;
        for (var i = 0; i < links.length; i++) {
            if ((isId ? links[i].profile.id : links[i]) === id) {
                nl = links[i];
                for (var j = i + 1; j < links.length; i++, j++) {
                    links[i] = links[j];
                }
                links.length--;
                break;
            }
        }
        return nl;
    };

    function searchNodeLink(id) {
        console.log('searching ', id);
        var links = this.nodeLinks, i = links.length;
        while (i-- > 0) {
            if (links[i].profile.id === id) {
                return links[i];
            }
        }
        return null;
    };

    function bindNodeLink(link) {
        var self = this;
        link.once('close', function (closing) {
            if (!closing) { // reconnect for lost connection
                console.log('lost connection');
                reconnect.call(self, link.profile);
            }
        }).on('command', self.commandar.execute.bind(self.commandar, link));
    };

    function reconnect(profile) {
        var self = this,
            rec = self.node.options.reconnect,
            count,
            connecting;
        if (profile.endpoint && !rec.disabled) {
            count = rec.retries;
            setTimeout(handler, rec.interval * 1000);
        }
        function handler() {
            count--;
            if (!searchNodeLink.call(self, profile.id)) {
                connecting = self.connect(profile.endpoint, cb);
            }
        };
        function cb(err) {
            if (err && connecting && count > 0) {
                setTimeout(handler, rec.interval * 1000);
            }
        };
    };

    (function (proto) {
        proto.onconnection = function (conn) {
            var self = this;
            authAsServer.call(this, conn, function (err) {
                if (err) {
                    console.log(err);
                } else {
                    establish.call(self, conn, function (err, link) {
                        if (!err) {
                            if (link.profile.endpoint) {

                                if (!link.connections['client']) {
                                    self.connect(link.profile.endpoint);
                                }
                            }
                        }
                    });
                }
            });
        };

        proto.connect = function (endpoint, callback) {
            var self = this, url;
            callback || (callback = function () { });
            if (typeof endpoint === 'string') {
                url = endpoint;
            } else {
                if (!endpoint.domain || endpoint.domain === self.node.profile.domain) {
                    url = endpoint.url;
                } else {
                    callback.call(null, new Error('[connect] domain mismatch'));
                    return false;
                }
            }

            console.log('connecting to ', url);
            wsc.connect(url).on('connection', function (conn) {
                this.removeListener('error', callback);
                authAsClient.call(this, conn, function (err) {
                    if (err) {
                        console.log(err);
                    } else {
                        establish.call(self, conn, callback);
                    }
                });
            }).on('error', callback);
            return true;
        };

        proto.broadcast = function (command, data, ignoreNodeId) {
            var nodeLinks = this.nodeLinks;
            for (var i = 0; i < nodeLinks.length; i++) {
                var nodeLink = nodeLinks[i];
                if (nodeLink.id !== ignoreNodeId) {
                    nodeLink.command(command, data);
                }
            }
        };

        proto.start = function () {
            var self = this;
            setTimeout(function () {
                var urls = self.node.options.nodes;
                if (urls) {
                    for (var i = 0; i < urls.length; i++) {
                        self.connect(urls[i]);
                    }
                }
            }, 1000);
        };

        proto.stop = function () {
            var links = this.nodeLinks;
            this.nodeLinks = [];
            for (var i = 0; i < links.length; i++) {
                links[i].close();
            }
        };

    })(_.prototype);

    return _;
})();

var NodeLink = (function () {
    function _(conn, profile) {
        EventEmitter.call(this);

        this.profile = profile;
        this.connections = {};

        this.addConnection(conn);
    };
    util.inherits(_, EventEmitter);

    function bindEvents(conn) {
        var self = this;
        conn.on('close', function (closing) {
            if (self.connections[conn.type] === conn) {
                delete self.connections[conn.type];
            }
            if (Object.keys(self.connections).length === 0) {
                // no connection remain
                self.emit('close', self.closing || closing);
            }
        }).on('message', function (msg) {
            self.emit('message', msg);
            if (Array.isArray(msg)) {
                for (var i = 0; i < msg.length; i++) {
                    handlePackage.call(self, msg[i]);
                }
            } else {
                handlePackage.call(self, msg);
            }
        });
        this.on('command.close', function () {
            this.closing = true;
        });
    };

    function handlePackage(pkg) {
        var self = this;
        if (pkg && typeof pkg.command === 'string') {
            self.emit('command.' + pkg.command, pkg.data);
            self.emit('command', pkg.command, pkg.data);
        }
    };

    function sendMessage(message, callback) {
        if (this.connections.server && this.connections.server.connected) {
            this.connections.server.message(message, callback);
        } else if (this.connections.client && this.connections.client.connected) {
            this.connections.client.message(message, callback);
        } else {
            typeof callback === 'function' && callback.call(null, new Error('lost connection'));
        }
        return this;
    };

    (function (proto) {
        proto.command = function (command, data, callback) {
            if (typeof data === 'function') {
                callback = data;
                data = undefined;
            }
            sendMessage.call(this, { command: command, data: data }, callback);
            return this;
        };

        proto.addConnection = function (conn) {
            var oldConn = this.connections[conn.type];
            this.connections[conn.type] = conn;
            bindEvents.call(this, conn);
            if (oldConn && oldConn.connected) {
                oldConn.close();
            }
        };

        proto.close = function () {
            var self = this;
            this.closing = true;
            this.command('close');
            Object.keys(this.connections).forEach(function (key) { self.connections[key].close(); });
        };

    })(_.prototype);

    return _;
})();

var Commandar = (function () {
    function _(net) {
        this.net = net;

    };

    function execute(sender, command, data) {
        var selft = this;
        switch (command) {
            case 'links.get':
                sender.command('links.post', { links: links_get(this.nodeLinks) });
                break;
            case 'links.post':
                console.log(data);
                break;
            default:
                break;
        }

    };

    function links_get(links) {
        var result = [], i = result.length = links.length;
        while (i-- > 0) {
            result[i] = links[i].profile;
        }
        return result;
    };


    (function (proto) {
        proto.execute = function (sender, command, data) {
            if (typeof command !== 'string') {
                return;
            }
            console.log('oncommand: ', command, data);
            execute.call(this, sender, command, data);
        };

    })(_.prototype);

    return _;
})();

var Timeout = (function () {
    function _(handler, timeout, args) {
        var self = this;
        this.cancelled = false;
        this.handler = handler;
        this.args = args;
        setTimeout(function () {
            if (!self.cancelled && typeof self.handler === 'function')
                self.handler.call(null, self.args);
        }, timeout);
    };

    (function (proto) {
        proto.cancel = function () {
            this.cancelled = true;
            return this;
        };

        proto.immediate = function () {
            this.cancelled = true;
            this.handler.apply(null, arguments);
        };

    })(_.prototype);

    return _;
})();


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

//var _ = (function () {
//    function _(connections) {


//    };

//    (function (proto) {

//    })(_.prototype);

//    return _;
//})();

module.exports = Node;

