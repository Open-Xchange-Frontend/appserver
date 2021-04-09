var url = require('url')
const ProxyServer = require('http-proxy').createProxyServer

module.exports = function (options) {
  // eslint-disable-next-line
  var server = url.parse(options.server.replace(options.urlPath, '').replace(/^http/, 'ws'))
  // eslint-disable-next-line
  var proxy = new ProxyServer({
    target: server,
    ws: true,
    secure: false
  })

  proxy.on('proxyReqWs', function (pReq, req, socket) {
    socket.on('error', function () {
      // silently catch any errors on the incoming socket,
      // will be forwarded by http-proxy via response
    })
  })

  proxy.on('error', function (e, req, res) {
    if (!res.writeable) return
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end(`Error: ${e.message}`)
  })

  return function (req, socket, head) {
    proxy.ws(req, socket, head)
  }
}
