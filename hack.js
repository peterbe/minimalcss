const now = require('performance-now')
const puppeteer = require('puppeteer')
const css = require('css')

if (process.argv.length <= 2) {
  console.log('Usage: ' + __filename + ' URL [URL2]')
  process.exit(-1)
}

const urls = process.argv.slice(2)
if (urls.length > 1) {
  throw new Error('Sorry, multiple URLs not supported yet')
}

;(async url => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  // A must or else you can't do console.log from within page.evaluate()
  page.on('console', (...args) => {
    for (let i = 0; i < args.length; ++i) {
      console.log(`${i}: ${args[i]}`)
    }
  })

  await page.setRequestInterceptionEnabled(true)
  page.on('request', request => {
    if (/data:image\//.test(request.url)) {
      // don't need to download those
      request.abort()
    } else if (/\.(png|jpg|jpeg$)/.test(request.url)) {
      request.abort()
    } else {
      // XXX could do things like NOT download from domains like www.google-analytics.com
      request.continue()
    }
  })

  const stylesheetsContents = {}
  // To build up a map of all downloaded CSS
  page.on('response', response => {
    if (/\.css$/i.test(response.url)) {
      response.text().then(text => {
        // https://github.com/reworkcss/css#cssparsecode-options
        stylesheetsContents[response.url] = css.parse(text)
      })
    }
    // console.log(response.text());
  })

  // await page.goto('https://symbols.prod.mozaws.net')
  // await page.screenshot({ path: 'example.png' })
  // await page.goto('https://www.peterbe.com')
  // await page.screenshot({ path: 'example2.png' })
  const selectorsToKeep = {}

  const t0 = now()
  await page.goto(url)
  // await page.goto('https://songsear.ch', { waitUntil: 'networkidle' })
  const t1 = now()
  console.log('TOOK', (t1 - t0).toFixed() + 's')

  const cleaned = await page.evaluate(stylesheetsContents => {
    const clean = (rules, dom) => {
      return rules.filter(rule => {
        // console.log('RULE', rule);
        if (rule.type === 'rule') {
          // console.dir(rule.selectors[0]);
          // decide which selectors to keep
          rule.selectors = rule.selectors.filter(selector => {
            // Here's the crucial part. Decide whether to keep the selector
            try {
              // console.log('SELECTOR', selector, !!dom.querySelector(selector));
              return !!dom.querySelector(selector)
            } catch(ex) {
              console.error("EXCEPTION!!!!", selector, ex.toString());
              return true
            }

            // if (selector === 'p' || selector === '.keep') {
            //   return true
            // } else {
            //   return false
            // }
          })
          if (!rule.selectors.length) {
            // Do not keep this rule!
            return false
          }
        } else if (rule.type === 'media') {
          // maybe keep
          rule.rules = clean(rule.rules, dom)
          return rule.rules.length > 0
        } else if (['keyframes', 'comment', 'font-face'].includes(rule.type)) {
          // keep
          return true
        } else {
          console.warn('TYPE', rule.type)
          console.dir(rule)
        }
        return true
      })
    }

    const astsCleaned = {}

    // console.log("X",Object.keys(stylesheetsContents));
    // return Array.from(document.querySelectorAll('link'))
    const links = Array.from(document.querySelectorAll('link'))
    links
      .filter(link => {
        return (
          link.href &&
          (link.rel === 'stylesheet' ||
            link.href.toLowerCase().endsWith('.css'))
        )
      })
      .forEach(stylesheet => {
        // For this specific stylesheet, let's look up what's actually needed
        // based on what's actually in the DOM.
        // XXX Need to make sure 'stylesheet.href' is a absolute full URL
        const ast = stylesheetsContents[stylesheet.href]
        ast.stylesheet.rules = clean(ast.stylesheet.rules, document)
        astsCleaned[stylesheet.href] = ast
        // console.log('URL', stylesheet.href)
        // const result = css.stringify(ast)
        // console.log(result)

        // console.log(cssAST.stylesheet.rules);
      })
    // console.log(Object.keys(stylesheetsContents));
    return Promise.resolve(astsCleaned)
  }, stylesheetsContents)

  // console.log('ASTS CLEANED');
  // console.log(cleaned);
  Object.keys(cleaned).forEach(url => {
    console.log('For URL', url);
    const ast = cleaned[url]
    const result = css.stringify(ast)
    console.log(result)

  })
  // cleaned.(result => {
  //   console.log();
  // })
  // const foo = stylesheets.filter(link => {
  //   console.log('LINK', typeof link)
  //   console.dir(link)
  //   return true
  // })
  //
  // console.log('STYLESHEETS', stylesheets)

  // const stylesheets = Array.from(document.querySelectorAll('link'))
  // stylesheets.forEach(stylesheet => {
  //   console.log('stylesheet:', stylesheet)
  // })
  // await page.screenshot({ path: 'example.png', fullPage: true })

  browser.close()
})(urls[0])
