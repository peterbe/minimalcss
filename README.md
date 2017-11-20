# minimalcss

[![NPM version](https://img.shields.io/npm/v/minimalcss.svg)](https://www.npmjs.com/package/minimalcss)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](#badge)

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
$ ./node_modules/./bin/minimalcss https://example.com/ https://example.com/aboutus > minimal.min.css
```

## Prior art

`minimalcss` isn't the first library to perform this task. What's unique and
special about `minimalcss` is that it uses the Chrome Headless browser.

* [penthouse](https://github.com/pocketjoso/penthouse) -
uses [PhantomJS](http://phantomjs.org/) which is a headless WebKit browser.
`PhantomJS` is [no longer maintained](https://groups.google.com/forum/m/#!topic/phantomjs/9aI5d-LDuNE).
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

## State of the project

This is highly experimental.

The goal is to expand the tooling with all the bells and whistles that
`penthouse` and `critical` etc. has.


## Help needed

Let's make this a thriving community project!

Help needed with features, tooling, and much testing in real web performance
optimization work.

## API

```javascript
const minimalcss = require('minimalcss')
```

### Get version `minimalcss.version`

Just prints out the current version.

### Run a minimization `minimalcss.run(options)`

Returns a promise. The promise returns an object containing, amongst
other things, the minified minimal CSS as a string.
For example:
```javascript
minimalcss
  .minimize({ urls: ['http://peterbecom.dev/css-blocking/ultra-basic.html'] })
  .then(result => {
    console.log('OUTPUT', result.finalCss.length, result.finalCss)
}).catch(error => {
    console.error(`Failed the minimize CSS: ${error}`)
})
```

That `result` object that is returned by the `minimize` function contains:

* `finalCss` - the minified minimal CSS as a string.
* `stylesheetContents` - an object of stylesheet URLs as keys and their
  content as text.
* `stylesheetAstObjects` - an object of stylesheet URLs as keys and their
  AST as a plain object.

## API Options

Calling `minimalcss.run(options)` takes an object whose only mandatory
key is `urls`. Other optional options are:

* `debug` - all console logging during page rendering are included in the
  stdout. Also, any malformed selector that cause errors in `document.querySelector`
  will be raised as new errors.
* `skippable` - function wich takes
  [request](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-request)
  as an argument and returns boolean. If it returns true then given request
  will be aborted (skipped). Can be used to block requests to Google Analytics
  etc.
* `loadimages` - If set to true, images will actually load.
* `browser` - Instance of a [Browser](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#class-browser), which will be used instead of launching another one.
* `userAgent` - specific user agent to use (string)

## Development

We use ES6+ with jsdoc comments and TypeScript to do static type checking, like [puppeeteer does](https://github.com/GoogleChrome/puppeteer/pull/986/files).

Run `tsc` to check types.

```sh
yarn tsc
```

### Prettier

All code is expected to conform with [Prettier](https://prettier.io/) according
to the the `.prettierrc` file in the root of the project.

To check that all your code conforms, run:

    yarn lintcheck

## Caveats

### A Warning About Blobs

If your document uses `Blob` to create injectable stylesheets into the DOM, `minimalcss` will *not* be able to optimize that. It will be not be included in the final CSS.

## License

Copyright (c) 2017 [Peter Bengtsson](https://www.peterbe.com).
See the [LICENSE](/LICENSE.md) file for license rights and limitations (MIT).
