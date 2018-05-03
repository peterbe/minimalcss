'use strict'

const minimalcss = require('minimalcss-lib')
const version = require('./package.json').version

module.exports = {
  minimize: minimalcss.minimize,
  version
}
