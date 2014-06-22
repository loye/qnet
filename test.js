var QNode = require('./lib/qnode.js');
var WSConnection = require('./lib/connection.js');


WSConnection.connect('ws://localhost:1337').on('connection', function (s) {
    s.command({ type: 'test', value: 1 });
    s.on('command', function (c) {
        console.log(typeof c.date);
    });
});
