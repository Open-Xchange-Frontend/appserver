function create(options) {
    var url = require('url');

    var urlPath = options.urlPath;
    var verbose = options.verbose;
    var prefixes = options.prefixes;

    var server;
    var protocol;

    if (options.server) {
        server = url.parse(options.server);
        if (server.protocol !== 'http:' && server.protocol !== 'https:') {
            console.error('Server must be an HTTP(S) URL');
            return;
        }
        protocol = server.protocol === 'https:' ? require('https') : require('http');
    }

    return function proxy(request, response, next) {
        var URL = request.url;
        if (!options.server) {
            console.log('No --server specified to forward', URL);
            response.writeHead(501, 'No --server specified',
                { 'Content-Type': 'text/plain' });
            response.end('No --server specified');
            return next();
        }
        if (URL.slice(0, urlPath.length) === urlPath) {
            URL = URL.slice(urlPath.length);
        }
        URL = url.resolve(options.server, URL);
        if (verbose.proxy) {
            console.log(URL);
            console.log();
        }
        var opt = url.parse(URL);
        var pathname = opt.pathname;
        //remove base directories (only /appsuite/ and /base/)
        //TODO: handle custom base directories (?)
        pathname = pathname.replace(/^\/appsuite\//, '/');
        pathname = pathname.replace(/^\/base\//, '/');

        pathname = pathname.replace(/^\/v=[^\/]+\//, '/');
        pathname = pathname.replace(/^\/$/, '/core');

        opt.method = request.method;
        opt.headers = request.headers;
        opt.headers.host = opt.host;
        request.pipe(protocol.request(opt, function (res) {
            var cookies = res.headers['set-cookie'];
            if (cookies) {
                if (typeof cookies === 'string') cookies = [cookies];
                res.headers['set-cookie'] = cookies.map(function (s) {
                    return s.replace(/;\s*secure/i, '');
                });
            }
            response.writeHead(res.statusCode, res.headers);
            if (pathname === '/core' ||
                pathname === '/signin' ||
                pathname === '/boot.js')
            {
                var zlib = require('zlib');
                var replace = require('../replace_version');
                var stream = (pathname === '/boot.js') ? replace.createPrependStream(prefixes) : replace.createReplaceStream(prefixes);
                switch (res.headers['content-encoding']) {
                    case 'gzip':
                        res = res.pipe(zlib.createGunzip())
                           .pipe(stream)
                           .pipe(zlib.createGzip());
                        break;
                    case 'deflate':
                        res = res.pipe(zlib.createInflate())
                           .pipe(stream)
                           .pipe(zlib.createDeflate());
                        break;
                    default:
                        res = res.pipe(stream);
                        break;
                }
            }
            res.pipe(response);
        }));
    };
}

module.exports = {
    create: create
};
