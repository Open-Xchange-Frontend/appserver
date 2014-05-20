'use strict';

(function (module) {
    var fs = require('fs');
    var url = require('url');
    var path = require('path');
    var mime = require('connect').static.mime;

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

    function charset(type) {
        var t = mime.charsets.lookup(type);
        return t ? ';charset=' + t : '';
    }

    function create(options) {
        var verbose = options.verbose;
        var prefixes = options.prefixes;

        return function (request, response, next) {
            if ('GET' != request.method && 'HEAD' != request.method) {
                return next();
            }
            var pathname = url.parse(request.url).pathname,
                filename,
                type;

            if (/\/appsuite\/api\//.test(pathname)) {
                return next();
            }

            //remove base directories (only /appsuite/ and /base/)
            //TODO: handle custom base directories (?)
            pathname = pathname.replace(/^\/appsuite\//, '/');
            pathname = pathname.replace(/^\/base\//, '/');

            pathname = pathname.replace(/^\/v=[^\/]+\//, '/');
            pathname = pathname.replace(/^\/$/, '/core');
            filename = prefixes.map(function (p) {
                return path.join(p, pathname);
            })
            .filter(function (filename) {
                return (path.existsSync(filename) && fs.statSync(filename).isFile());
            })[0];
            if (!filename) {
                if (verbose.local || verbose['local:error']) console.log('localfile not found: ', pathname);
                return next();
            }

            var stream;
            if (pathname === '/core' || pathname === '/signin') {
                var fileStream = fs.createReadStream(filename);
                type = 'text/html';
                var newestBuild = prefixes
                    .filter(fs.existsSync)
                    .map(function (p) {
                        return fs.statSync(p).mtime;
                    })
                    .reduce(function (acc, time) {
                        return (acc.getTime() < time.getTime()) ? time : acc;
                    }, new Date(0));

                stream = new ReplaceVersionStream({buildTime: newestBuild});
                fileStream.pipe(stream);
            } else {
                type = mime.lookup(filename);
                stream = fs.createReadStream(filename);
            }
            // set headers
            if (verbose.local) console.log(filename);
            response.setHeader('Content-Type', type + charset(type));
            response.setHeader('Expires', '0');
            stream.pipe(response);
            stream.on('end', function () {
                response.end();
            });
            return true;
        };
    }

    module.exports = {
        create: create
    };
}(module));
