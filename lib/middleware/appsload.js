const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const escape = require('../common').escape
const normalizePath = require('../common').normalizePath

function create (options) {
  var verbose = options.verbose
  var prefixes = options.prefixes
  var tzModule = 'io.ox/core/date/tz/zoneinfo/'
  var tzPath = [normalizePath(options.zoneinfo || '/usr/share/zoneinfo/')]

  var appsLoadPath = '/api/apps/load/'
  var urlPath = options.urlPath

  var protocol

  if (options.server) {
    const server = new URL(options.server)
    if (!/^https?:/.test(server.protocol)) return console.error('Server must be an HTTP(S) URL')

    protocol = server.protocol === 'https:' ? https : http
    appsLoadPath = urlPath + appsLoadPath.slice(1)
  }

  return function appsLoad (request, response, next) {
    // invalid module name
    function invalid (fullName) {
      return function () {
        console.log('Invalid module name: ' + fullName)
        response.write('console.log(\'Invalid module name: ' +
                               escape(fullName) + '\');\n')
      }
    }

    // remote file
    function remote (filename, fullName, name) {
      if (!options.server) {
        return function () {
          if (verbose.remote) console.log('Could not read', filename)
          response.write(
            `define('${escape(fullName)}', function () { console.log("Could not read '${escape(name)}'"); throw new Error("Could not read '${escape(name)}'"); });`
          )
        }
      }
      remoteCounter++
      var chunks = []
      var opt = new URL(`api/apps/load/${version},${fullName}`, options.server)
      opt.headers = request.headers
      delete opt.headers['accept-encoding']
      delete opt.headers.host
      opt.rejectUnauthorized = options.rejectUnauthorized
      protocol.get(opt, ok).on('error', error)
      return function () {
        if (verbose.remote) console.log(opt)
        for (var i = 0; i < chunks.length; i++) response.write(chunks[i])
      }
      function ok (res) {
        if (res.statusCode === 200) {
          res.on('data', chunk).on('end', end)
        } else {
          res.resume()
          console.log('HTTP error ' + res.statusCode + ' for ' + opt)
          chunk('console.log(\'HTTP error ' + res.statusCode + '\');\n')
          end()
        }
      }
      function error (e) {
        console.log('Server error for ' + url + ' : ' + e.message)
        chunk('console.log(\'Server error: ' + e.message + '\');\n')
        end()
      }
      function chunk (data) { chunks.push(data) }
      function end () { if (!--remoteCounter) complete() }
    }

    // normal RequireJS module
    function module (filename) {
      return function () {
        if (verbose.local) console.log(filename)
        response.write(fs.readFileSync(filename) + '\n/*:oxsep:*/\n')
      }
    }

    // raw data as string (e.g. timezones)
    function raw (filename, fullName) {
      return function () {
        if (verbose.local) console.log(filename)
        var data = fs.readFileSync(filename); var s = []
        for (var j = 0; j < data.length; j++) s.push(data[j])
        s = String.fromCharCode.apply(String, s)
        response.write('define(\'' + escape(fullName) + '\',\'' + escape(s) +
                    '\');\n/*:oxsep:*/\n')
      }
    }

    // text file as a string (e.g. CSS)
    function text (filename, fullName) {
      return function () {
        if (verbose.local) console.log(filename)
        var s = fs.readFileSync(filename, 'utf8')
        response.write('define(\'' + escape(fullName) + '\',\'' + escape(s) +
                    '\');\n/*:oxsep:*/\n')
      }
    }

    // send reply
    function complete () {
      // set headers
      response.setHeader('Content-Type', 'text/javascript;charset=UTF-8')
      response.setHeader('Expires', '0')

      // send data
      for (var i = 0; i < files.length; i++) files[i]()

      // all done
      response.end()
      if (verbose.local || verbose.remote) console.log()
    }

    var url = new URL(request.url, options.server)
    if ((request.method !== 'GET') ||
      (url.pathname.slice(0, appsLoadPath.length) !== appsLoadPath)) {
      return next()
    }

    // parse request URL
    var list = url.pathname.split(',')
    var version = list.shift()
    version = version.slice(version.lastIndexOf('v='))

    // find local files, request unknown files from server
    var files = []; var remoteCounter = 0
    for (var i in list) {
      var m = /^(?:\/(text|raw);)?([\w/+-]+(?:\.[\w/+-]+)*)$/.exec(list[i])
      var isTZ = m && m[2].slice(0, tzModule.length) === tzModule
      var paths; var name; var filename
      if (!m) {
        files.push(invalid(list[i]))
        continue
      }
      if (isTZ) {
        paths = tzPath
        name = m[2].slice(tzModule.length)
      } else {
        paths = prefixes
        name = m[2]
      }
      var j
      for (j = 0; j < paths.length; j++) {
        filename = path.join(paths[j], isTZ ? '' : 'apps', name)

        if (fs.existsSync(filename) && fs.statSync(filename).isFile()) {
          break
        }
      }
      files.push(j >= paths.length ? remote(filename, list[i], m[2])
        : !m[1] ? module(filename, list[i])
          : m[1] === 'raw' ? raw(filename, list[i])
            : text(filename, list[i]))
    }
    if (!remoteCounter) complete()
  }
}

module.exports = {
  create: create
}
