
var Console = (function () {
    function _(connections) {
        this.ondata = this.input.bind(this);
        this.str = '';
    };

    function parse(str) {
        var command, data, dataStr;
        for (var i = 0; i < str.length; i++) {
            if (str[i] !== '{' && str[i] !== '[') {
                i++;
            } else {
                command = str.substring(0, i).trim();
                dataStr = str.substring(i);
                break;
            }
        }
        console.log(command);
        console.log(dataStr);
        if (!!command && !!dataStr) {
            data = JSON.parse(dataStr, dateReviver);
        }

        return data ? { command: command, data: data } : null;
    };

    function dateReviver(key, value) {
        return typeof value === 'string' && (e = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d*))Z$/.exec(value))
            ? new Date(Date.UTC(+e[1], +e[2] - 1, +e[3], +e[4], +e[5], +e[6], +e[7]))
            : value;
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
            var str = typeof data === 'string' ? data : data.toString('utf8');
            this.str += str;
            if (str === '\r\n') {
                var str = this.str;
                this.str = '';
                var command = parse(str);
                console.log(command);
                if (command) {
                    console.log('command accepted');

                } else {
                    console.log('command not well formatted');
                }
            }
        };

        proto.command = function (command, data, callback) {

        };

    })(_.prototype);

    return _;
})();

module.exports.component = {
    start: function (node, config) {
        this._console = new Console().start();
    },
    stop: function (node, config) {
        this._console.stop();
    }
};
