var fs = require('fs');
var path = require('path');
var url = require('url');
var mkdirp = require('mkdirp');
var express = require('express');

function urlPathFor(moduleName, version) {
    if (/^\/(text|raw);/.test(moduleName)) {
        return 'v=' + version + '/apps' + moduleName.replace(/^\/(text|raw);/, '');
    }
    return 'api/apps/load/' + version + ',' + moduleName;
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

function createRemoteReadStream(request, moduleName) {
    return new Promise(function (resolve, reject) {
        var options = request.app.get('options'),
            version = request.app.get('version'),
            server = url.parse(options.server),
            URL = url.resolve(server, urlPathFor(moduleName, version)),
            protocol = server.protocol === 'https:' ? require('https') : require('http');

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
}

function readFromStream(options, request, moduleName, fileName) {
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
        .then(
            () => createRemoteReadStream(request, moduleName),
            (localFile) => fs.createReadStream(localFile)
        )
    ]);
}

function writeToStream(fileInfo) {
    var fileName = fileInfo[0];
    var readStream = fileInfo[1];

    return new Promise(function (resolve, reject) {
        readStream.pipe(fs.createWriteStream(fileName))
            .on('finish', resolve)
            .on('error', reject);
    });
}

function fileExistsInBasepath(options, moduleName) {
    return new Promise(function (resolve, reject) {
        var fileName = /^(?:\/(text|raw);)?([\w\/+-]+(?:\.[\w\/+-]+)*)$/.exec(moduleName)[2];
        if (!fileName) reject({});
        var filePath = path.join(options.prefixes[0], 'apps', fileName);
        fs.access(
            filePath
            ,'wx',
            (err) => err ? resolve(err) : reject({})
        );
    });
}

function appsLoad(request, response, next) {
    var URL = url.parse(request.url, true);
    var options = request.app.get('options');

    // parse request URL
    var list = URL.pathname.split(',');
    var version = list.shift();
    version = version.slice(version.lastIndexOf('/'));
    request.app.set('version', version);

    Promise.all(list.map(function (moduleName) {
        return fileExistsInBasepath(options, moduleName)
        .then(function (err) {
            if (err.code === 'ENOENT')
                return err.path;
            throw err;
        })
        .then((fileName) => readFromStream(options, request, moduleName, fileName))
        .then(writeToStream)
        .catch(() => '');
    })).then(() => next());
}

function create(options) {
    var app = express();

    app.set('options', options);

    app.get(options.urlPath + 'api/apps/load/**', appsLoad);

    return app;
}

module.exports = {
    create: create
};
