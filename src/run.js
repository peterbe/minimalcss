'use strict'

const puppeteer = require('puppeteer')
const csso = require('csso')
const csstree = require('css-tree')
const cleanRepeatedComments = require('./utils').cleanRepeatedComments


const minimalcss = (async options => {
  const { urls } = options
  // XXX The launch options should be a parameter once this is no longer
  // just a cli app.
  const browser = await puppeteer.launch({})
  // const page = await browser.newPage()

  const stylesheetsContents = {}
  const allCleaned = []
  // Note! This opens one URL at a time synchronous
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    // console.log(url, i);
    const page = await browser.newPage()

    // A must or else you can't do console.log from within page.evaluate()
    page.on('console', (...args) => {
      // XXX Should we install just call console.log(...args)?
      for (let i = 0; i < args.length; ++i) {
        console.log(`${i}: ${args[i]}`)
      }
    })

    // XXX Isn't there a better way to enable options like this?
    await page.setRequestInterceptionEnabled(true)
    page.on('request', request => {
      if (/data:image\//.test(request.url)) {
        // don't need to download those
        request.abort()
      } else if (/\.(png|jpg|jpeg$)/.test(request.url)) {
        request.abort()
      } else if (stylesheetsContents[request.url]) {
        // no point downloading this again
        request.abort()
      } else {
        // XXX could do things like NOT download from domains like www.google-analytics.com
        request.continue()
      }
    })

    // To build up a map of all downloaded CSS
    page.on('response', response => {
      const url = response.url
      if (/\.css$/i.test(url)) {
        response.text().then(text => {
          const ast = csstree.parse(text, {
            parseValue: false,
            parseSelector: false
          })
          stylesheetsContents[url] = csstree.toPlainObject(ast)
        })
      }
    })

    // await page.goto(url)
    const response = await page.goto(url, { waitUntil: 'networkidle' })
    if (!response.ok) {
      throw new Error(`${response.status} on ${url}`)
    }

    const cleaned = await page.evaluate(stylesheetsContents => {
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
              const values = child.selector.value
                .split(',')
                .map(x => x.trim())
              // console.log(`VALUES ${values} ${values.length}`);
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
                child.selector.value = keepValues.join(', ')
                return true
              } else {
                return false
              }
            } else if (
              child.type === 'Atrule' &&
              child.expression &&
              child.expression.type === 'MediaQueryList'
            ) {
              // recurse
              child.block.children = clean(child.block.children, callback)
              return child.block.children.length > 0
            } else {
              // console.log(child.type);
              // console.dir(child)
            }
            return true
          })
        }

        ast.children = clean(ast.children, callback)
        return ast
      }

      const objsCleaned = {}

      const links = Array.from(document.querySelectorAll('link'))
      links
        .filter(link => {
          return (
            link.href &&
            (link.rel === 'stylesheet' ||
              link.href.toLowerCase().endsWith('.css')) &&
            link.media !== 'print'
          )
        })
        .forEach(stylesheet => {
          const obj = stylesheetsContents[stylesheet.href]
          objsCleaned[stylesheet.href] = cleaner(obj, selector => {
            // Here's the crucial part. Decide whether to keep the selector

            // Avoid doing a querySelector on hacks that will fail
            if (/:-(ms|moz)-/.test(selector)) {
              // eg. '.form-control:-ms-input-placeholder'
              return true
            }
            try {
              const keep = !!document.querySelector(selector)
              return keep
            } catch (ex) {
              const exception = es.toString()
              throw new Error(
                `Unable to querySelector('${selector}') [${exception}]`
              )
            }
          })
        })
      return Promise.resolve(objsCleaned)
    }, stylesheetsContents)
    allCleaned.push(cleaned)
  }

  // We can close the browser now that all URLs have been opened.
  browser.close()

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
  const minifiedCss = csso.minify(allCombinedCss).css
  const cleanMinifiedCss = cleanRepeatedComments(minifiedCss)
  return Promise.resolve(cleanMinifiedCss)
})

module.exports = {run: minimalcss}
