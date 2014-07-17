var Node = require('./lib/qnode.js');

var opts = {
    name: 'chn-lqiu1',
    domain: 'mstr',
    port: 1337,
    endpoint: {
        domain: 'a',
        url: 'ws://chn-lqiu1:1337/node'
    },
    //nodes: ['ws://localhost:4000/node', 'ws://chn-lqiu:1337/node'],
    reconnect: { interval: 10 }
};


var n = new Node(opts).start();
//setTimeout(function () { n.stop().start(); }, 3000);
console.log(n.profile);
console.log(n.context);

//process.on('uncaughtException', function (err) {
//    console.log('[Error catched by process]' + err);
//});
