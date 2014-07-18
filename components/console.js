
var Console = (function () {
    function _(node, config) {
        this.node = node;
        this.config = config;
        this.ondata = this.input.bind(this);
        this.str = '';
    };

    function parse(str) {
        var command, data, dataStr, i = 0;
        for (; i < str.length; i++) {
            if (str[i] === '{' || str[i] === '[') {
                break;
            }
        }
        command = str.substring(0, i).trim();
        dataStr = str.substring(i);
        if (command && dataStr) {
            try {
                data = JSON.parse(dataStr, dateReviver);
            } catch (e) {
                return null;
            }
        }
        var result = command ? { command: command } : null;
        result && data && (result.data = data);
        return result;
    };

    function dateReviver(key, value) {
        return typeof value === 'string' && (e = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d*))Z$/.exec(value))
            ? new Date(Date.UTC(+e[1], +e[2] - 1, +e[3], +e[4], +e[5], +e[6], +e[7]))
            : value;
    };

    function sendCommand(command, data, callback) {
        var commandar = this.node.net.commandar;
        if (commandar) {
            callback.call(null, 'command accepted...');
            commandar.execute(this, command, data);
        }
    };

    (function (proto) {
        proto.start = function () {
            process.stdin.on('data', this.ondata);
            return this;
        };

        proto.stop = function () {
            process.stdin.removeListener('data', this.ondata);
            return this;
        };

        proto.input = function (data) {
            var str = typeof data === 'string' ? data : data.toString();
            this.str += str;
            if (str === '\r\n') {
                var str = this.str.trim();
                this.str = '';
                var pkg = parse(str);
                if (pkg) {
                    console.log(pkg);
                    sendCommand.call(this, pkg.command, pkg.data, function (result) {
                        console.log(result);
                    });
                } else {
                    console.log('command not well formatted');
                }
            }
        };

        proto.command = function (command, data, callback) {
            console.log('command execute result:');
            console.log(command);
            console.log(data);
            typeof callback === 'function' && callback.call(null);
        };

    })(_.prototype);

    return _;
})();

module.exports.component = {
    start: function (node, config) {
        this._console = new Console(node, config).start();
    },
    stop: function (node, config) {
        this._console.stop();
    }
};
