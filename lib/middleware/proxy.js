function create(options) {
    var url = require('url');

    var urlPath = options.urlPath;
    var verbose = options.verbose;
    var prefixes = options.prefixes;
    var index = options.index || 'core';

    //optionally prepend a /
    index = index.indexOf('/') === 0 ? index : '/' + index;

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
        //remove base directories
        pathname = pathname.replace(new RegExp('^' + urlPath), '/');
        //this is still needed for older grunt configs, that don't pass the correct path option when running tests
        pathname = pathname.replace(/^\/base\//, '/');

        pathname = pathname.replace(/^\/v=[^\/]+\//, '/');
        pathname = pathname.replace(/^\/$/, index);

        opt.method = request.method;
        opt.headers = request.headers;
        opt.headers.host = opt.host;
        opt.rejectUnauthorized = options.rejectUnauthorized;
        request.pipe(protocol.request(opt, function (res) {
            var cookies = res.headers['set-cookie'];
            if (cookies) {
                if (typeof cookies === 'string') cookies = [cookies];
                res.headers['set-cookie'] = cookies.map(function (s) {
                    return s.replace(/;\s*secure/i, '');
                });
            }

            var headers = res.headers;
            var statusCode = res.statusCode;

            if (pathname === '/core' ||
                pathname === '/ui' ||
                pathname === index ||
                pathname === '/signin' ||
                pathname === '/boot.js')
            {
                var zlib = require('zlib');
                var replace = require('../replace_version');
                var stream = (pathname === '/boot.js') ? replace.createPrependStream(prefixes) : replace.createReplaceStream(prefixes);

                //FIXME: leave (de-)compression to another module of the middleware
                //FIXME: needs refactoring and a better API
                switch (res.headers['content-encoding']) {
                    case 'gzip':
                        delete headers['content-length'];
                        delete headers['content-encoding'];
                        res = res.pipe(zlib.createGunzip())
                           .pipe(stream);
                        break;
                    case 'deflate':
                        delete headers['content-length'];
                        delete headers['content-encoding'];
                        res = res.pipe(zlib.createInflate())
                           .pipe(stream);
                        break;
                    default:
                        res = res.pipe(stream);
                        break;
                }
            }

            response.writeHead(statusCode, headers);
            res.pipe(response);
        }));
    };
}

module.exports = {
    create: create
};
