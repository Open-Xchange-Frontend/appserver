const axios = require('axios')
const https = require('https')
const querystring = require('querystring')

module.exports = function (options) {
  const { urlPath, verbose, server, localManifestCache } = options

  const loginPath = `${server ? urlPath : '/'}api/login`

  if (server && !/^https?:/.test(new URL(server).protocol)) return console.error('Server must be an HTTP(S) URL')

  return function proxyLogin (request, response, next) {
    if (!server) {
      console.error('Login proxy requires --server')
      response.writeHead(501, 'Login proxy requires --server', { 'Content-Type': 'text/plain' })
      response.end('Login proxy requires --server')
      return next()
    }
    const remoteURL = new URL(request.url, server)
    const isGetRampup = request.method === 'GET' && remoteURL.searchParams.get('rampup') === 'true'
    const isPostLogin = request.method === 'POST'
    if (!(isGetRampup || isPostLogin)) { return next() }
    request.headers.host = remoteURL.host
    remoteURL.pathname = loginPath
    delete request.headers['accept-encoding']
    try {
      axios({
        url: remoteURL.href,
        method: request.method.toLowerCase(),
        headers: request.headers,
        data: querystring.stringify(request.body),
        transformResponse: [(data, headers) => {
          const cookies = headers['set-cookie']
          if (cookies) headers['set-cookie'] = [cookies].flat().map(cookie => cookie.replace(/\sdomain=[^;]*;?/ig, '').replace(/\ssecure;?/ig, ''))
          if (isGetRampup) return JSON.parse(data)
          return data
        }],
        httpsAgent: new https.Agent({ rejectUnauthorized: options.rejectUnauthorized }),
        responseType: request.method === 'POST' ? 'stream' : 'json'
      }).then(async res => {
        if (request.method === 'POST') {
          response.writeHead(res.status, res.headers)
          return res.data.pipe(response)
        }
        if (isGetRampup) {
          if (res.data.error || !res.data.rampup) {
            if (verbose.local) console.log('Invalid/no rampup data received from backend.')
            return response.type('json').end(JSON.stringify(res.data, null, 4))
          }

          const serverManifestsMap = Object.fromEntries(res.data.rampup.serverConfig.manifests.map(manifest => [manifest.path, manifest]))
          const mergedManifests = Object.values({ ...serverManifestsMap, ...localManifestCache })
          if (verbose.local) console.log('Manifests: ', mergedManifests.length, mergedManifests)
          res.data.rampup.serverConfig.manifests = mergedManifests
          return response.type('json').end(JSON.stringify(res.data, null, 4))
        }
      })
    } catch (err) { console.log(err) }
  }
}
