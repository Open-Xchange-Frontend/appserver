const axios = require('axios')
const https = require('https')
const querystring = require('querystring')

module.exports = function (options) {
  const { urlPath, verbose, server, localManifestCache } = options

  const manifestsPath = `${server ? urlPath : '/'}api/apps/manifests`

  if (server && !/^https?:/.test(new URL(server).protocol)) return console.error('Server must be an HTTP(S) URL')

  return function injectManifests (request, response, next) {
    if (!server) {
      console.error('Manifests requires --server')
      response.writeHead(501, 'Manifests requires --server', { 'Content-Type': 'text/plain' })
      response.end('Manifests requires --server')
      return next()
    }

    const remoteURL = new URL(request.url.slice(urlPath.length), server)
    const isGetManifests = remoteURL.pathname === manifestsPath && request.method === 'GET' && remoteURL.searchParams.get('action') === 'config'
    if (!isGetManifests) { return next() }
    request.headers.host = remoteURL.host
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
          return JSON.parse(data)
        }],
        httpsAgent: new https.Agent({ rejectUnauthorized: options.rejectUnauthorized }),
        responseType: 'json'
      }).then(async res => {
        if (res.data.error || !res.data.data) {
          if (verbose.local) console.log('Invalid/no rampup data received from backend.')
          return response.end(JSON.stringify(res.data, null, 4))
        }

        const serverManifestsMap = Object.fromEntries(res.data.data.manifests.map(manifest => [manifest.path, manifest]))
        const mergedManifests = Object.values({ ...serverManifestsMap, ...localManifestCache })
        if (verbose.local) console.log('Manifests: ', mergedManifests.length, mergedManifests)
        res.data.data.manifests = mergedManifests
        return response.end(JSON.stringify(res.data, null, 4))
      })
    } catch (err) { console.log(err) }
  }
}
