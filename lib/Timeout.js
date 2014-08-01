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
    }

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

module.exports.Timeout = Timeout;
