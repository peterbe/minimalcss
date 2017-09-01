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
    'verbose'
  ],
  string: ['output'],
  default: {
    // color: true,
    // "ignore-path": ".prettierignore"
  },
  alias: {
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
      // "  --write                  Edit the file in-place. (Beware!)\n" +
      // "  --list-different or -l   Print filenames of files that are different from Prettier formatting.\n" +
      // "  --config                 Path to a prettier configuration file (.prettierrc, package.json, prettier.config.js).\n" +
      // "  --no-config              Do not look for a configuration file.\n" +
      // "  --find-config-path <path>\n" +
      // "                           Finds and prints the path to a configuration file for a given input file.\n" +
      // "  --ignore-path <path>     Path to a file containing patterns that describe files to ignore.\n" +
      // "                           Defaults to ./.prettierignore.\n" +
      // "  --stdin                  Read input from stdin.\n" +
      // "  --stdin-filepath         Path to the file used to read from stdin.\n" +
      // "  --print-width <int>      Specify the length of line that the printer will wrap on. Defaults to 80.\n" +
      // "  --tab-width <int>        Specify the number of spaces per indentation-level. Defaults to 2.\n" +
      // "  --use-tabs               Indent lines with tabs instead of spaces.\n" +
      // "  --no-semi                Do not print semicolons, except at the beginning of lines which may need them.\n" +
      // "  --single-quote           Use single quotes instead of double quotes.\n" +
      // "  --no-bracket-spacing     Do not print spaces between brackets.\n" +
      // "  --jsx-bracket-same-line  Put > on the last line instead of at a new line.\n" +
      // "  --trailing-comma <none|es5|all>\n" +
      // "                           Print trailing commas wherever possible when multi-line. Defaults to none.\n" +
      // "  --parser <flow|babylon|typescript|postcss|json|graphql>\n" +
      // "                           Specify which parse to use. Defaults to babylon.\n" +
      // "  --cursor-offset <int>    Print (to stderr) where a cursor at the given position would move to after formatting.\n" +
      // "                           This option cannot be used with --range-start and --range-end\n" +
      // "  --range-start <int>      Format code starting at a given character offset.\n" +
      // "                           The range will extend backwards to the start of the first line containing the selected statement.\n" +
      // "                           This option cannot be used with --cursor-offset.\n" +
      // "                           Defaults to 0.\n" +
      // "  --range-end <int>        Format code ending at a given character offset (exclusive).\n" +
      // "                           The range will extend forwards to the end of the selected statement.\n" +
      // "                           This option cannot be used with --cursor-offset.\n" +
      // "                           Defaults to Infinity.\n" +
      // "  --no-color               Do not colorize error messages.\n" +
      // "  --with-node-modules      Process files inside `node_modules` directory.\n" +
      "  --verbose                Include a comment about the options and the date it was generated.\n" +
      '  --version or -v          Print minimalcss version.\n' +
      '\n'
  )
  process.exit(argv['help'] ? 0 : 1)
}

const urls = argv['_']
// console.log("URLS", urls);

urls.forEach(url => {
  try {
    const parsed = new URL(url)
  } catch (ex) {
    console.error(`${url} is not a valid URL`)
    process.exit(1)
  }
})

const options = {
  urls: urls
}

const start = Date.now()

minimalcss.minimize(options).then(output => {
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
    const filename = argv["output"]
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
