'use strict'

const puppeteer = require('puppeteer')
// @ts-ignore
const csso = require('csso')
// @ts-ignore
const csstree = require('css-tree')
const cheerio = require('cheerio')
const utils = require('./utils')
const url = require('url')

/**
 *
 * @param {Object} ast
 * @return Object
 */
const postProcessKeyframes = ast => {
  // First walk the AST to know which animations are ever mentioned
  // by the remaining rules.
  const activeAnimationNames = new Set(
    csstree.lexer
      .findAllFragments(ast, 'Type', 'keyframes-name')
      .map(entry => csstree.generate(entry.nodes.first()))
  )

  // This is the function we use to filter @keyframes atrules out.
  csstree.walk(ast, {
    visit: 'Atrule',
    enter: (node, item, list) => {
      if (csstree.keyword(node.name).basename === 'keyframes') {
        if (!activeAnimationNames.has(csstree.generate(node.prelude))) {
          list.remove(item)
        }
      }
    }
  })
}

/**
 *
 * @param {{ urls: Array<string>, debug: boolean, loadimages: boolean, skippable: function, browser: any, userAgent: string, withoutjavascript: boolean }} options
 * @return Promise<{ finalCss: string, stylesheetContents: string }>
 */
const minimalcss = async options => {
  const { urls } = options
  const debug = options.debug || false
  const loadimages = options.loadimages || false
  const withoutjavascript = options.withoutjavascript || false
  // const keepPrintAtRules = options.keepPrintAtRules || false
  // XXX The launch options should be a parameter once this is no longer
  // just a cli app.
  const browser = options.browser || (await puppeteer.launch({}))

  const stylesheetAst = {}
  const stylesheetContents = {}
  const doms = []
  const allHrefs = new Set()

  // Note! This opens one URL at a time synchronous
  for (let i = 0; i < urls.length; i++) {
    const pageUrl = urls[i]
    // console.log(url, i);
    const page = await browser.newPage()
    if (options.userAgent) {
      await page.setUserAgent(options.userAgent)
    }

    // A must or else you can't do console.log from within page.evaluate()
    page.on('console', msg => {
      if (debug) {
        // console.log(...(msg.args))
        // console.log(msg.args)
        for (let i = 0; i < msg.args.length; ++i) {
          console.log(`${i}: ${msg.args[i]}`)
        }
      }
    })

    await page.setRequestInterception(true)
    page.on('request', request => {
      if (/data:image\//.test(request.url)) {
        // don't need to download those
        request.abort()
      } else if (
        !loadimages &&
        /\.(png|jpg|jpeg|gif|webp)$/.test(request.url.split('?')[0])
      ) {
        request.abort()
      } else if (stylesheetAst[request.url]) {
        // no point downloading this again
        request.abort()
      } else if (options.skippable && options.skippable(request)) {
        // If the URL of the request that got skipped is a CSS file
        // not having it in stylesheetAst is going to cause a
        // problem later when we loop through all <link ref="stylesheet">
        // tags.
        // So put in an empty (but not falsy!) object for this URL.
        if (request.url.match(/\.css/i)) {
          stylesheetAst[request.url] = {}
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
          const ast = csstree.parse(text)
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
          stylesheetAst[responseUrl] = ast
          stylesheetContents[responseUrl] = text
        })
      }
    })

    page.on('pageerror', error => {
      throw error
    })

    let response

    if (!withoutjavascript) {
      // First, go to the page with JavaScript disabled.
      await page.setJavaScriptEnabled(false)
      response = await page.goto(pageUrl)
      if (!response.ok) {
        throw new Error(`${response.status} on ${pageUrl}`)
      }
      const htmlVanilla = await page.content()
      doms.push(cheerio.load(htmlVanilla))
      await page.setJavaScriptEnabled(true)
    }

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
      waitUntil: ['domcontentloaded', 'networkidle2']
    })
    if (!response.ok) {
      throw new Error(`${response.status} on ${pageUrl} (second time)`)
    }
    const evalNetworkIdle = await page.evaluate(() => {
      // The reason for NOT using a Set here is that that might not be
      // supported in ES5.
      const hrefs = []
      // Loop over all the 'link' elements in the document and
      // for each, collect the URL of all the ones we're going to assess.
      Array.from(document.querySelectorAll('link')).forEach(link => {
        if (
          link.href &&
          (link.rel === 'stylesheet' ||
            link.href.toLowerCase().endsWith('.css')) &&
          !link.href.toLowerCase().startsWith('blob:') &&
          link.media !== 'print'
        ) {
          // if (!stylesheetAst[link.href]) {
          //   throw new Error(`${link.href} not in stylesheetAst!`)
          // }
          // if (!Object.keys(stylesheetAst[link.href]).length) {
          //   // If the 'stylesheetAst[link.href]' thing is an
          //   // empty object, simply skip this link.
          //   return
          // }
          hrefs.push(link.href)
        }
      })
      return {
        html: document.documentElement.outerHTML,
        hrefs
      }
    })

    const htmlNetworkIdle = evalNetworkIdle.html
    doms.push(cheerio.load(htmlNetworkIdle))
    evalNetworkIdle.hrefs.forEach(href => {
      allHrefs.add(href)
    })

    // We can close the browser now that all URLs have been opened.
    if (!options.browser) {
      browser.close()
    }
  }
  // All URLs have been opened, and we now have multiple DOM objects.

  // Now, let's loop over ALL links and process their ASTs compared to
  // the DOMs.
  const decisionsCache = {}
  const isSelectorMatchToAnyElement = selectorString => {
    // Here's the crucial part. Decide whether to keep the selector
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
  }
  allHrefs.forEach(href => {
    const ast = stylesheetAst[href]

    csstree.walk(ast, {
      visit: 'Rule',
      enter: (node, item, list) => {
        node.prelude.children.forEach((node, item, list) => {
          // Translate selector's AST to a string and filter pseudos from it
          // This changes things like `a.button:active` to `a.button`
          const selectorString = utils.reduceCSSSelector(csstree.generate(node))
          if (selectorString in decisionsCache === false) {
            decisionsCache[selectorString] = isSelectorMatchToAnyElement(
              selectorString
            )
          }
          if (!decisionsCache[selectorString]) {
            // delete selector from a list of selectors
            list.remove(item)
          }
        })

        if (node.prelude.children.isEmpty()) {
          // delete rule from a list
          list.remove(item)
        }
      }
    })
  })
  // Every unique URL in every <link> tag has been checked.
  const allCombinedAst = {
    type: 'StyleSheet',
    loc: null,
    children: Object.keys(stylesheetAst).reduce(
      (children, href) => children.appendList(stylesheetAst[href].children),
      new csstree.List()
    )
  }

  // Lift important comments (i.e. /*! comment */) up to the beginning
  const comments = new csstree.List()
  csstree.walk(allCombinedAst, {
    visit: 'Comment',
    enter: (node, item, list) => {
      comments.append(list.remove(item))
    }
  })
  allCombinedAst.children.prependList(comments)

  // Why not just allow the return of the "unminified" CSS (in case
  // some odd ball wants it)?
  // 'allCombinedAst' concatenates multiple payloads of CSS.
  // It only contains the selectors that are supposedly
  // in the DOM. However it does contain *duplicate* selectors.
  // E.g. `p { color: blue; } p { font-weight: bold; }`
  // When ultimately, what was need is `p { color: blue; font-weight: bold}`.
  // The csso.minify() function will solve this, *and* whitespace minify
  // it too.
  csso.compress(allCombinedAst)
  postProcessKeyframes(allCombinedAst)

  const returned = {
    finalCss: csstree.generate(allCombinedAst),
    stylesheetContents
  }
  return Promise.resolve(returned)
}

module.exports = { run: minimalcss }
