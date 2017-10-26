* New repeatable string argument `--skip` to cli to selectively skip
  downloading certain URLs. [pull#31](https://github.com/peterbe/minimalcss/pull/31)

# 0.2.4

* Ability to pass a function `skippable` which can help cancel certain
  network request. [pull#20](https://github.com/peterbe/minimalcss/pull/20)
  Thanks @stereobooster

* Option to actually load images if you need it to.
  [#26](https://github.com/peterbe/minimalcss/issues/26)

# 0.2.3

[compare](https://github.com/peterbe/minimalcss/compare/v0.2.2...v0.2.3)

* Don't choke on `blob:` stylesheet link objects.
  Thanks @stereobooster

* Use `TypeScript` to do type checking for development.
  Thanks @stereobooster

# 0.2.2

[compare](https://github.com/peterbe/minimalcss/compare/v0.2.1...v0.2.2)

* Correctly ignore all request that are images by extension.

# 0.2.1

[compare](https://github.com/peterbe/minimalcss/compare/v0.2.0...v0.2.1)

* Important fix for parsing all media queries.

# 0.2.0

[compare](https://github.com/peterbe/minimalcss/compare/v0.1.2...v0.2.0)

* The main `minimize` function returns an object (which contains
  `.finalCss`) instead of just the CSS.
  Useful to be able to see the stylesheets it parsed.

* `debug` option which adds all `console.log` that happens to
  `stdout`. Off by default.

* Upgrade to css-tree 1.0.0-alpha24

* List of "dead obvious" selectors that don't need to be analyzed like
  `*`, `body`, and
`html`.

* Clean up repeated important-comments in the concatenated CSS.

* Updated README with example how to use a `catch`.

# 0.1.2

* Trivial package refactoring.

# 0.1.1

* Better error handling on failed page navigation

# 0.1.0

* Basic CLI working.
