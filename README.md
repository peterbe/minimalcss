# minimalcss

[![Build Status](https://travis-ci.org/peterbe/minimalcss.svg?branch=master)](https://travis-ci.org/peterbe/minimalcss)
[![NPM version](https://img.shields.io/npm/v/minimalcss.svg)](https://www.npmjs.com/package/minimalcss)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](#badge)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovateapp.com/)

A Node library to extract the minimal CSS used in a set of URLs with puppeteer.
Used to find what minimal CSS is needed to render on first load, even with
`document.onload` executed.

This minimal CSS is also known as [critical path CSS](https://developers.google.com/web/fundamentals/performance/critical-rendering-path/analyzing-crp)
and ultimately a web performance technique to make web pages load faster
at initial load.

## What does it do?

You supply a list of URLs that it opens (one at a time) and for each page
it downloads all external CSS files (e.g.
`<link rel="stylesheet" href="bootstrap.min.css">`) and uses the DOM and
`document.querySelector` to investigate which selectors, in the CSS, are
actually in the DOM. That minimal payload of CSS is all you need to load
the URLs styled without having to make it block on CSS.

Under the hood it relies on the excellent
[puppeteer library](https://github.com/GoogleChrome/puppeteer) which uses
the Headless Chome Node API. This means it runs (at the time of writing)
Chrome 62 and this library is maintained by the Google Chrome team.

The CSS to analyze (and hopefully minimize) is downloaded automatically just
like a browser opens and downloads CSS as mentioned in the DOM as `<link>`
tags.

The CSS is parsed by [CSSTree](https://github.com/csstree/csstree) and the
minification and compression is done with [CSSO](https://github.com/css/csso).
An AST of each CSS payload is sent into the Headless Chrome page evaluation
together with a callback that compares with the DOM and then each minimal CSS
payload is concatenated into one big string which then CSSO compresses into
one "merged" and minified CSS payload.

## Usage

Install:

```
yarn add minimalcss --dev
```

You can install it globally if you like:

```
yarn global add minimalcss
```

```
npm install [--save-dev|--global] minimalcss
```

Now you can run it:

```shell
$ ./node_modules/.bin/minimalcss https://example.com/ https://example.com/aboutus > minimal.min.css
```

## Prior art

`minimalcss` isn't the first library to perform this task. What's unique and
special about `minimalcss` is that it uses the Chrome Headless browser.

* [penthouse](https://github.com/pocketjoso/penthouse) -
  uses [puppeteer](https://github.com/GoogleChrome/puppeteer) (since version 1.0) and [CSSTree](https://github.com/csstree/csstree).
  Supports only 1 URL at a time and can't you have to first save the CSS files
  it should process.

* [critical](https://github.com/addyosmani/critical) - uses `penthouse`
  (see above) with its "flaws" meaning you can only do 1 URL (or HTML string)
  and you have to prepare the CSS files too.

* [UnCSS](https://github.com/giakki/uncss) - uses [jsdom](https://github.com/tmpvar/jsdom)
  to render and execute JavaScript. Supports supplying multiple URLs but still
  requires to manually supply the CSS files to process.

* [mincss](https://github.com/peterbe/mincss) - Python project that uses
  [lxml.html](http://lxml.de/lxmlhtml.html) to analyze the HTML statically
  (by doing a `GET` of the URL as if done by a server). I.e.
  it can't load the HTML as a real browser would and thus does not support a
  DOM with possible JavaScript mutations on load.
  It can optionally use `PhantomJS` to extract the HTML.

## Killer features

* You don't need to specify where the CSS is. It gets downloaded and parsed
  automatically.

* It uses [puppeteer](https://github.com/GoogleChrome/puppeteer) and
  [CSSTree](https://github.com/csstree/csstree) which are both high quality
  projects that are solid and well tested.

* The CSS selectors downloaded is compared to the DOM before _and_ after
  JavaScript code has changed the DOM. That means you can extract the
  critical CSS needed to display properly before the JavaScript has kicked in.

* Ability to analyze the remaining CSS selectors to see which keyframe
  animations that they use and use this to delete keyframe definitions
  that are no longer needed.

* You can specify a [viewport](https://github.com/GoogleChrome/puppeteer/blob/v1.0.0/docs/api.md#pagesetviewportviewport),
  which might cause the page to render slightly different. It does not
  create the minimal CSS _only_ on DOM that is visible though.

* If the CSS contains `@font-face { ... }` rules whose name is never
  used in any remaining CSS selector, the whole `font-face` block is removed.

## Help needed

Let's make this a thriving community project!

Help needed with features, tooling, and much testing in real web performance
optimization work.

## API

```javascript
const minimalcss = require('minimalcss');
```

### Get version `minimalcss.version`

Just prints out the current version.

### Run a minimization `minimalcss.run(options)`

Returns a promise. The promise returns an object containing, amongst
other things, the minified minimal CSS as a string.
For example:

```javascript
minimalcss
  .minimize({ urls: ['https://example.com/'] })
  .then(result => {
    console.log('OUTPUT', result.finalCss.length, result.finalCss);
  })
  .catch(error => {
    console.error(`Failed the minimize CSS: ${error}`);
  });
```

That `result` object that is returned by the `minimize` function contains:

* `finalCss` - the minified minimal CSS as a string.
* `stylesheetContents` - an object of stylesheet URLs as keys and their
  content as text.

## API Options

Calling `minimalcss.run(options)` takes an object whose only mandatory
key is `urls`. Other optional options are:

* `debug` - all console logging during page rendering are included in the
  stdout. Also, any malformed selector that cause errors in `document.querySelector`
  will be raised as new errors.
* `skippable` - function which takes
  [request](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-request)
  as an argument and returns boolean. If it returns true then given request
  will be aborted (skipped). Can be used to block requests to Google Analytics
  etc.
* `loadimages` - If set to `true`, images will actually load.
* `withoutjavascript` - If set to `false` it will _skip_ loading the page first
  without JavaScript. By default `minimalcss` will evaluate the DOM as plain as
  can be, and then with JavaScript enabled _and_ waiting for network activity
  to be idle.
* `browser` - Instance of a [Browser](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-browser), which will be used instead of launching another one.
* `userAgent` - specific user agent to use (string)
* `viewport` - viewport object as specified in [page.setViewport](https://github.com/GoogleChrome/puppeteer/blob/v1.0.0/docs/api.md#pagesetviewportviewport)
* `puppeteerArgs` - Args sent to puppeteer when launching. [List
  of strings for headless Chrome](https://peter.sh/experiments/chromium-command-line-switches/).
* `cssoOptions` - CSSO compress function [options](https://github.com/css/csso#compressast-options)
* `timeout` - Maximum navigation time in milliseconds, defaults to 30 seconds, pass 0 to disable timeout.
* `ignoreCSSErrors` - By default, any CSS parsing error throws an error in `minimalcss`. If you know it's safe to ignore (for example, third-party CSS resources), set this to true.
* `ignoreJSErrors` - By default, any JavaScript error encountered by puppeteer 
will be thrown by `minimalcss`. If you know it's safe to ignore errors (for example, on
third-party webpages), set this to true.

## Warnings

### Google Fonts

Suppose you have this in your HTML:

```html
<link href="https://fonts.googleapis.com/css?family=Lato" rel="stylesheet">
```

then, `minimalcss` will consider this an external CSS stylesheet, load it
and include it in the minimal CSS.

The problem is that Google Fonts will respond to that URL dynamically based
on the user agent. In other words a different CSS payload depending on who's
asking. So, the user agent when `minimalcss` runs will be whatever
`puppeteer` uses and it might not be the best CSS for other user agents.
So to avoid this predicament use the `skippable` option. On the command line
you can do that like this:

```shell
./node_modules/.bin/minimalcss --skip fonts.googleapis.com https://example.com
```

With the API, you can do it like this:

```javascript
minimalcss
  .minimize({
    urls: ['https://example.com'],
    skippable: request => {
      return !!request.url().match('fonts.googleapis.com');
    }
  })
  .then(result => {
    ...
  });
```

### Multiple URLs

`minimalcss` can accept multiple URLs when figuring out the minimal CSS for
all those URLs, combined. But **be careful**, this can be dangerous. If
you have one URL with this HTML:

```html
<head>
  <link rel="stylesheet" href="base.css">
  <link rel="stylesheet" href="specific.css">
</head>
```

and another URL with...:

```html
<head>
  <link rel="stylesheet" href="base.css">
</head>
```

When combining these, it will optimize the CSS in this order:

1.  `base.css`
2.  `specific.css`
3.  `base.css`

But if `specific.css` was meant to override something in `base.css` in the
first URL, that might get undone when `base.css` becomes the last CSS
to include.

[See this issue for another good example](https://github.com/peterbe/minimalcss/issues/16) why running `minimalcss` across multiple URLs.

### About `cheerio`

When `minimalcss` evaluates each CSS selector to decide whether to keep it
or not, some selectors might not be parseable. Possibly, the CSS employs
hacks for specific browsers that
[cheerio](https://www.npmjs.com/package/cheerio) doesn't support. Or
there might be CSS selectors that no browser or tool can understand
(e.g a typo by the CSS author). If there's a problem parsing a CSS selector,
the default is to swallow the exception and let the CSS selector stay.

Also by default, all these warnings are hidden. To see them use the `--debug`
flag (or `debug` API option). Then the CSS selector syntax errors are
printed on `stderr`.

### About `@font-face`

`minimalcss` will remove any `@font-face` rules whose name is not mentioned
in any of the CSS selectors. But be aware that you might have a
`@font-face { font-family: MyName; }` in some `/static/foo.css` but separately
you might have an inline style sheet that looks like this:

```html
<style type="text/css">
div.something { font-family: MyName; }
</style>
```

In this case the `@font-face { font-family: MyName; }` would be removed even
though it's mentioned from somewhere else.

### About Blobs

If your document uses `Blob` to create injectable stylesheets into the DOM,
`minimalcss` will _not_ be able to optimize that. It will be not be
included in the final CSS.

## Development

First thing to get started, once you've cloned the repo is to install all
the dependencies:

```sh
yarn
```

### Testing

Testing is done with [`jest`](https://facebook.github.io/jest/). At the
beginning of every test, a static file server is started on `localhost`
and a `puppeteer` browser instance is created for every test.

To run the tests:

```sh
yarn jest
```

Best way to get into writing tests is to look at existing tests and copy.

### Prettier

All code is expected to conform with [Prettier](https://prettier.io/) according
to the the `.prettierrc` file in the root of the project.

To check that all your code conforms, run:

    yarn lintcheck

## License

Copyright (c) 2017-2018 [Peter Bengtsson](https://www.peterbe.com).
See the [LICENSE](/LICENSE) file for license rights and limitations (MIT).
