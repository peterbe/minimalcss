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

This is highly experimental. And currently only works as a rough cli.
Not packaged as an executable NPM package yet.

The goal is to expand the tooling with all the bells and whistles that
`penthouse` and `critical` etc. has. Including NPM packaging, split between
lib and cli, unit tests, documentation, maturity.


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

Returns a promise. The promise returns the minified minimal CSS as a string.
For example:
```javascript
minimalcss
  .minimize({ urls: ['http://peterbecom.dev/css-blocking/ultra-basic.html'] })
  .then(output => {
    console.log('OUTPUT', output.length, output)
}).catch(error => {
    console.error(`Failed the minimize CSS: ${error}`)
})
```

## API Options

Calling `minimalcss.run(options)` takes an object whose only mandatory
key is `urls`. Other optional options are:

* `debug` - all console logging during page rendering are included in the
  stdout.


## License

Copyright (c) 2017 [Peter Bengtsson](https://www.peterbe.com).
See the [LICENSE](/LICENSE.md) file for license rights and limitations (MIT).
