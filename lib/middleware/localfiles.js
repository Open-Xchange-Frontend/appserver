'use strict';

(function (module) {
    var fs = require('fs');
    var url = require('url');
    var path = require('path');
    var mime = require('connect').static.mime;

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

            var stream = fs.createReadStream(filename);
            if (pathname === '/core' || pathname === '/signin') {
                type = 'text/html';
                var replaceVersion = require('../replace_version').createStream(prefixes);
                stream = stream.pipe(replaceVersion);
            } else {
                type = mime.lookup(filename);
            }
            // set headers
            if (verbose.local) console.log(filename);
            response.setHeader('Content-Type', type + charset(type));
            response.setHeader('Expires', '0');
            stream.pipe(response);
            return true;
        };
    }

    module.exports = {
        create: create
    };
}(module));
