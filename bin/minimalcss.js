#!/usr/bin/env node

'use strict';

const { URL } = require('url');
const fs = require('fs');
const minimist = require('minimist');
const minimalcss = eval('require')('../index');
const filesize = require('filesize');

const args = process.argv.slice(2);

const argv = minimist(args, {
  boolean: [
    'help',
    'version',
    'verbose',
    'debug',
    'loadimages',
    'styletags',
    'withoutjavascript',
    'nosandbox'
  ],
  string: ['output', 'skip', 'viewport'],
  default: {
    // color: true,
  },
  alias: {
    debug: 'd',
    help: 'h',
    version: 'v',
    output: 'o'
  },
  unknown: param => {
    if (param.startsWith('-')) {
      console.warn('Ignored unknown option: ' + param + '\n');
      return false;
    }
  }
});

if (argv['version']) {
  console.log(minimalcss.version);
  process.exit(0);
}

if (argv['help']) {
  console.log(
    'Usage: minimalcss [opts] url [url2 ...]\n\n' +
      'Available options:\n' +
      '  --output <path> or -o <path>  Path to write the final CSS to.\n' +
      '  --verbose                     Include a comment about the options and the date it was generated.\n' +
      '  --debug or -d                 Print all console logging during page rendering to stdout.\n' +
      '  --loadimages                  By default, all images are NOT downloaded. This reverses that.\n' +
      '  --styletags                   By default, all <style> tags are ignored. This will include them.\n' +
      '  --withoutjavascript           The CSS is evaluated against the DOM twice, first with no JavaScript, ' +
      'then with. This disables the load without JavaScript.\n' +
      '  --skip                        String to match in URL to ignore download. Repeatable. E.g. --skip google-analyics.com\n' +
      '  --viewport                    JSON string that gets converted into valid parameter to `page.setViewport()`\n' +
      "  --nosandbox                   Adds `['--no-sandbox', '--disable-setuid-sandbox']` to puppeteer launch.\n" +
      '  --version or -v               Print minimalcss version.\n' +
      ''
  );
  process.exit(0);
}

const urls = argv['_'];

urls.forEach(url => {
  try {
    const parsed = new URL(url);
  } catch (ex) {
    console.error(`${url} is not a valid URL`);
    process.exit(1);
  }
});

const parseViewport = asString => {
  if (!asString) {
    return null;
  }
  try {
    return JSON.parse(asString);
  } catch (ex) {
    console.error(`Unable to parse 'viewport' (${ex.toString()})`);
    process.exit(2);
  }
};

const options = {
  urls: urls,
  debug: argv['debug'],
  loadimages: argv['loadimages'],
  withoutjavascript: argv['withoutjavascript'],
  skippable: request => {
    let skips = argv['skip'];
    if (!skips) {
      return false;
    }
    if (!Array.isArray(skips)) {
      skips = [skips];
    }
    return skips.some(skip => !!request.url().match(skip));
  },
  viewport: parseViewport(argv['viewport']),
  puppeteerArgs: argv['nosandbox']
    ? ['--no-sandbox', '--disable-setuid-sandbox']
    : []
};

const start = Date.now();

minimalcss
  .minimize(options)
  .then(result => {
    let output = result.finalCss;
    const end = Date.now();
    if (argv['verbose']) {
      const now = new Date().toISOString();
      let comment = `/*\nGenerated ${now} by minimalcss.\n`;
      const seconds = ((end - start) / 1000).toFixed(2);
      const bytesHuman = filesize(output.length);
      const stylesheetContents = result.stylesheetContents;
      const stylesheets = Object.keys(stylesheetContents);
      const totalSizeBefore = stylesheets.reduce(
        (acc, key) => acc + stylesheetContents[key].length,
        0
      );
      const totalSizeBeforeHuman = filesize(totalSizeBefore);
      comment += `Took ${seconds} seconds to generate ${bytesHuman} of CSS.\n`;
      comment += `Based on ${stylesheets.length} stylesheets `;
      comment += `totalling ${totalSizeBeforeHuman}.\n`;
      comment += 'Options: ' + JSON.stringify(options, undefined, 2) + '\n';
      comment += '*/';
      output = `${comment}\n${output}`;
    }
    if (argv['output']) {
      const filename = argv['output'];
      try {
        fs.writeFileSync(filename, output + '\n', 'utf8');
      } catch (err) {
        console.error('Unable to write file: ' + filename + '\n' + err);
        process.exit(2);
      }
    } else {
      console.log(output);
    }
  })
  .catch(error => {
    console.error(error);
    process.exit(3);
  });
