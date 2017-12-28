'use strict'

const puppeteer = require('puppeteer')
const cheerio = require('cheerio')
const { extract } = require('./extract')

/**
 *
 * @param {{ urls: Array<string>, debug: boolean, loadimages: boolean, skippable: function, browser: any, userAgent: string, withoutjavascript: boolean }} options
 * @return Promise<{ finalCss: string, stylesheetAstObjects: any, stylesheetContents: string }>
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

  const doms = []

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
      } else if (options.skippable && options.skippable(request)) {
        request.abort()
      } else {
        request.continue()
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

    const htmlNetworkIdle = await page.content()
    doms.push(cheerio.load(htmlNetworkIdle))
    await page.close()
  }

  // We can close the browser now that all URLs have been opened.
  if (!options.browser) {
    browser.close()
  }

  // All URLs have been opened, and we now have multiple DOM objects.
  return extract(doms, options)
}

module.exports = { run: minimalcss }
