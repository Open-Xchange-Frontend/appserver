const normalizePath = require('./common').normalizePath

function unifyOptions (options) {
  options.verbose = (options.verbose || []).reduce(function (opt, val) {
    if (val === 'all') {
      opt.local = opt.remote = opt.proxy = true
    } else {
      opt[val] = true
    }
    return opt
  }, {})
  options.prefixes = [].concat.apply([], options.prefixes).map(normalizePath)
  options.manifests = [].concat.apply([], options.manifests).map(normalizePath)
  options.urlPath = normalizePath(options.path || '/appsuite')

  // default to true, but allow custom option
  options.rejectUnauthorized = options.rejectUnauthorized === undefined || options.rejectUnauthorized

  if (options.server) {
    options.server = normalizePath(options.server)
  }
  return options
}

const http = require('http')
const connect = require('connect')
const appsLoadMiddleware = require('./middleware/appsload')
const manifestsMiddleware = require('./middleware/manifests')
const loginMiddleware = require('./middleware/login')
const localFilesMiddleware = require('./middleware/localfiles')
const proxyMiddleware = require('./middleware/proxy')
const preFetchMiddleware = require('./middleware/pre_fetch')

function create (options) {
  options = unifyOptions(options)

  const handler = connect()
    .use(preFetchMiddleware.create(options))
    .use(appsLoadMiddleware.create(options))
    .use(manifestsMiddleware.create(options))
    .use(loginMiddleware.create(options))
    .use(localFilesMiddleware.create(options))
    .use(proxyMiddleware.create(options))

  return http.createServer(handler)
    .listen(options.port || 8337)
}

module.exports = {
  create: create,
  unifyOptions: unifyOptions
}
