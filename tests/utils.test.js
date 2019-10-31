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

test('Test parentSelectors', async () => {
  const f = utils.getParentSelectors;
  // Simplest possible
  expect(f('.foo .bar')).toEqual(['.foo']);
  // Slightly less simple
  expect(f('.foo .bar .baz')).toEqual(['.foo', '.foo .bar']);
  // Empty array
  expect(f('.foo')).toEqual([]);
  // Less trivial
  expect(f('.ui.dropdown>.dropdown.icon:before')).toEqual(['.ui.dropdown']);
  expect(f('.ui.vertical.menu .dropdown.item>.dropdown.icon:before')).toEqual([
    '.ui.vertical.menu',
    '.ui.vertical.menu .dropdown.item'
  ]);
  expect(
    f(
      '.ui.search.selection>.icon.input:not([class*="left icon"])>.icon~.remove.icon'
    )
  ).toEqual([
    '.ui.search.selection',
    '.ui.search.selection>.icon.input:not([class*="left icon"])',
    '.ui.search.selection>.icon.input:not([class*="left icon"])>.icon'
  ]);
  expect(f('.ui[class*="right aligned"].search>.results')).toEqual([
    '.ui[class*="right aligned"].search'
  ]);
});
