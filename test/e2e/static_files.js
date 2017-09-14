const chai = require('chai'),
    appserver = require('../../lib/server.js'),
    nock = require('nock'),
    mock = require('mock-fs'),
    util = require('../lib/util'),
    expect = require('chai').expect;

describe('Serve files from multiple locations', function () {
    let server, backend;
    before(function (done) {
        nock.disableNetConnect();
        nock.enableNetConnect('127.0.0.1');
        backend = nock('http://mock.backend/appsuite/')
            .get('/api/apps/manifests?action=config')
            .reply(200, '{ "data": { "manifests": [] }}');

        const files = {};
        files[process.cwd() + '/test/fixtures'] = util.load('test/fixtures');
        mock(files);

        server = appserver.create({
            prefixes: [
                'test/fixtures/prefix1',
                'test/fixtures/prefix2'
            ],
            server: 'http://mock.backend/appsuite/'
        }).once('listening', done);
    });

    it('should load files from first directory in prefixes', function () {
        return chai.request(server)
            .get('/appsuite/v=7.10.x-xx/testfile.txt')
            .then(function (res) {
                expect(res).to.have.status(200);
                expect(res.text).to.have.match(/^success!/);
            });
    });
    it('should load files from second directory in prefixes', function () {
        expect('test/fixtures/prefix1/testfile_second.txt').to.not.be.a.path('before the request');
        return chai.request(server)
            .get('/appsuite/v=7.10.x-xx/testfile_second.txt')
            .then(function (res) {
                expect(res).to.have.status(200);
                expect(res.text).to.have.match(/^success!/);
                expect('test/fixtures/prefix1/testfile_second.txt')
                    .to.be.a.file()
                    .with.contents.that.match(/^success/);
            });
    });

    it('should fallback to remote server', function () {
        backend
            .get('/v=7.10.x-xx/testfile_third.txt')
            .reply(200, 'success!');
        expect('test/fixtures/prefix1/testfile_third.txt').to.not.be.a.path('before the request');
        return chai.request(server)
            .get('/appsuite/v=7.10.x-xx/testfile_third.txt')
            .then(function (res) {
                expect(res).to.have.status(200);
                expect(res.text).to.match(/^success!/);
                expect('test/fixtures/prefix1/testfile_third.txt')
                    .to.be.a.file()
                    .with.contents.that.match(/^success/);
            })

    });

    it('should serve files via apps/load middleware', function () {
        return chai.request(server)
            .get('/appsuite/api/apps/load/7.10.x-xx,testapp.js')
            .then(function (res) {
                expect(res).to.have.status(200);
                expect(res.text).to.have.match(/success!/);
            });
    });

    after(function () {
        server.close();
        nock.cleanAll();
        nock.restore();
        mock.restore();
    });
});
