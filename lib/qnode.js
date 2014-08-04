var net = require('net'),
    http = require('http'),
    util = require('util'),
    EventEmitter = require("events").EventEmitter,
    resolvePath = require('path').resolve,
    parseUrl = require('url').parse,
    Timeout = require('./Timeout.js').Timeout,
    wsc = require('./ws-connection');


var Node = (function () {
    function _(opts) {
        EventEmitter.call(this);

        this.started = false;
        this.options = opts = defaultOptions(opts);
        this.profile = {
            id: generateId(),
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
    }

    util.inherits(_, EventEmitter);

    function defaultOptions(opts) {
        var reconnect = opts.reconnect || { disabled: false };
        reconnect.interval || (reconnect.interval = 30);
        reconnect.retries || (reconnect.retries = 10);
        if (opts.endpoint && !opts.endpoint.domain) {
            opts.endpoint.domain = '';
        }
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
    }

    function loadAllComponents() {
        var self = this, config;
        try {
            config = require(self.context.componentsPath);
        } catch (e) {
        }
        if (config) {
            self.profile.components = config;
            var components = self.context.components = {};
            Object.keys(config).forEach(function (k) {
                var c = config[k];
                if (c['startup'] === 0 || c['startup'] === 1) {
                    try {
                        components[k] = new Component(self, c, require(resolvePath(self.context.componentsPath, k)).component);
                    } catch (e) {
                        console.log(e);
                    }
                }
            });
        }
    }

    (function (proto) {
        proto.start = function () {
            if (!this.started) {
                // start endpoint web server
                var endpoint = this.context.endpoint;
                endpoint._server || (endpoint._server = http.createServer(function (req, res) {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    if (endpoint.webAdmin) {
                        res.end(endpoint.webAdmin.indexPage);
                    } else {
                        res.end('I\'m working.');
                    }
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
        this.commandar = new Commander(this);
    }

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
    }

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
    }

    function establish(conn, callback) {
        var timeout = new Timeout(callback, 10000, new Error('[establish] timeout'));
        var self = this, onmsg;
        conn.on('message', onmsg = function (msg) {
            if (msg.command === 'establish') {
                conn.removeListener('message', onmsg);
                if (msg.data && msg.data.profile && msg.data.profile.id !== self.node.profile.id) {
                    var link = addNodeLink.call(self, conn, msg.data.profile);
                    //console.log('establish link: ', link);
                    timeout.immediate(null, link);
                } else {
                    conn.close();
                    timeout.immediate(new Error('[establish] no profile received'));
                }
            }
        }).message({ command: 'establish', data: { profile: self.node.profile } });
    }

    function addNodeLink(conn, profile) {
        var self = this, links = this.nodeLinks;
        var link = this.searchNodeLink(profile.id);
        if (link) {
            return link.addConnection(conn);
        }
        var newLink = links[links.length] = new NodeLink(conn, profile);
        bindNodeLink.call(self, newLink);
        return newLink;
    }

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
    }

    function bindNodeLink(link) {
        var self = this;
        link.once('close', function (closing) {
            this.removeAllListeners('command');
            removeNodeLink.call(self, this);
            if (!closing) { // reconnect for lost connection
                console.log('lost connection of ', this.profile.id);
                reconnect.call(self, this.profile);
            }
        }).on('command', self.commandar.execute.bind(self.commandar, link));
        return link;
    }

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
            if (!self.searchNodeLink(profile.id)) {
                connecting = self.connect(profile.endpoint, cb);
            }
        }

        function cb(err) {
            if (err && connecting && count > 0 && !err.stop) {
                setTimeout(handler, rec.interval * 1000);
            }
        }
    }

    (function (proto) {
        proto.onconnection = function (conn) {
            var self = this;
            authAsServer.call(this, conn, function (err) {
                if (err) {
                    console.log(err);
                } else {
                    establish.call(self, conn, function (err, link) {
                        if (!err && link) {
                            var self_endpoint = self.node.profile.endpoint;
                            if (!self_endpoint || (self_endpoint.domain && self_endpoint.domain !== link.profile.domain)) {
                                //domain mismatch
                                conn.close();
                            } else {
                                if (self_endpoint && !self_endpoint.url) {
                                    link.command('get.myendpoint', function (err, res) {
                                        if (!err && res && res.endpoint) {
                                            self_endpoint.url = res.endpoint.url;
                                        }
                                    });
                                }
                            }
                            if (link.profile.endpoint && !link.connections['client']) {
                                self.connect(link.profile.endpoint);
                                self.broadcast('post.links', { links: [link.profile] }, link.profile.id);
                            }
                        }
                    });
                }
            });
        };

        proto.connect = function (endpoint, callback) {
            var self = this, profile = self.node.profile, url;
            callback || (callback = function () {
            });
            if (typeof endpoint === 'string') {
                url = endpoint;
            } else {
                if (endpoint.domain && endpoint.domain !== self.node.profile.domain) {
                    callback.call(null, new Error('[connect] domain mismatch'));
                    return false;
                }
                url = endpoint.url;
            }
            if (!url) {
                callback.call(null, new Error('[connect] endpoint null'));
                return false;
            }
            if (profile.endpoint && profile.endpoint.url === url) {
                callback.call(null, new Error('[connect] ignore myself: ' + url));
                return false;
            }
            console.log('connecting to ', url);
            wsc.connect(url).on('connection', function (conn) {
                this.removeListener('error', callback);
                authAsClient.call(this, conn, function (err) {
                    if (err) {
                        console.log(err);
                    } else {
                        establish.call(self, conn, function (err, link) {
                            link.profile.endpoint || (link.profile.endpoint = {});
                            link.profile.endpoint.url || (link.profile.endpoint.url = url);
                            callback.call(null, err, link);
                        });
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

        proto.searchNodeLink = function (id) {
            var links = this.nodeLinks, i = links.length;
            while (i-- > 0) {
                if (links[i].profile.id === id) {
                    return links[i];
                }
            }
            return null;
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
    }

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
    }

    function handlePackage(pkg) {
        var self = this;
        if (pkg) {
            if (typeof pkg.command === 'string') {
                function cb(err, res) {
                    if (pkg.id) {
                        sendMessage.call(self, { id: pkg.id, response: { error: err, response: res } });
                    }
                }

                self.emit('command.' + pkg.command, pkg.data, cb);
                self.emit('command', pkg.command, pkg.data, cb);
            } else if (pkg.response && pkg.id) {
                self.emit('response.' + pkg.id, pkg.response);
            }
        }
    }

    function sendMessage(message, callback) {
        if (this.connections.server && this.connections.server.connected) {
            this.connections.server.message(message, callback);
        } else if (this.connections.client && this.connections.client.connected) {
            this.connections.client.message(message, callback);
        } else {
            typeof callback === 'function' && callback.call(null, new Error('lost connection'));
        }
        return this;
    }

    (function (proto) {
        proto.command = function (command, data, callback) {
            var self = this, id = generateId(), timeout;
            if (typeof data === 'function') {
                callback = data;
                data = undefined;
            }
            if (typeof callback === 'function') {
                timeout = new Timeout(callback, 60000, new Error('[command] timeout'));
            }
            if (typeof command === 'string' && command.length > 0) {
                sendMessage.call(this, { id: id, command: command, data: data }, typeof callback === 'function' ? function (err) {
                    if (err) {
                        timeout && timeout.immediate(err);
                    } else {
                        self.once('response.' + id, function (res) {
                            timeout && timeout.immediate(res.error, res.response);
                        });
                    }
                } : undefined);
            } else {
                timeout && timeout.immediate(new Error('command is null'));
            }
            return this;
        };

        proto.addConnection = function (conn) {
            var oldConn = this.connections[conn.type];
            this.connections[conn.type] = conn;
            bindEvents.call(this, conn);
            if (oldConn && oldConn.connected) {
                oldConn.close();
            }
            return this;
        };

        proto.close = function () {
            var self = this;
            this.closing = true;
            this.command('close', function () {
                Object.keys(self.connections).forEach(function (key) {
                    self.connections[key].close();
                });
            });
            return this;
        };

    })(_.prototype);

    return _;
})();

var Commander = (function () {
    function _(net) {
        this.net = net;

    }

    function execute(sender, command, data, callback) {
        var self = this;
        switch (command) {
            case 'get.profile':
                callback.call(null, null, { profile: self.net.node.profile });
                break;
            case 'get.myendpoint':
                callback.call(null, null, { endpoint: sender && sender.profile ? sender.profile.endpoint : null });
                break;
            case 'get.links':
                callback.call(null, null, { links: links_get.call(this) });
                break;

            case 'post.links':
                if (data && Array.isArray(data.links)) {
                    links_post.call(this, data.links);
                    callback.call(null);
                } else {
                    callback.call(null, 'no links post');
                }
                break;
            case '':
                break;
            default:
                callback.call(null, 'command not supported');
                break;
        }

    }

    function links_get() {
        var result = [], links = this.net.nodeLinks, i = result.length = links.length;
        while (i-- > 0) {
            result[i] = links[i].profile;
        }
        return result;
    }

    function links_post(links) {
        for (var i = 0; i < links.length; i++) {
            if (links[i].endpoint && links[i].endpoint.url) {
                var l = this.net.searchNodeLink(links[i].id);
                if (!l || !l.connections['client']) {
                    this.net.connect(links[i].endpoint);
                }
            }
        }
    }

    (function (proto) {
        proto.execute = function (sender, command, data, callback) {
            if (typeof data === 'function') {
                callback = data;
                data = undefined;
            }
            execute.call(this, sender, command, data, typeof callback === 'function' ? callback : function () {
            });
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
        if (this.config['startup'] === 1) {
            this.start();
        }
    }

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

function generateId(length) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890', l = 62, ls = 52,
        id = chars.charAt(Math.abs(Math.random() * Math.random() * Date.now() | 0) % ls);
    for (var i = 1, len = length || 16; i < len; i++) {
        id += chars.charAt(Math.abs(Math.random() * Math.random() * Date.now() | 0) % l);
    }
    return id;
}

//var _ = (function () {
//    function _(connections) {


//    }

//    (function (proto) {

//    })(_.prototype);

//    return _;
//})();

module.exports = Node;

