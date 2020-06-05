const chai = require('chai')
const appserver = require('../../lib/appserver.js')
const nock = require('nock')
const mock = require('mock-fs')
const util = require('../lib/util')
const expect = require('chai').expect

describe('Inject local data into login GET request', function () {
  let server, fakeFS, backend
  before(function (done) {
    if (!nock.isActive()) nock.activate()
    nock.disableNetConnect()
    nock.enableNetConnect('127.0.0.1')
    backend = nock('http://mock.backend/appsuite/')
    backend.get(/\/api\/login\?action=autologin/)
      .reply(200, '{ "rampup": { "serverConfig": { "manifests": [] }}}')

    fakeFS = {}
    fakeFS[process.cwd() + '/test/fixtures'] = util.load('test/fixtures')
    mock(fakeFS)

    server = appserver.create({
      prefixes: [
        'test/fixtures/prefix1',
        'test/fixtures/prefix2'
      ],
      manifests: [
        'test/fixtures/prefix2/manifests'
      ],
      server: 'http://mock.backend/appsuite/'
    }).once('listening', done)
  })

  it('should extend manifests', function () {
    return chai.request(server)
      .get('/appsuite/api/login?action=autologin&client=open-xchange-appsuite&rampup=true&rampUpFor=open-xchange-appsuite&version=7.10.4-0')
      .then(function (res) {
        expect(res).to.have.status(200)
        expect(res.text).to.match(/just a test/)
      })
  })

  after(function () {
    server.close()
    nock.cleanAll()
    nock.restore()
    mock.restore()
  })
})
