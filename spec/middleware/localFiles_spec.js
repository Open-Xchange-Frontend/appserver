'use strict';

var expect = require('chai').expect;
var sharedExamplesFor = require('../shared/examplesFor');

describe('Middleware', function () {
    describe('to serve local files:', function () {
        sharedExamplesFor(require('../../lib/middleware/localfiles'));

        it('should load a local file', function () {
            //TODO: implement me
            expect(true).to.be.true;
        });
    });
});
