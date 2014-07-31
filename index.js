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
    //nodes: ['wss://qnet-ea.azurewebsites.net/node', 'wss://qnet.chinacloudsites.cn/node'],
    reconnect: {}
};


var n = new Node(opts).start();
console.log(n.profile);
console.log(n.context);

process.on('uncaughtException', function (err) {
    console.log('[Error catched by process]' + err);
});
