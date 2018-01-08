'use strict'

const minimalcss = require('./src/run')
const version = require('./package.json').version

module.exports = {
  minimize: options => {
    // returns a promise
    return minimalcss.run(options)
  },
  astToCss: minimalcss.astToCss,
  version
}
