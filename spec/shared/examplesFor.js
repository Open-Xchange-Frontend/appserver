var expect = require('chai').expect;

module.exports = function (module) {
    describe('The module', function () {
        it('should provide a create method', function () {
            expect(module.create).to.be.a('function');
        });

        it('should create new local file handlers', function () {
            expect(module.create({})).to.be.a('function');
        });
    });
};
