var net = require('net');
var QNode = require('./lib/qnode.js');
var WSConnection = require('./lib/ws-connection.js');


WSConnection.connect('ws://localhost:1337/node').on('connection', function (s) {
    s.message({ type: 'test', value: 1 });
    s.on('message', function (m) {
        console.log(m);
    });
    process.stdin.pipe(s).pipe(process.stdout);
});


var url1 = 'ws://localhost:1337/proxy';
var port1 = 2001;
net.createServer(function (s) {
    WSConnection.connect(url1).on('connection', function (t) {
        s.pipe(t).pipe(s);
    });
}).listen(port1);
console.log('start listening on port ' + port1 + ', remote url: ' + url1);

process.on('uncaughtException', function (err) {
    console.log('[Error catched by process]' + err);
});
