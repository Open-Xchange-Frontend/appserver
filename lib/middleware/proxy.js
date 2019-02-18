var url = require('url');
var httpProxy = require('http-proxy');

function handleBinaryStream(proxyRes, req, res) {
    var isStream = /application\/octet-stream/.test(proxyRes.headers["content-type"]);
    if (isStream) {
        res.write = (function(override) {
            return function(chunk, encoding, callback) {
                override.call(res, chunk, "binary", callback);
            };
        })(res.write);
        res.end = (function(override) {
            return function(chunk, encoding, callback) {
                override.call(res, chunk, "binary", callback);
            };
        })(res.end);
    }
}

function removeProblematicHeaders(proxyRes) {
    delete proxyRes.headers['content-security-policy'];
    delete proxyRes.headers['public-key-pins'];
}

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
        secure: false,
        cookieDomainRewrite: '',
        changeOrigin: true
    });

    proxy.on("proxyRes", handleBinaryStream);
    proxy.on("proxyRes", removeProblematicHeaders);
    proxy.on('error', function (err, req, res) {
        res.writeHead(500, {
            'Content-Type': 'text/plain'
        });
        res.end(`Error: ${err.message}`);
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
