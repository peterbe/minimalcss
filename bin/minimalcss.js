#!/usr/bin/env node

'use strict'

const { URL } = require('url')
const fs = require('fs')
const minimist = require('minimist')
const minimalcss = eval('require')('../index')
const filesize = require('filesize')

const args = process.argv.slice(2)

const argv = minimist(args, {
  boolean: [
    // "write",
    // "stdin",
    'help',
    'version',
    'verbose',
    'debug'
  ],
  string: ['output'],
  default: {
    // color: true,
    // "ignore-path": ".prettierignore"
  },
  alias: {
    debug: 'd',
    help: 'h',
    version: 'v',
    output: 'o'
  },
  unknown: param => {
    if (param.startsWith('-')) {
      console.warn('Ignored unknown option: ' + param + '\n')
      return false
    }
  }
})

if (argv['version']) {
  console.log(minimalcss.version)
  process.exit(0)
}

if (argv['help']) {
  console.log(
    'Usage: minimalcss [opts] url [url2 ...]\n\n' +
      'Available options:\n' +
      '  --output <path>          Path to write the final CSS to.\n' +
      '  --verbose                Include a comment about the options and the date it was generated.\n' +
      '  --debug or -d            Print all console logging during page rendering to stdout.\n' +
      '  --version or -v          Print minimalcss version.\n' +
      ''
  )
  process.exit(0)
}

const urls = argv['_']

urls.forEach(url => {
  try {
    const parsed = new URL(url)
  } catch (ex) {
    console.error(`${url} is not a valid URL`)
    process.exit(1)
  }
})

const options = {
  urls: urls,
  debug: argv['debug']
}

const start = Date.now()

minimalcss
  .minimize(options)
  .then(output => {
    const end = Date.now()
    if (argv['verbose']) {
      const now = new Date().toISOString()
      let comment = `/*\nGenerated ${now} by minimalcss.\n`
      const seconds = ((end - start) / 1000).toFixed(2)
      const bytesHuman = filesize(output.length)
      comment += `Took ${seconds} seconds to generate ${bytesHuman} of CSS.\n`
      comment += 'Options: ' + JSON.stringify(options, undefined, 2) + '\n'
      comment += '*/'
      output = `${comment}\n${output}`
    }
    if (argv['output']) {
      const filename = argv['output']
      try {
        fs.writeFileSync(filename, output + '\n', 'utf8')
      } catch (err) {
        console.error('Unable to write file: ' + filename + '\n' + err)
        process.exit(2)
      }
    } else {
      console.log(output)
    }
  })
  .catch(error => {
    console.error(error)
    process.exit(3)
  })
