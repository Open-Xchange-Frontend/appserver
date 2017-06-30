const log = console,
    fs = require('fs'),
    path = require('path'),
    _ = require('underscore'),
    util = {
        promisify(func, opt) {
            const self = this;
            opt = _.extend({
                errIndex: 0,
            }, opt);
            return function () {
                const args = Array.prototype.slice.call(arguments, 0);
                return new Promise(function (resolve, reject) {
                    args.push(function () {
                        if (opt.errIndex >= 0 && arguments[opt.errIndex]) return reject(arguments[opt.errIndex]);
                        const data = _(arguments).without(arguments[opt.errIndex]);
                        if (data.length === 0) resolve();
                        else if (data.length === 1) resolve(data[0]);
                        else resolve(data);
                    });
                    func.apply(self, args);
                });
            };
        }
    },
    readdir = util.promisify(fs.readdir),
    readFile = util.promisify(fs.readFile),
    lstat = util.promisify(fs.lstat);

const createFixtures = (function () {
    function scanDir(dir) {
        return readdir(dir).then(
            // check, if files are directories
            files => Promise.all(files.map(file => lstat(path.join(dir, file)))).then(lstats => [files, lstats])
        ).then(([files, lstats]) =>
            // resolve file or subfolders
            Promise.all(
                files.map((file, index) => {
                    const isDir = lstats[index].isDirectory();
                    if (!isDir) return readFile(path.join(dir, file), 'utf8');
                    return scanDir(path.join(dir, file));
                })
            )
        ).then(list => {
            list = _(list).flatten();
            return list.map(item => {
                // parse to json, if string
                if (_(item).isString()) return JSON.parse(item);
                return item;
            })
        }).catch(err => {
            log.error(err);
        });
    }

    return function (dir) {
        const fixtures = scanDir(dir).then(list => {
            const cache = {};
            // prepare for use
            list.forEach(item => {
                const namespace = item.namespace || 'default',
                    store = cache[namespace] || [];
                store.push(item);
                cache[namespace] = store;
            });
            return cache;
        }).catch(() => {
            log.error('Could not find any fixtures. Try to configure the path to fixtures correctly.');
            return {};
        });

        return function getFixture(namespace, url) {
            namespace = namespace || 'default';
            // remove leading /
            if (namespace.indexOf('/') === 0) namespace = namespace.substr(1);
            return new Promise(function (resolve, reject) {
                fixtures.then(cache => {
                    if (!cache[namespace]) namespace = 'default';
                    if (!cache[namespace]) return reject();
                    const fix = _(cache[namespace]).find(fixture => new RegExp(fixture.request).test(url));
                    if (fix) return resolve(fix.response);
                    reject();
                }).catch(reject);
            });
        }
    };
}());

const express = require('express');

module.exports = {
    create: function create(options) {
        const app = express(),
            fixturesPath = path.isAbsolute(options.fixturesPath) ? options.fixturesPath : path.join(options.prefixes[0], options.fixturesPath);

        const getFixture = createFixtures(fixturesPath);

        app.all('*', function (req, res, next) {

            let prefix,
                postfix,
                url;

            if (req.url.indexOf(options.urlPath) >= 0) {
                [prefix, postfix] = req.url.split(options.urlPath);
                url = `${options.urlPath}${postfix ? postfix : ''}`;
            } else if (req.url.indexOf('v=') >= 0) {
                [prefix] = req.url.split('/v=');
                url = req.url.substr(prefix.length);
            } else {
                url = req.url;
            }

            req.url = url;

            getFixture(prefix, url).then(fix => {
                res.json(fix);
            }, () => {
                next();
            });

        });
        return app;
    }
};
