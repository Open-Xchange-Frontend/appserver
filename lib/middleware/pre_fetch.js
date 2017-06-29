var fs = require('fs');
var path = require('path');
var url = require('url');
var mkdirp = require('mkdirp');
var express = require('express');

function protocolOf(server) {
    server = url.parse(server);
    return server.protocol === 'https:' ? require('https') : require('http');
}

function urlPathFor(moduleName, version) {
    if (/^\/(text|raw);/.test(moduleName)) {
        return 'v=' + version + '/apps/' + moduleName.replace(/^\/(text|raw);/, '');
    }
    return 'api/apps/load/' + version + ',' + moduleName.replace(/^apps\//, '');
}

function createPathFinder(fileName) {
    return function fileExists(basePath) {
        return new Promise(function (resolve, reject) {
            var filePath = path.join(basePath, fileName);
            fs.access(
                filePath,
                'r',
                (err) => err ? resolve(err) : reject(filePath)
            );
        });
    };
}

function createRemoteReadStream(request, urlPath) {
    return new Promise(function (resolve, reject) {
        var options = request.app.get('options'),
            server = url.parse(options.server),
            URL = url.resolve(server, urlPath),
            protocol = protocolOf(options.server);

        var opt = url.parse(URL);
        opt.headers = request.headers;
        delete opt.headers['accept-encoding'];
        delete opt.headers.host;
        opt.rejectUnauthorized = options.rejectUnauthorized;
        protocol.get(opt, function (res) {
            if (res.statusCode !== 200) return reject(res.statusMessage);
            resolve(res);
        })
        .on('error', reject);
    });
}

function readFromStream(options, request, fileName, urlPath) {
    var pathFinder = createPathFinder(
        //remove basePath, for local search
        fileName.replace(path.join(options.prefixes[0]), '')
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
        .then(
            () =>
                createRemoteReadStream(request, urlPath)
                    .catch((err) => options.verbose.proxy ? console.error(urlPath, err) : ''),
            (localFile) => fs.createReadStream(localFile)
        )
    ]);
}

function writeToStream(fileInfo) {
    var fileName = fileInfo[0];
    var readStream = fileInfo[1];

    return new Promise(function (resolve, reject) {
        readStream.pipe(fs.createWriteStream(fileName))
            .on('finish', () => resolve({ createdFile: fileName, from: readStream }))
            .on('error', reject);
    });
}

function fileExistsInBasepath(options, fileName) {
    return new Promise(function (resolve, reject) {
        if (!fileName) reject({});
        var filePath = path.join(options.prefixes[0], fileName);
        fs.access(
            filePath
            ,'wx',
            (err) => err ? resolve(err) : reject({})
        );
    });
}

function appsLoadFile(options, request, fileName, urlPath) {
    return fileExistsInBasepath(options, 'apps/' + fileName)
        .then(function (err) {
            if (err.code === 'ENOENT')
                return err.path;
            throw err;
        })
        .then((fileName) => readFromStream(options, request, fileName, urlPath))
        .then(writeToStream)
        .catch(() => '');
}

function appsLoad(request, response, next) {
    var URL = url.parse(request.url, true);
    var options = request.app.get('options');

    // parse request URL
    var list = URL.pathname.split(',');
    var version = list.shift();
    version = version.slice(version.lastIndexOf('/') + 1);
    request.app.set('version', version);

    Promise.all(list.map(function (moduleName) {
        var fileName = /^(?:\/(text|raw);)?([\w\/+-]+(?:\.[\w\/+-]+)*)$/.exec(moduleName)[2],
            urlPath = urlPathFor(moduleName, version);

        return appsLoadFile(options, request, fileName, urlPath)
        .then(function () {
            if (!/\.css$/.test(fileName)) return;

            fileName = fileName.replace(/themes\/[^/]+\//, '').replace(/\.css$/, '.less');
            urlPath = urlPath.replace(/themes\/[^/]+\//, '').replace(/\.css$/, '.less');

            return appsLoadFile(options, request, fileName, urlPath);
        })
    })).then(() => next());
}

function staticFiles(request, response, next) {
    var moduleName = request.params[0] || 'ui',
        options = request.app.get('options');
    return fileExistsInBasepath(options, moduleName)
        .then(function (err) {
            if (err.code === 'ENOENT')
                return err.path;
            throw err;
        })
        .then((fileName) => readFromStream(options, request, fileName, fileName))
        .then(writeToStream)
        .catch(() => '')
        .then(() => next());
}

function fetchManifests(options) {
    return fileExistsInBasepath(options, 'manifests/server.json')
        .then(function (err) {
            if (err.code === 'ENOENT')
                return err.path;
            throw err;
        })
        .then(function (fileName) {
            return new Promise(function (resolve, reject) {
                protocolOf(options.server).get(
                    url.parse(options.server + '/api/apps/manifests?action=config'),
                    function (res) {
                        if (res.statusCode !== 200) return reject(res.statusMessage);
                        resolve([fileName, res]);
                    }
                )
                .on('error', reject);
            });
        })
        .then(function (fileInfo) {
            return new Promise(function (resolve, reject) {
                mkdirp(path.dirname(fileInfo[0]), function (err) {
                    if (err) return reject(err);
                    resolve(fileInfo);
                });
            })
        })
        .then(writeToStream);
}

function create(options) {
    fetchManifests(options)
        .catch((err) => console.error('Unable to fetch manifests from server:', err));

    var app = express();

    app.set('options', options);

    app.get(options.urlPath + 'api/apps/load/**', appsLoad);

    // index (=> /ui)
    app.get(options.urlPath + '/', staticFiles);
    // static files
    app.get(options.urlPath + '/**', staticFiles);
    // static files with version parameter
    app.get(options.urlPath + 'v=:version/**', staticFiles);

    return app;
}

module.exports = {
    create: create
};
