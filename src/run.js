'use strict'

const puppeteer = require('puppeteer')
// @ts-ignore
const csso = require('csso')
// @ts-ignore
const csstree = require('css-tree')
const collectImportantComments = require('./utils').collectImportantComments
const url = require('url')

/**
 *
 * @param {{ urls: Array<string>, debug: boolean, loadimages: boolean, skippable: function, browser: any }} options
 * @return Promise<{ finalCss: string, stylesheetAstObjects: any, stylesheetContents: string }>
 */
const minimalcss = async options => {
  const { urls } = options
  const debug = options.debug || false
  const loadimages = options.loadimages || false
  // const keepPrintAtRules = options.keepPrintAtRules || false
  // XXX The launch options should be a parameter once this is no longer
  // just a cli app.
  const browser = options.browser || (await puppeteer.launch({}))

  const stylesheetAstObjects = {}
  const stylesheetContents = {}
  const allCleaned = []
  // Note! This opens one URL at a time synchronous
  for (let i = 0; i < urls.length; i++) {
    const pageUrl = urls[i]
    // console.log(url, i);
    const page = await browser.newPage()

    // A must or else you can't do console.log from within page.evaluate()
    page.on('console', (...args) => {
      if (debug) {
        console.log(...args)
      }
    })

    // XXX Isn't there a better way to enable options like this?
    await page.setRequestInterceptionEnabled(true)
    page.on('request', request => {
      if (/data:image\//.test(request.url)) {
        // don't need to download those
        request.abort()
      } else if (
        !loadimages &&
        /\.(png|jpg|jpeg|gif|webp)$/.test(request.url.split('?')[0])
      ) {
        request.abort()
      } else if (stylesheetAstObjects[request.url]) {
        // no point downloading this again
        request.abort()
      } else if (options.skippable && options.skippable(request)) {
        // If the URL of the request that got skipped is a CSS file
        // not having it in stylesheetAstObjects is going to cause a
        // problem later when we loop through all <link ref="stylesheet">
        // tags.
        // So put in an empty (but not falsy!) object for this URL.
        if (request.url.match(/\.css/i)) {
          stylesheetAstObjects[request.url] = {}
          stylesheetContents[request.url] = ''
        }
        request.abort()
      } else {
        request.continue()
      }
    })

    // To build up a map of all downloaded CSS
    page.on('response', response => {
      const responseUrl = response.url
      const ct = response.headers['content-type'] || ''
      if (!response.ok) {
        throw new Error(`${response.status} on ${responseUrl}`)
      }
      if (ct.indexOf('text/css') > -1 || /\.css$/i.test(responseUrl)) {
        response.text().then(text => {
          const ast = csstree.parse(text, {
            parseValue: true,
            parseRulePrelude: false
          })
          csstree.walk(ast, node => {
            if (node.type === 'Url') {
              let value = node.value
              let path
              if (value.type === 'Raw') {
                path = value.value
              } else {
                path = value.value.substr(1, value.value.length - 2)
              }
              const sameHost =
                url.parse(responseUrl).host === url.parse(pageUrl).host
              if (/^https?:\/\/|^\/\//i.test(path)) {
                // do nothing
              } else if (/^\//.test(path) && sameHost) {
                // do nothing
              } else {
                const resolved = new url.URL(path, responseUrl)
                if (sameHost) {
                  path = resolved.pathname
                } else {
                  path = resolved.href
                }
              }
              value.value = path
            }
          })
          stylesheetAstObjects[responseUrl] = csstree.toPlainObject(ast)
          stylesheetContents[responseUrl] = text
        })
      }
    })

    page.on('pageerror', error => {
      throw error
    })

    const response = await page.goto(pageUrl, { waitUntil: 'networkidle' })
    if (!response.ok) {
      throw new Error(`${response.status} on ${pageUrl}`)
    }

    const cleaned = await page.evaluate(stylesheetAstObjects => {
      const cleaner = (ast, callback) => {
        const selectorToString = children => {
          let str = ''
          children.forEach(child => {
            if (child.type === 'IdSelector') {
              str += '#' + child.name
            } else if (child.type === 'ClassSelector') {
              str += '.' + child.name
            } else if (child.type === 'TypeSelector') {
              str += child.name
            } else if (child.type === 'WhiteSpace') {
              str += ' '
            } else if (child.type === 'Combinator') {
              str += ` ${child.name} `
            } else if (child.type === 'AttributeSelector') {
              if (child.value === null) {
                str += `[${child.name.name}]`
              } else if (child.value.value) {
                str += `[${child.name.name}${child.operator}${child.value
                  .value}]`
              } else {
                str += `[${child.name.name}${child.operator}${child.value
                  .name}]`
              }
            } else if (child.type === 'PseudoElementSelector') {
              str += `::${child.name}`
              if (child.children) {
                str += selectorToString(child.children)
              }
            } else if (child.type === 'PseudoClassSelector') {
              str += `:${child.name}`
              if (child.children) {
                str += selectorToString(child.children)
              }
            } else if (child.type === 'SelectorList') {
              str += selectorToString(child.children)
            } else if (child.type === 'Selector') {
              str += `(${selectorToString(child.children)})`
            } else if (child.type === 'Nth') {
              str += `(${child.nth.name})`
            } else if (child.type === 'Identifier') {
              str += `(${child.name})`
            } else {
              // console.error(child);
              // console.error(children);
              console.log('TYPE??', child.type, child)
              console.log(child)
              console.dir(children)
              throw new Error(child.type)
            }
          })
          if (str.indexOf('[object Object]') > -1) {
            console.log(str)
            console.log(children)
            throw new Error('selector string became [object Object]!')
          }
          if (str === '') {
            console.log(children)
            throw new Error('selector string became an empty string!')
          }
          return str
        }

        const decisionsCache = {}

        const clean = (children, callback) => {
          return children.filter(child => {
            if (child.type === 'Rule') {
              const values = child.prelude.value.split(',').map(x => x.trim())
              const keepValues = values.filter(selectorString => {
                if (decisionsCache[selectorString] !== undefined) {
                  return decisionsCache[selectorString]
                }
                const keep = callback(selectorString)
                decisionsCache[selectorString] = keep
                return keep
              })
              if (keepValues.length) {
                // re-write the selector value
                child.prelude.value = keepValues.join(', ')
                return true
              } else {
                return false
              }
              // } else if (
              //   child.type === 'Atrule' &&
              //   child.prelude &&
              //   child.expression.type === 'MediaQueryList'
              // ) {
            } else if (child.type === 'Atrule' && child.name === 'media') {
              // recurse
              child.block.children = clean(child.block.children, callback)
              return child.block.children.length > 0
            } else {
              // Things like comments
              // console.log(child.type);
              // console.dir(child)
            }
            // The default is to keep it.
            return true
          })
        }

        ast.children = clean(ast.children, callback)
        return ast
      }

      const objsCleaned = {}

      const DEAD_OBVIOUS = new Set(['*', 'body', 'html'])

      const links = Array.from(document.querySelectorAll('link'))
      links
        .filter(link => {
          return (
            link.href &&
            (link.rel === 'stylesheet' ||
              link.href.toLowerCase().endsWith('.css')) &&
            !link.href.toLowerCase().startsWith('blob:') &&
            link.media !== 'print'
          )
        })
        .forEach(stylesheet => {
          if (!stylesheetAstObjects[stylesheet.href]) {
            throw new Error(`${stylesheet.href} not in stylesheetAstObjects!`)
          }
          if (!Object.keys(stylesheetAstObjects[stylesheet.href]).length) {
            // If the 'stylesheetAstObjects[stylesheet.href]' thing is an
            // empty object, simply skip this link.
            return
          }
          const obj = stylesheetAstObjects[stylesheet.href]
          objsCleaned[stylesheet.href] = cleaner(obj, selector => {
            // Here's the crucial part. Decide whether to keep the selector

            if (DEAD_OBVIOUS.has(selector)) {
              // low hanging fruit easy ones
              return true
            }

            // Avoid doing a querySelector on hacks that will fail
            if (/:-(ms|moz)-/.test(selector)) {
              // eg. '.form-control:-ms-input-placeholder'
              return true
            }

            try {
              const keep = !!document.querySelector(selector)
              // console.log(keep ? 'KEEP' : 'SKIP', selector);
              // if (keep) {
              //   console.log('KEEP', selector)
              // }
              return keep
            } catch (ex) {
              const exception = ex.toString()
              // console.log('EXCEPTION', exception);
              throw new Error(
                `Unable to querySelector('${selector}') [${exception}]`
              )
            }
          })
        })
      return Promise.resolve(objsCleaned)
    }, stylesheetAstObjects)
    allCleaned.push(cleaned)
  }

  // We can close the browser now that all URLs have been opened.
  if (!options.browser) {
    browser.close()
  }

  // The rest is post-processing all the CSS that was cleaned.

  const allCombinedCss = allCleaned
    .map(cleaned => {
      const combinedCss = Object.keys(cleaned)
        .map(cssUrl => {
          const obj = cleaned[cssUrl]
          const cleanedAst = csstree.fromPlainObject(obj)
          const cleanedCss = csstree.translate(cleanedAst)
          return cleanedCss
        })
        .join('\n')
      return combinedCss
    })
    .join('\n')

  // Why not just allow the return of the "unminified" CSS (in case
  // some odd ball wants it)?
  // Because, the 'allCombinedCss' is a string that concatenates multiple
  // payloads of CSS. It only contains the selectors that are supposedly
  // in the DOM. However it does contain *duplicate* selectors.
  // E.g. `p { color: blue; } p { font-weight: bold; }`
  // When ultimately, what was need is `p { color: blue; font-weight: bold}`.
  // The csso.minify() function will solve this, *and* whitespace minify
  // it too.
  let finalCss = collectImportantComments(allCombinedCss)
  finalCss = csso.minify(finalCss).css
  const returned = { finalCss, stylesheetAstObjects, stylesheetContents }
  return Promise.resolve(returned)
}

module.exports = { run: minimalcss }
