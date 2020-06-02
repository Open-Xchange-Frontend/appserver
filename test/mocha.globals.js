process.env.NODE_ENV = process.env.NODE_ENV || 'test'

process.env.base_path = process.env.base_path || 'test/fixtures/build'

const chai = require('chai')
const chaiHttp = require('chai-http')
const sinonChai = require('sinon-chai')
const chaiFS = require('chai-fs')

chai.should()
chai.use(chaiHttp)
chai.use(sinonChai)
chai.use(chaiFS)
