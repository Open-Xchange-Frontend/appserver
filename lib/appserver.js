const http = require('http')
const connect = require('connect')
const bodyparser = require('body-parser')
const localManifests = require('./localManifests')

const normalizePath = (path) => {
  if (path.slice(-1) !== '/') path += '/'
  return path
}

function unifyOptions (options) {
  options.verbose = (options.verbose || []).reduce((opt, val) => {
    if (val === 'all') opt.local = opt.remote = opt.proxy = true
    else opt[val] = true
    return opt
  }, {})
  options.prefixes = [...options.prefixes].map(normalizePath)
  options.manifests = [...options.manifests].map(normalizePath)
  options.urlPath = normalizePath(options.path || '/appsuite')

  // default to true, but allow custom option
  options.rejectUnauthorized = options.rejectUnauthorized === undefined || options.rejectUnauthorized

  if (options.server) options.server = normalizePath(options.server)
  return options
}

module.exports = {
  create (options) {
    options = unifyOptions(options)
    localManifests().then(update => { options.localManifestCache = update })

    const handler = connect()
      .use(require('./middleware/pre_fetch').create(options))
      .use(require('./middleware/manifests')(options))
      .use(require('./middleware/login')(options))
      .use(require('./middleware/proxy')(options))

    return http.createServer(handler).listen(options.port || 8338)
  },
  tools: {
    unifyOptions, // Used in shared-grunt-config
    mirrorFile: require('./middleware/pre_fetch').mirrorFile // unused?
  },
  middleware: {
    bodyparser,
    manifests: require('./middleware/manifests'),
    mockData: require('./middleware/fixtures'),
    login: require('./middleware/login'),
    preFetch: require('./middleware/pre_fetch').create,
    proxy: require('./middleware/proxy'),
    wsProxy: require('./middleware/proxyWs'),
    ui: function create (options) {
      const app = require('express')()
      process.env.base_path = process.env.base_path || options.prefixes[0]
      process.env.base_url_path = process.env.base_url_path || options.urlPath

      app.use(options.urlPath, require('@open-xchange/ui-middleware/src/middleware'))
      return app
    }
  }
}
