
var util = require('util');
function pad(n) {
    return n < 10 ? '0' + n : n;
}
var tstream = require('stream').Transform;
function ReplaceVersionStream(options) {
    var t = options.buildTime;
    this.buildTime = '.' + t.getUTCFullYear() +
        pad(t.getUTCMonth() + 1) + pad(t.getUTCDate()) + '.' +
        pad(t.getUTCHours()) + pad(t.getUTCMinutes()) +
        pad(t.getUTCSeconds());
    tstream.call(this, options);
}
util.inherits(ReplaceVersionStream, tstream);
ReplaceVersionStream.prototype._transform = function (chunk, encoding, cb) {
    var buildTime = this.buildTime;
    this.push(chunk.toString().replace(/v=([0-9A-Za-z._-]*)\.[0-9]{8}\.[0-9]{6}/g, function (str, version) {
        return 'v=' + version + buildTime;
    }));
    cb();
};
function create(options) {
    var url = require('url');
    var fs = require('fs');

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
                pathname === '/signin')
            {
                var newestBuild = prefixes
                    .filter(fs.existsSync)
                    .map(function (p) {
                        return fs.statSync(p).mtime;
                    })
                    .reduce(function (acc, time) {
                        return (acc.getTime() < time.getTime()) ? time : acc;
                    }, new Date(0));

                var stream = new ReplaceVersionStream({buildTime: newestBuild});
                var zlib = require('zlib');
                switch (res.headers['content-encoding']) {
                    case 'gzip':
                        res.pipe(zlib.createGunzip())
                           .pipe(stream)
                           .pipe(zlib.createGzip());
                        break;
                    case 'deflate':
                        res.pipe(zlib.createInflate())
                           .pipe(stream)
                           .pipe(zlib.createDeflate());
                        break;
                    default:
                        res.pipe(stream);
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
