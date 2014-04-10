var expect = require('chai').expect;

describe('Middleware', function () {
    describe('to serve local files:', function () {
        describe('The module', function () {
            var module = require('../../lib/middleware/localfiles');

            it('should provide a create method', function () {
                expect(module.create).to.be.a('function');
            });

            it('should create new local file handlers', function () {
                expect(module.create({})).to.be.a('function');
            });
        });
    });
});
