function unifyOptions(options) {
    var normalizePath = require('./common').normalizePath;
    var _ = require('underscore');

    var verbose = options.verbose = (options.verbose || []).reduce(function (opt, val) {
        if (val === 'all') {
            opt.local = opt.remote = opt.proxy = true;
        } else {
            opt[val] = true;
        }
            return opt;
    }, {});
    options.prefixes = _(options.prefixes).flatten();
    options.manifests = _(options.manifests).flatten();
    options.urlPath = normalizePath(options.path || '/appsuite');

    if (options.server) {
        options.server = normalizePath(options.server);
    }
    return options;
}

function create(options) {
    var http = require('http');
    var connect = require('connect');
    var appsLoadMiddleware = require('./middleware/appsload');
    var manifestsMiddleware = require('./middleware/manifests');
    var localFilesMiddleware = require('./middleware/localfiles');
    var proxyMiddleware = require('./middleware/proxy');

    options = unifyOptions(options);

    var handler = connect()
        .use(appsLoadMiddleware.create(options))
        .use(manifestsMiddleware.create(options))
        .use(localFilesMiddleware.create(options))
        .use(proxyMiddleware.create(options));

    http.createServer(handler)
        .listen(options.port || 8337);
}

module.exports = {
    create: create,
    unifyOptions: unifyOptions
};
