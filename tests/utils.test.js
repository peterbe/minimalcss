const utils = require('../src/utils');

test('Test unquoteString', async () => {
  const f = utils.unquoteString;
  expect(f('"peter"')).toEqual('peter');
  expect(f(`'peter'`)).toEqual('peter');
  // but leave it if it isn't balanced
  expect(f('"peter')).toEqual('"peter');
  // empty strings
  expect(f('')).toEqual('');
});

test('Test reduceCSSSelector', async () => {
  const f = utils.reduceCSSSelector;
  // Most basic case.
  expect(f('a:hover')).toEqual('a');
  // More advanced case.
  expect(f('a[href^="javascript:"]:after')).toEqual('a[href^="javascript:"]');
  // Should work with ' instead of " too.
  expect(f("a[href^='javascript:']:after")).toEqual("a[href^='javascript:']");
});

test('Test removeSequentialSemis', () => {
  const f = utils.removeSequentialSemis;
  // empty string
  expect(f('')).toEqual('');
  // more than two semicolons
  expect(f(';;;')).toEqual(';');
  // whitespace between semicolons
  expect(f(';\r\n\t;')).toEqual(';');
  // multiple semicolon sequences
  expect(f('a;b;;c;;;d;;;;')).toEqual('a;b;c;d;');
});
