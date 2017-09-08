process.env.NODE_ENV=process.env.NODE_ENV || 'test';

process.env.base_path=process.env.base_path || 'test/fixtures/build'

const chai = require('chai'),
    chaiHttp = require('chai-http'),
    sinonChai = require("sinon-chai"),
    chaiFS = require('chai-fs');

chai.should();
chai.use(chaiHttp);
chai.use(sinonChai);
chai.use(chaiFS);
