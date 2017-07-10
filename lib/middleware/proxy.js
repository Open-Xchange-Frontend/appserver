var url = require('url');
var httpProxy = require('http-proxy');

function create(options) {
    var server;

    if (options.server) {
        server = url.parse(options.server.replace(options.urlPath, ''));
        if (server.protocol !== 'http:' && server.protocol !== 'https:') {
            console.error('Server must be an HTTP(S) URL');
            return;
        }
    }

    var proxy = new httpProxy.createProxyServer({
        target: server,
        secure: false
    });

    return function (request, response) {
        proxy.web(request, response);
    };
}

function wsProxy(options) {
    var server = url.parse(options.server.replace(options.urlPath, '').replace(/^http/, 'ws')),
        proxy = new httpProxy.createProxyServer({
            target: server,
            ws: true,
            secure: false,

        });

    return function (req, socket, head) {
        proxy.on('error', (e) => console.error('WS Proxy', e));

        proxy.ws(req, socket, head);
    };
}

module.exports = {
    create: create,
    createWSProxy: wsProxy
};
