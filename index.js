var Node = require('./lib/qnode.js');

var opts = {
    name: require('os').hostname(),
    port: process.env.port || 1337,
    //host: '0.0.0.0',
    path: '/node',
    //domain: '',
    endpoint: {
        //domain: '',
        url: ''
    },
    nodes: [],
    reconnect: {},
};


var n = new Node(opts).start();
//setTimeout(function () { n.stop().start(); }, 3000);
console.log(n.profile);
//console.log(n.context);

//process.on('uncaughtException', function (err) {
//    console.log('[Error catched by process]' + err);
//});
