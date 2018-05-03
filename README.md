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

## Packages

This repository is a monorepo that we manage using [Lerna](https://github.com/lerna/lerna). That means that we actually publish [several packages](/packages) to npm from the same codebase, including:

| Package                                   | Description  |
|-------------------------------------------|--------------|
| [minimalcss](packages/minimalcss)         | CLI          |
| [minimalcss-lib](packages/minimalcss-lib) | Core library |