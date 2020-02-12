function lock() {
    var counter = 1, cb;
    var L = function (f) {
        counter++;
        return function () {
            var retval = f.apply(this, arguments);
            if (!--counter) cb();
            return retval;
        };
    };
    L.done = function (callback) {
        cb = callback;
        if (!--counter) cb();
    };
    return L;
}

function create(options) {
    var fs = require('fs');
    var http = require('http');
    var https = require('https');
    var url = require('url');
    var path = require('path');

    var verbose = options.verbose;
    var manifests = options.manifests.filter(function (dir) {
        var include = false;

        try {
            include = fs.statSync(dir).isDirectory();
        } catch (e) {}
        if (!include && verbose.local) {
            console.log('Ignoring', dir, ' as manifest directory.');
        }
        return include;
    });
    var urlPath = options.urlPath;

    var manifestsPath = '/api/apps/manifests';

    var server;
    var protocol;


    if (options.server) {
        server = url.parse(options.server);
        if (server.protocol !== 'http:' && server.protocol !== 'https:') {
            console.error('Server must be an HTTP(S) URL');
            return;
        }
        protocol = server.protocol === 'https:' ? https : http;
        manifestsPath = urlPath + manifestsPath.slice(1);
    }

    return function injectManifests(request, response, next) {
        var URL = url.parse(request.url, true);
        if ((request.method !== 'GET') ||
            (URL.pathname !== manifestsPath) ||
            (URL.query.action !== 'config')) {

            return next();
        }

        if (!options.server) {
            console.error('Manifests require --server');
            response.writeHead(501, 'Manifests require --server',
                { 'Content-Type': 'text/plain' });
            response.end('Manifests require --server');
            return next();
        }
        var remoteUrl = url.resolve(options.server, request.url.slice(urlPath.length));
        var opt = url.parse(remoteUrl, true);
        opt.headers = request.headers;
        opt.headers.host = opt.host;
        delete opt.headers['accept-encoding'];
        opt.rejectUnauthorized = options.rejectUnauthorized;
        protocol.request(opt, function (res) {
            if (res.statusCode !== 200) {
                response.writeHead(res.statusCode, res.headers);
                res.pipe(response);
                return;
            }
            var reply = [], map = {}, L = lock();
            res.on('data', data).on('end', end);
            function data(chunk) { reply.push(chunk); }
            function end() {
                reply = JSON.parse(reply.join(''));
                if (reply.error) {
                    response.end(JSON.stringify(reply, null, 4));
                    return;
                }
                var list = reply.data.manifests;
                for (var i in list) map[list[i].path] = list[i];
                manifests.forEach(readDir);
                L.done(sendReply);
            }
            function readDir(dir) {
                fs.readdir(dir, L(function (err, files) {
                    if (err) return console.error(err.message);
                    files = files.filter(str => /\.json$/i.test(str));
                    files.forEach(function (file) {
                        file = path.join(dir, file);
                        if (verbose.local) console.log(file);
                        fs.readFile(file, 'utf8', L(addManifest));
                    });
                }));
            }
            function addManifest(err, manifest) {
                if (err) return console.error(err.message);
                manifest = Function('return (' + manifest + ')')();
                if (!(manifest instanceof Array)) manifest = [manifest];
                for (var i in manifest) map[manifest[i].path] = manifest[i];
            }
            function sendReply() {
                var list = reply.data.manifests = [];
                for (var i in map) {
                    list.push(map[i]);
                }
                response.end(JSON.stringify(reply, null, 4));
                if (verbose.local) console.log();
            }
        }).end();
    };
}

module.exports = {
    create: create
};
