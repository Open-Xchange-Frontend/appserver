module.exports = {
    create: require('./server').create,
    tools: {
        unifyOptions: require('./server').unifyOptions,
        mirrorFile: require('./middleware/pre_fetch').mirrorFile
    },
    middleware: {
        appsload: require('./middleware/appsload').create,
        localfiles: require('./middleware/localfiles').create,
        manifests: require('./middleware/manifests').create,
        mockData: require('./middleware/fixtures').create,
        login: require('./middleware/login').create,
        preFetch: require('./middleware/pre_fetch').create,
        proxy: require('./middleware/proxy').create,
        wsProxy: require('./middleware/proxy').createWSProxy,
        ui: function create(options) {
            const app = require('express')();
            process.env.base_path = process.env.base_path || options.prefixes[0];
            process.env.base_url_path = process.env.base_url_path || options.urlPath;

            app.use(options.urlPath, require('@open-xchange/ui-middleware/src/middleware'));
            return app;
        }
    }
};
