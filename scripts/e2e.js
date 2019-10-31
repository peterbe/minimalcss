#!/usr/bin/env node
const fs = require('fs');
const spawn = require('child_process').spawnSync;

const inCI = process.env.CI || false;

function assert(truth, failure) {
  if (!truth) {
    throw new Error(failure);
  }
}
function assertStatus(spawned) {
  if (spawned.status !== 0) {
    console.error('STDOUT', spawned.stdout.toString());
    console.error('STDERR', spawned.stderr.toString());
    process.exit(spawned.status);
  }
}

const version = spawn('./bin/minimalcss.js', ['--version']);
assertStatus(version);
const versionNumber = version.stdout.toString();
assert(!/[^\d\.]/.test(versionNumber.trim()), 'Not a version number');
const versionNumber2 = spawn('./bin/minimalcss.js', ['-v']).stdout.toString();
assert(versionNumber2 === versionNumber, 'alias not working');

function openUrl(url, ...options) {
  console.log(`Opening ${url} ...`);
  if (inCI) {
    options.push('--nosandbox');
  }
  options.push(url);
  const t0 = new Date();
  const opened = spawn('./bin/minimalcss.js', options);
  assertStatus(opened);
  const t1 = new Date();
  const t = (t1 - t0) / 1000;
  console.log(`Took ${t.toFixed(2)}s`);
  return Promise.resolve(opened);
}

// Simplest form of opening
openUrl('https://minimalcss.app/').then(spawned => {
  const css = spawned.stdout.toString();
  assert(
    css.length > 7000 && css.length < 10000,
    'Expect CSS to be between 7,000...10,000'
  );
});

// Open with -o
openUrl('https://developer.mozilla.org/', '-o', '/tmp/mdn.css').then(
  spawned => {
    const stdout = spawned.stdout.toString();
    assert(!stdout.trim(), 'Output should be empty');
    const css = fs.readFileSync('/tmp/mdn.css').toString();
    assert(
      css.length > 10000 && css.length < 30000,
      'Expect CSS to be between 10K...30K'
    );
  }
);

// With verbose output
openUrl('https://developer.mozilla.org/', '--verbose').then(spawned => {
  const css = spawned.stdout.toString();
  assert(/\/\*\nGenerated /.test(css), 'Expected verbose leading comment');
  assert(
    css.length > 10000 && css.length < 30000,
    'Expect CSS to be between 10K...30K'
  );
});
