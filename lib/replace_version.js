'use strict';

(function (module) {
    var fs = require('fs');

    var util = require('util');
    function pad(n) {
        return n < 10 ? '0' + n : n;
    }
    function buildTime(t) {
        return '.' + t.getUTCFullYear() +
            pad(t.getUTCMonth() + 1) + pad(t.getUTCDate()) + '.' +
            pad(t.getUTCHours()) + pad(t.getUTCMinutes()) +
            pad(t.getUTCSeconds());
    }
    var tstream = require('stream').Transform;
    function ReplaceVersionStream(options) {
        var t = options.buildTime;
        this.buildTime = buildTime(t);
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
    function PrependVersionStream(options) {
        this.buildTime = buildTime(options.buildTime);
        this._prepended = false;
        tstream.call(this, options);
    }
    util.inherits(PrependVersionStream, tstream);
    PrependVersionStream.prototype._transform = function (chunk, encoding, cb) {
        if (!this._prepended) {
            var ox = {
                base: 'v=7.x.x' + this.buildTime,
                version: '7.x.x' + this.buildTime
            };
            this._prepended = true;
            this.push('if (!window.ox) window.ox = {};');
            //TODO: if ox object gets larger (for whatever reason), add a loop here
            this.push('window.ox.base = "' + ox.base + '";');
            this.push('window.ox.version = "' + ox.version + '";');
        }
        this.push(chunk);
        cb();
    };
    function newestBuild(prefixes) {
        return prefixes
            .filter(fs.existsSync)
            .map(function (p) {
                return fs.statSync(p).mtime;
            })
            .reduce(function (acc, time) {
                return (acc.getTime() < time.getTime()) ? time : acc;
            }, new Date(0));
    }

    module.exports = {
        createReplaceStream: function (prefixes) {
            return new ReplaceVersionStream({buildTime: newestBuild(prefixes)});
        },
        createPrependStream: function (prefixes) {
            return new PrependVersionStream({buildTime: newestBuild(prefixes)});
        }
    };
}(module));
