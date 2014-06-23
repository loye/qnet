var net = require('net');
var QNode = require('./lib/qnode.js');
var WSConnection = require('./lib/ws-connection.js');


//WSConnection.connect('ws://localhost:1337').on('connection', function (s) {
//    s.command({ type: 'test', value: 1 });
//    s.on('command', function (c) {
//        console.log(c);
//    });
//    process.stdin.pipe(s).pipe(process.stdout);
//});


var url1 = 'wss://qproxy.azurewebsites.net';
var port1 = 2001;
net.createServer(function (s) {
    var t = WSConnection.connect(url1);
    s.pipe(t).pipe(s);
    //WSConnection.connect(url1).on('connection', function (t) {
    //    s.pipe(t).pipe(s);
    //    t.on('close', function () {
    //        console.log(t.trace);
    //    });
    //});
}).listen(port1);
console.log('start listening on port ' + port1 + ', remote url: ' + url1);

process.on('uncaughtException', function (err) {
    console.log('[Error catched by process]' + err);
});
