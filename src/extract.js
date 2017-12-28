'use strict'

// @ts-ignore
const fetch = require('node-fetch')
// @ts-ignore
const csso = require('csso')
// @ts-ignore
const csstree = require('css-tree')
const url = require('url')
const utils = require('./utils')

/**
 *
 * @param  {Array<any>} doms
 * @param  {any} options
 * @return Promise<{ finalCss: string, stylesheetAstObjects: any, stylesheetContents: string }>
 */
const extract = async (doms, options) => {
  const debug = options.debug || false

  // XXX implement this part
  // do we need to pass urls along with the doms?
  const host = ''
  const stylesheetAstObjects = {}
  const stylesheetContents = {}
  const allHrefs = new Set()

  doms.forEach(dom => {
    // Loop over all the 'link' elements in the document and
    // for each, collect the URL of all the ones we're going to assess.
    dom('link').forEach(link => {
      if (
        link.href &&
        (link.rel === 'stylesheet' ||
          link.href.toLowerCase().endsWith('.css')) &&
        !link.href.toLowerCase().startsWith('blob:') &&
        link.media !== 'print'
      ) {
        // XXX do we need styles?
        // XXX do we need to resolve relative pathes?
        allHrefs.add(link.href)
      }
    })
  })

  // XXX implement this part
  // If the URL of the request that got skipped is a CSS file
  // not having it in stylesheetAstObjects is going to cause a
  // problem later when we loop through all <link ref="stylesheet">
  // tags.
  // So put in an empty (but not falsy!) object for this URL.
  // if (request.url.match(/\.css/i)) {
  //   stylesheetAstObjects[request.url] = {}
  //   stylesheetContents[request.url] = ''
  // }
  await Promise.all(
    Array.from(allHrefs).map(href =>
      fetch(href).then(response => {
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
                const sameHost = url.parse(responseUrl).host === host
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
    )
  )

  // Now, let's loop over ALL links and process their ASTs compared to
  // the DOMs.
  const objsCleaned = {}
  const decisionsCache = {}
  const DEAD_OBVIOUS = new Set(['*', 'body', 'html'])

  allHrefs.forEach(href => {
    const ast = stylesheetAstObjects[href]
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

    ast.children = clean(ast.children, selectorString => {
      // Here's the crucial part. Decide whether to keep the selector
      if (DEAD_OBVIOUS.has(selectorString)) {
        // low hanging fruit easy ones.
        return true
      }
      // This changes things like `a.button:active` to `a.button`
      const originalSelectorString = selectorString
      selectorString = utils.reduceCSSSelector(originalSelectorString)
      // Find at least 1 DOM that contains an object that matches
      // this selector string.
      return doms.some(dom => {
        try {
          return dom(selectorString).length > 0
        } catch (ex) {
          // Be conservative. If we can't understand the selector,
          // best to leave it in.
          if (debug) {
            console.warn(selectorString, ex.toString())
          }
          return true
        }
      })
    })
    objsCleaned[href] = ast
  })
  // Every unique URL in every <link> tag has been checked.
  const allCombinedCss = Object.keys(objsCleaned)
    .map(cssUrl => {
      return csstree.translate(csstree.fromPlainObject(objsCleaned[cssUrl]))
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
  let finalCss = utils.collectImportantComments(allCombinedCss)
  finalCss = csso.minify(finalCss).css
  const returned = { finalCss, stylesheetAstObjects, stylesheetContents }
  return Promise.resolve(returned)
}

module.exports = { extract: extract }
