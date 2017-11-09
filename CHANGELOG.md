# 0.3.1

* Any errors raised internally by `document.querySelector()` are not
  swallowed unless run with `options.debug == true`
  [pull#40](https://github.com/peterbe/minimalcss/pull/40)

# 0.3.0

* Option to override user agent used by `puppeteer`.
  [pull#37](https://github.com/peterbe/minimalcss/pull/37)
  Thanks @stereobooster

* Correction of relative URLs in CSS fixed. E.g. `url(images/img.png)` in
  `/styles/main.css` now becomes `url(/styles/images/img.png)`
  [pull#28](https://github.com/peterbe/minimalcss/pull/28)
  Thanks @stereobooster

* New option `browser` if you already have a puppeteer `Browser` instance
  you can pass that in. [pull#36](https://github.com/peterbe/minimalcss/pull/36)
  Thanks @stereobooster

* Errors thrown if any necessary `.css` download can't be found. [pull#27](https://github.com/peterbe/minimalcss/pull/27)
  Thanks @stereobooster

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
