'use strict';

(function (module) {
    var fs = require('fs');

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

    module.exports = {
        createStream: function (prefixes) {
            var newestBuild = prefixes
                .filter(fs.existsSync)
                .map(function (p) {
                    return fs.statSync(p).mtime;
                })
                .reduce(function (acc, time) {
                    return (acc.getTime() < time.getTime()) ? time : acc;
                }, new Date(0));

            return new ReplaceVersionStream({buildTime: newestBuild});
        }
    };
}(module));
