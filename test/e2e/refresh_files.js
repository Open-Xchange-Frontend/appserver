const chai = require('chai')
const appserver = require('../../lib/appserver.js')
const path = require('path')
const nock = require('nock')
const mock = require('mock-fs')
const util = require('../lib/util')
const expect = require('chai').expect

describe('Refresh behaviour', function () {
  let server, fakeFS, backend
  before(async function () {
    if (!nock.isActive()) nock.activate()
    nock.disableNetConnect()
    nock.enableNetConnect('127.0.0.1')
    backend = nock('http://mock.backend/appsuite/')

    fakeFS = {
      node_modules: mock.load(path.resolve(__dirname, '../../node_modules'))
    }
    fakeFS[process.cwd() + '/test/fixtures'] = util.load('test/fixtures')
    mock(fakeFS)

    return new Promise(function (resolve) {
      server = appserver.create({
        prefixes: [
          'test/fixtures/build',
          'test/fixtures/prefix1',
          'test/fixtures/prefix2'
        ],
        server: 'http://mock.backend/appsuite/'
      }).once('listening', resolve)
    })
  })

  it('should update outdated files from local directories', function () {
    mock.restore()
    fakeFS[process.cwd() + '/test/fixtures'].build['testfile_second.txt'] = mock.file({
      mtime: 0,
      content: 'Too old to rock\'n\'roll, but too young to die.'
    })
    fakeFS[process.cwd() + '/test/fixtures'].prefix2['testfile_second.txt'] = mock.file({
      mtime: 1,
      content: fakeFS[process.cwd() + '/test/fixtures'].prefix2['testfile_second.txt']
    })
    mock(fakeFS)
    return chai.request(server)
      .get('/appsuite/v=7.10.x-xx/testfile_second.txt')
      .then(function (res) {
        expect(res).to.have.status(200)
        expect(res.text).to.have.match(/^success!/)
      })
  })

  afterEach(function () {
    backend.done()
  })

  after(function () {
    nock.cleanAll()
    nock.restore()
    mock.restore()
    server.close()
  })
})
