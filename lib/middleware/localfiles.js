'use strict'

const fs = require('fs')
const path = require('path')
const mime = require('serve-static').mime

;(function (module) {
  function charset (type) {
    var t = mime.charsets.lookup(type)
    return t ? ';charset=' + t : ''
  }

  function create (options) {
    var verbose = options.verbose
    var prefixes = options.prefixes
    var urlPath = options.urlPath || '/appsuite/'
    var index = options.index || 'core'

    // optionally prepend a /
    index = index.indexOf('/') === 0 ? index : '/' + index

    return function (request, response, next) {
      if (!/^GET|HEAD$/.test(request.method)) return next()
      let pathname = new URL(request.url, options.server).pathname
      var filename
      var type

      if (new RegExp(urlPath + 'api/').test(pathname)) {
        return next()
      }

      // remove base directories
      pathname = pathname.replace(new RegExp('^' + urlPath), '/')
      // this is still needed for older grunt configs, that don't pass the correct path option when running tests
      pathname = pathname.replace(/^\/base\//, '/')

      pathname = pathname.replace(/^\/v=[^/]+\//, '/')
      pathname = pathname.replace(/^\/$/, index)
      filename = prefixes.map(function (p) {
        return path.join(p, pathname)
      })
        .filter(function (filename) {
          return (fs.existsSync(filename) && fs.statSync(filename).isFile())
        })[0]
      if (!filename) {
        if (verbose.local || verbose['local:error']) console.log('localfile not found: ', pathname)
        return next()
      }

      var stream = fs.createReadStream(filename)
      var replaceVersion
      if (pathname === '/ui' || pathname === '/core' || pathname === '/signin') {
        type = 'text/html'
        replaceVersion = require('../replace_version').createReplaceStream(prefixes)
        stream = stream.pipe(replaceVersion)
      } else if (pathname === '/boot.js') {
        replaceVersion = require('../replace_version').createPrependStream(prefixes)
        stream = stream.pipe(replaceVersion)
        type = mime.lookup(filename)
      } else {
        type = mime.lookup(filename)
      }
      // set headers
      if (verbose.local) console.log(filename)
      response.setHeader('Content-Type', type + charset(type))
      response.setHeader('Expires', '0')
      stream.pipe(response)
      return true
    }
  }

  module.exports = {
    create
  }
}(module))
