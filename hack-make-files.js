const now = require('performance-now')
const puppeteer = require('puppeteer')
// const css = require('css')

if (process.argv.length <= 2) {
  console.log('Usage: ' + __filename + ' URL [URL2...]')
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
    const url = response.url
    if (/\.css$/i.test(url)) {
      response.text().then(text => {
        // const ast = csstree.parse(text, { parseValue: false })
        // const obj = csstree.toPlainObject(ast)
        stylesheetsContents[url] = text
      })
    }
  })

  // await page.goto('https://symbols.prod.mozaws.net')
  // await page.screenshot({ path: 'example.png' })
  // await page.goto('https://www.peterbe.com')
  // await page.screenshot({ path: 'example2.png' })

  const t0 = now()
  // await page.goto(url)
  await page.goto(url, { waitUntil: 'networkidle' })
  const t1 = now()
  // console.log('TOOK', (t1 - t0).toFixed() + 's')

  // const linkUrls = await page.evaluate(stylesheetsContents => {
  const linkUrls = await page.evaluate(() => {
    const linkUrls = []
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
        linkUrls.push(stylesheet.href)
      })
    return Promise.resolve(linkUrls)
  })

  console.log('CSS DOWNLOADED');
  console.log(Object.keys(stylesheetsContents));
  console.log('URL-to-STYLESHEETS');
  console.dir(linkUrls);
  // Object.keys(cleaned).forEach(url => {
  //   // console.log('For URL', url);
  //   const obj = cleaned[url]
  //   const cleanedAst = csstree.fromPlainObject(obj)
  //   const cleanedCSS = csstree.translate(cleanedAst)
  //   console.log(cleanedCSS)
  // })

  browser.close()
})(urls[0])
