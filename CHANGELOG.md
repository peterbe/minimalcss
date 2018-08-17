* Stylesheet `link` tags whose `href` URL contains a `#fragment-example`
  would cause an error because puppeteer doesn't include it in the
  `response.url()`.
  [pull#255](https://github.com/peterbe/minimalcss/pull/255)
  Thanks @jc275


# 0.7.9

* New option `ignoreJSErrors` to ignore possible JavaScript errors.
  [pull#253](https://github.com/peterbe/minimalcss/pull/253)
  Thanks @jc275

# 0.7.8

* New option `ignoreCSSErrors` to ignore possible CSS parsing errors.
  [pull#249](https://github.com/peterbe/minimalcss/pull/249)
  Thanks @stereobooster

# 0.7.7

* Throw explicit errors on invalid CSS
  [pull#237](https://github.com/peterbe/minimalcss/pull/237)
  Thanks @harrygreen

# 0.7.6

* List what timed out. Useful for debugging which resources failed.
  [pull#199](https://github.com/peterbe/minimalcss/pull/199)
  Thanks @stereobooster

* Upgrade to puppeteer 1.4.0
  [pull#214](https://github.com/peterbe/minimalcss/pull/214)

# 0.7.5

* Ability to pass an object of options to `csso.compress()`
  [pull#167](https://github.com/peterbe/minimalcss/pull/167)
  Thanks @usebaz

# 0.7.4

* Fix for logic of using the `--withoutjavascript` argument.
  [pull#163](https://github.com/peterbe/minimalcss/pull/163)
  Thanks @stereobooster

* Upgrade `puppeteer` dependency to version 1.2.

* Fix for `304 Not Modified` responses that actually don't redirect.
  [pull#165](https://github.com/peterbe/minimalcss/pull/165)
  Thanks @stereobooster

# 0.7.3

* Fix for pages that uses `data:text/css ...` as the `href` i `<link>` tags.
  [pull#159](https://github.com/peterbe/minimalcss/pull/159)

# 0.7.2

* Data URIs in external stylesheets lost the `data:` part.
  [pull#153](https://github.com/peterbe/minimalcss/pull/153)
  Thanks @stereobooster and @phiresky for reporting.

# 0.7.1

* Any query strings in URLs in CSS is now preserved.
  [pull#148](https://github.com/peterbe/minimalcss/pull/148) Thanks @usebaz

# 0.7.0

* Important fix for how multiple external stylesheets are parsed in the exact
  order the `<link rel=stylesheet>` tags appear in the HTML.
  [pull#131](https://github.com/peterbe/minimalcss/pull/131)

* The response interceptor skips or includes resources based on
  `responseType` instead of URL and filename.
  [pull#118](https://github.com/peterbe/minimalcss/pull/118) Thanks @stereobooster

# 0.6.3

* Redirects, both of external style sheets and other URLs is now correctly
  followed. [pull#106](https://github.com/peterbe/minimalcss/pull/106)

* Remove `@media print` rules. [pull#101](https://github.com/peterbe/minimalcss/pull/101)

* Switching to wait for [`networkidle0`](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagegotourl-options)
  instead to allow the page slightly more time to finish more XHR and static
  resources. [pull#87](https://github.com/peterbe/minimalcss/pull/87)

# 0.6.2

* All `@font-face` rules whose name is never mentioned in any remaining
  selector is now deleted. [pull#81](https://github.com/peterbe/minimalcss/pull/81)

* Rules inside `keyframe` at-rules are not analyzed.
  [pull#83](https://github.com/peterbe/minimalcss/pull/83)

# 0.6.1

* Much better error handling. If a CSS file fails to download or some
  JavaScript on the page throws an error, the minimalcss process now
  exits immediately, closes the puppeteer instance, and triggers the
  rejection on the main promise.
  Thanks @stereobooster [pull#65](https://github.com/peterbe/minimalcss/pull/65)

# 0.6.0

* Supports setting `viewport`. Both via the cli and via the pure API.
  Thanks @stereobooster [pull#64](https://github.com/peterbe/minimalcss/pull/64)
  And works on the cli by passing a JSON string
  [pull#78](https://github.com/peterbe/minimalcss/pull/78)

# 0.5.1

* Works with and requires puppeteer 1.0.0. [pull#74](https://github.com/peterbe/minimalcss/pull/74)
  Thanks @jonathaningram

# 0.5.0

* Engine massively refactored by the author of
  [csstree](https://github.com/csstree/csstree) and
  [csso](https://github.com/css/csso)
  himself; [@lahmatiy](https://github.com/lahmatiy)

* The `minimalcss.minimize()` functions promise no longer contains a
  `stylesheetAstObjects` objects. It wasn't clear which AST it should be.
  Thanks again @lahmatiy

* Redundant and never referred to `keyframes` get automatically removed.
  [pull#57](https://github.com/peterbe/minimalcss/pull/57).

* greenkeeper.io now helps maintain dependency upgrades.

# 0.4.0

* Every URL you pass gets loaded twice. First _without Javascript_ and then
  _with JavaScript_ (and waiting for network to be idle). These means the
  minimal CSS will contain CSS that was necessary **before** the page is fully
  loaded as well.
  Also, the engine has entirely changed. Instead of evaluating the DOM inside
  a page evaluation (the equivalent of running in the Web Console), puppeteer
  is only used to 1) download relevant assets and 2) yield the DOM as a string
  of HTML. Instead [cheerio](https://www.npmjs.com/package/cheerio) is used
  to compare the CSS to the DOM.
  [pull#53](https://github.com/peterbe/minimalcss/pull/53)

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
