const url = require('url')
const ProxyServer = require('http-proxy').createProxyServer

function handleBinaryStream (proxyRes, req, res) {
  res.write = (function (override) {
    return function (chunk, encoding, callback) {
      override.call(res, chunk, 'binary', callback)
    }
  })(res.write)
  res.end = (function (override) {
    return function (chunk, encoding, callback) {
      override.call(res, chunk, 'binary', callback)
    }
  })(res.end)
}

function removeProblematicHeaders (proxyRes) {
  delete proxyRes.headers['content-security-policy']
  delete proxyRes.headers['public-key-pins']
}

module.exports = function (options) {
  let server
  if (options.server) {
    // eslint-disable-next-line
    server = url.parse(options.server.replace(options.urlPath, ''))
    if (!/^https?:/.test(server.protocol)) return console.error('Server must be an HTTP(S) URL')
  }

  const proxy = new ProxyServer({
    target: server,
    secure: false,
    cookieDomainRewrite: '',
    changeOrigin: true,
    autoRewrite: true
  })

  proxy.on('proxyRes', handleBinaryStream)
  proxy.on('proxyRes', removeProblematicHeaders)
  proxy.on('error', function (err, req, res) {
    if (!res.writeable) return
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end(`Error: ${err.message}`)
  })

  return (request, response) => proxy.web(request, response)
}
