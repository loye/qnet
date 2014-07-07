var Node = require('./lib/qnode.js');

var opts = {
    port: 1337,
    //host: '0.0.0.0',
    url: 'ws://localhost:1337/node'

};

var n = new Node(opts).start();
//setTimeout(function () { n.stop().start(); }, 3000);
console.log(n.profile);
console.log(n.context);