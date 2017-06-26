var fs = require('fs');
var path = require('path');
var url = require('url');
var mkdirp = require('mkdirp');

function urlPathFor(module, version) {
    if (/^\/(text|raw);/.test(module)) {
        return 'v=' + version + '/apps' + module.replace(/^\/(text|raw);/, '');
    }
    return 'api/apps/load/' + version + ',' + module;
}

function createPathFinder(fileName) {
    return function fileExists(basePath) {
        return new Promise(function (resolve, reject) {
            var filePath = path.join(basePath, 'apps', fileName);
            fs.access(
                filePath,
                'r',
                (err) => err ? resolve(err) : reject(filePath)
            );
        });
    };
}

function create(options) {
    var server, protocol;
    var appsLoadPath = '/api/apps/load/';
    var urlPath = options.urlPath;

    if (options.server) {
        server = url.parse(options.server);
        if (server.protocol !== 'http:' && server.protocol !== 'https:') {
            console.error('Server must be an HTTP(S) URL');
            return;
        }
        protocol = server.protocol === 'https:' ? require('https') : require('http');
        appsLoadPath = urlPath + appsLoadPath.slice(1);
    }

    return function preFetch(request, response, next) {
        var URL = url.parse(request.url, true);
        if ((request.method !== 'GET') ||
            (URL.pathname.slice(0, appsLoadPath.length) !== appsLoadPath) ||
            !server) {

            return next();
        }

        // parse request URL
        var list = URL.pathname.split(',');
        var version = list.shift();
        version = version.slice(version.lastIndexOf('v='));

        Promise.all(list.map(function (module) {
            return new Promise(function (resolve, reject) {
                var fileName = /^(?:\/(text|raw);)?([\w\/+-]+(?:\.[\w\/+-]+)*)$/.exec(module)[2];
                if (!fileName) reject({});
                var filePath = path.join(options.prefixes[0], 'apps', fileName);
                fs.access(
                    filePath
                    ,'wx',
                    (err) => err ? resolve(err) : reject({})
                );
            })
            .then(function (err) {
                if (err.code === 'ENOENT')
                    return err.path;
                throw err;
            })
            .then(function (fileName) {
                var pathFinder = createPathFinder(
                    //remove basePath, for local search
                    fileName.replace(path.join(options.prefixes[0], 'apps'), '')
                );
                return Promise.all([
                    new Promise(function (resolve, reject) {
                        mkdirp(path.dirname(fileName), function (err) {
                            if (err) return reject();
                            resolve(fileName);
                        });
                    }),
                    Promise.all(
                        options.prefixes.slice(1)
                            .map(pathFinder)
                    )
                    .then(function createReadStream() {
                        return new Promise(function (resolve, reject) {
                            var URL = url.resolve(options.server,
                                urlPathFor(module, version));
                            var opt = url.parse(URL);
                            opt.headers = request.headers;
                            delete opt.headers['accept-encoding'];
                            delete opt.headers.host;
                            opt.rejectUnauthorized = options.rejectUnauthorized;
                            protocol.get(opt, function (res) {
                                resolve(res);
                            })
                            .on('error', reject);
                        });
                    }, function createLocalReadStream(localFile) {
                        return fs.createReadStream(localFile);
                    })
                ]);
            })
            .then(function writeStream(fileInfo) {
                var fileName = fileInfo[0];
                var readStream = fileInfo[1];

                return new Promise(function (resolve, reject) {
                    readStream.pipe(fs.createWriteStream(fileName))
                        .on('finish', resolve)
                        .on('error', reject);
                });
            })
            .catch(() => '');
        })).then(() => next());
    };
}

module.exports = {
    create: create
};
