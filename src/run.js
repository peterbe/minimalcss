'use strict'

const puppeteer = require('puppeteer')
// @ts-ignore
const csso = require('csso')
// @ts-ignore
const csstree = require('css-tree')
const utils = require('./utils')
const url = require('url')

/**
 * Take in a csstree AST, mutate it and return a csstree AST.
 * The mutation is about:
 *
 *   1) Remove all keyframe declarations that are *not* mentioned
 *      by animation name.
 *   2) Remove all font-face declarations that are *not* mentioned
 *      as the font-family.
 *
 * The gist of the function is that it walks the AST, populates sets
 * that track the names of all animations and font families. Then,
 * it converts the AST to a plain object, which it mutates by filtering
 * the 'children' object.
 * Lastly it uses the csstree's fromPlainObject to return the plain
 * object back as an AST.
 * @param {Object} ast
 * @return Object
 */
const postProcessOptimize = ast => {
  // First walk the AST to know which animations are ever mentioned
  // by the remaining rules.
  const activeAnimationNames = new Set(
    csstree.lexer
      .findAllFragments(ast, 'Type', 'keyframes-name')
      .map(entry => csstree.generate(entry.nodes.first()))
  )

  // This is the function we use to filter @keyframes atrules out,
  // if its name is not actively used.
  // It also filters out all `@media print` atrules.
  csstree.walk(ast, {
    visit: 'Atrule',
    enter: (node, item, list) => {
      const basename = csstree.keyword(node.name).basename
      if (basename === 'keyframes') {
        if (!activeAnimationNames.has(csstree.generate(node.prelude))) {
          list.remove(item)
        }
      } else if (basename === 'media') {
        if (csstree.generate(node.prelude) === 'print') {
          list.remove(item)
        }
      }
    }
  })

  // Now figure out what font-families are at all used in the AST.
  const activeFontFamilyNames = new Set()
  csstree.walk(ast, {
    visit: 'Declaration',
    enter: function(node) {
      // walker pass through `font-family` declarations inside @font-face too
      // this condition filter them, to walk through declarations
      // inside a rules only.
      if (this.rule) {
        csstree.lexer
          .findDeclarationValueFragments(node, 'Type', 'family-name')
          .forEach(entry => {
            const name = utils.unquoteString(
              csstree.generate({
                type: 'Value',
                children: entry.nodes
              })
            )
            activeFontFamilyNames.add(name)
          })
      }
    }
  })

  // Walk into every font-family rule and inspect if we uses its declarations
  csstree.walk(ast, {
    visit: 'Atrule',
    enter: (atrule, atruleItem, atruleList) => {
      if (csstree.keyword(atrule.name).basename === 'font-face') {
        // We're inside a font-face rule! Let's dig deeper.
        csstree.walk(atrule, {
          visit: 'Declaration',
          enter: declaration => {
            if (csstree.property(declaration.property).name === 'font-family') {
              const name = utils.unquoteString(
                csstree.generate(declaration.value)
              )
              // was this @font-face used?
              if (!activeFontFamilyNames.has(name)) {
                atruleList.remove(atruleItem)
              }
            }
          }
        })
      }
    }
  })
}

const processPage = ({
  page,
  options,
  pageUrl,
  stylesheetAsts,
  stylesheetContents
}) =>
  new Promise(async (resolve, reject) => {
    // If anything goes wrong, for example a `pageerror` event or
    // a bad download request (e.g. !response.ok), then remember that
    // we have fulfilled the promise and don't want to call `reject` or `resolve`
    // a second time.
    let fulfilledPromise = false

    const safeReject = error => {
      if (!fulfilledPromise) {
        reject(error)
      }
    }

    const debug = options.debug || false
    const loadimages = options.loadimages || false
    const withoutjavascript = options.withoutjavascript || false

    try {
      if (options.userAgent) {
        await page.setUserAgent(options.userAgent)
      }

      if (options.viewport) {
        await page.setViewport(options.viewport)
      }

      // A must or else you can't do console.log from within page.evaluate()
      page.on('console', msg => {
        if (debug) {
          // console.log(...(msg.args))
          // console.log(msg.args)
          for (let i = 0; i < msg.args.length; +i) {
            console.log(`${i}: ${msg.args[i]}`)
          }
        }
      })

      await page.setRequestInterception(true)
      page.on('request', request => {
        if (/data:image\//.test(request.url())) {
          // don't need to download those
          request.abort()
        } else if (
          !loadimages &&
          /\.(png|jpg|jpeg|gif|webp)$/.test(request.url().split('?')[0])
        ) {
          request.abort()
        } else if (stylesheetAsts[request.url()]) {
          // no point downloading this again
          request.abort()
        } else if (options.skippable && options.skippable(request)) {
          // If the URL of the request that got skipped is a CSS file
          // not having it in stylesheetAsts is going to cause a
          // problem later when we loop through all <link ref="stylesheet">
          // tags.
          // So put in an empty (but not falsy!) object for this URL.
          if (request.url().match(/\.css/i)) {
            stylesheetAsts[request.url()] = {}
            stylesheetContents[request.url()] = ''
          }
          request.abort()
        } else {
          request.continue()
        }
      })

      // To build up a map of all downloaded CSS
      page.on('response', response => {
        const responseUrl = response.url()
        const ct = response.headers()['content-type'] || ''
        if (!response.ok()) {
          return safeReject(new Error(`${response.status()} on ${responseUrl}`))
        }
        if (ct.indexOf('text/css') > -1 || /\.css$/i.test(responseUrl)) {
          response.text().then(text => {
            const ast = csstree.parse(text)
            csstree.walk(ast, node => {
              if (node.type === 'Url') {
                let value = node.value
                let path = value.value
                if (value.type !== 'Raw') {
                  path = path.substr(1, path.length - 2)
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
                if (value.type !== 'Raw') {
                  value.value = `"${path}"`
                } else {
                  value.value = path
                }
              }
            })
            stylesheetAsts[responseUrl] = ast
            stylesheetContents[responseUrl] = text
          })
        }
      })

      page.on('pageerror', error => {
        safeReject(error)
      })

      let response

      // XXX There is another use case *between* the pure DOM (without any
      // javascript) and after the network is idle.
      // For example, any CSSOM that is *made by javascript* but goes away
      // after all XHR is finished loading.
      // What we can do is do that lookup here using...
      //    response = await page.goto(pageUrl, {
      //        waitUntil: ['domcontentloaded']
      //    })
      // And add that to the list of DOMs.
      // This will slow down the whole processing marginally.

      // Second, goto the page and evaluate it on the 'networkidle2' event.
      // This gives the page a chance to load any <script defer src="...">
      // and even some JS that does XHR requests right after load.
      response = await page.goto(pageUrl, {
        waitUntil: ['domcontentloaded', 'networkidle0']
      })
      if (!response.ok()) {
        return safeReject(
          new Error(`${response.status()} on ${pageUrl} (second time)`)
        )
      }

      if (!fulfilledPromise) resolve()
    } catch (e) {
      return safeReject(e)
    }
  })

/**
 *
 * @param {{ urls: Array<string>, debug: boolean, loadimages: boolean, skippable: function, browser: any, userAgent: string, withoutjavascript: boolean, viewport: any }} options
 * @return Promise<{ finalCss: string, stylesheetContents: { [key: string]: string } }>
 */
const minimalcss = async options => {
  const { urls } = options
  const debug = options.debug || false
  // const keepPrintAtRules = options.keepPrintAtRules || false
  // XXX The launch options should be a parameter once this is no longer
  // just a cli app.
  const browser = options.browser || (await puppeteer.launch({}))

  const stylesheetAsts = {}
  const stylesheetContents = {}
  const doms = []
  const allHrefs = new Set()
  const stylesheetUsed = []

  try {
    // Note! This opens one URL at a time synchronous
    for (let i = 0; i < urls.length; i++) {
      const pageUrl = urls[i]
      const page = await browser.newPage()
      //Start sending raw DevTools Protocol commands are sent using `client.send()`
      //First off enable the necessary "Domains" for the DevTools commands we care about
      const client = await page.target().createCDPSession()
      await client.send('Page.enable')
      await client.send('DOM.enable')
      await client.send('CSS.enable')

      //Start tracking CSS coverage
      await client.send('CSS.startRuleUsageTracking')
      const inlineStylesheetIndex = new Set()
      client.on('CSS.styleSheetAdded', stylesheet => {
        const { header } = stylesheet
        if (
          header.isInline ||
          header.sourceURL === '' ||
          header.sourceURL.startsWith('blob:')
        ) {
          inlineStylesheetIndex.add(header.styleSheetId)
        }
      })
      try {
        await processPage({
          page,
          options,
          pageUrl,
          stylesheetAsts,
          stylesheetContents
        })
        const rules = await client.send('CSS.takeCoverageDelta')
        const usedRules = rules.coverage.filter(rule => {
          return rule.used
        })

        const slices = []
        for (const usedRule of usedRules) {
          // console.log(usedRule.styleSheetId)
          if (inlineStylesheetIndex.has(usedRule.styleSheetId)) {
            continue
          }

          const stylesheet = await client.send('CSS.getStyleSheetText', {
            styleSheetId: usedRule.styleSheetId
          })

          slices.push(
            stylesheet.text.slice(usedRule.startOffset, usedRule.endOffset)
          )
        }

        stylesheetUsed.push(slices.join(''))
      } catch (e) {
        throw e
      } finally {
        await page.close()
      }
    }
  } catch (e) {
    throw e
  } finally {
    // We can close the browser now that all URLs have been opened.
    if (!options.browser) {
      browser.close()
    }
  }

  // Every unique URL in every <link> tag has been checked.
  // const allCombinedAst = {
  //   type: 'StyleSheet',
  //   loc: null,
  //   children: Object.keys(stylesheetAsts).reduce(
  //     (children, href) => children.appendList(stylesheetAsts[href].children),
  //     new csstree.List()
  //   )
  // }

  // Lift important comments (i.e. /*! comment */) up to the beginning
  // const comments = new csstree.List()
  // csstree.walk(allCombinedAst, {
  //   visit: 'Comment',
  //   enter: (_node, item, list) => {
  //     comments.append(list.remove(item))
  //   }
  // })
  // allCombinedAst.children.prependList(comments)

  // Why not just allow the return of the "unminified" CSS (in case
  // some odd ball wants it)?
  // 'allCombinedAst' concatenates multiple payloads of CSS.
  // It only contains the selectors that are supposedly
  // in the DOM. However it does contain *duplicate* selectors.
  // E.g. `p { color: blue; } p { font-weight: bold; }`
  // When ultimately, what was need is `p { color: blue; font-weight: bold}`.
  // The csso.minify() function will solve this, *and* whitespace minify
  // it too.
  // csso.compress(allCombinedAst)
  // postProcessOptimize(allCombinedAst)

  const returned = {
    finalCss: csso.minify(stylesheetUsed.join('')).css,
    stylesheetContents
  }
  return Promise.resolve(returned)
}

module.exports = { run: minimalcss }
