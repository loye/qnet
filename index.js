var Node = require('./lib/qnode.js');

var opts = {
    name: 'demo',
    port: 1337,
    endpoint: {
        type: 'websocket',
        url: 'ws://localhost:1337/node'
    },
    nodes: ['ws://localhost:4000/node']

};


var n = new Node(opts).start();
//setTimeout(function () { n.stop().start(); }, 3000);
console.log(n.profile);
console.log(n.context);

//process.on('uncaughtException', function (err) {
//    console.log('[Error catched by process]' + err);
//});
