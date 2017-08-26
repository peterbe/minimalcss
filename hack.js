const now = require('performance-now')
const puppeteer = require('puppeteer')
// const css = require('css')
const UglifyJS = require('uglify-js')
const csstree = require('css-tree')

// const cleaner = require('./cleaner2')

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
    const url = response.url
    if (/\.css$/i.test(url)) {
      response.text().then(text => {
        const ast = csstree.parse(text, { parseValue: false })
        const obj = csstree.toPlainObject(ast)
        stylesheetsContents[url] = obj
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

  const cleaned = await page.evaluate(stylesheetsContents => {

    const cleaner = (obj, callback) => {

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
              str += `[${child.name.name}${child.operator}${child.value.value}]`
            } else {
              str += `[${child.name.name}${child.operator}${child.value.name}]`
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
            console.log(child);
            console.dir(children)
            throw new Error(child.type)
          }
        })
        if (str.indexOf('[object Object]') > -1) {
          console.log(str);
          console.log(children);
          throw new Error('selector string became [object Object]!')
        }
        if (str === '') {
          console.log(children);
          throw new Error('selector string became an empty string!')
        }
        return str
      }

      const decisionsCache = {}

      const clean = (children, callback) => {
        return children.filter(child => {
          if (child.type === 'Rule') {
            child.selector.children = child.selector.children.filter(
              selectorChild => {
                // console.dir(selectorChild);
                const selectorString = selectorToString(selectorChild.children)
                if (decisionsCache[selectorString] !== undefined) {
                  return decisionsCache[selectorString]
                }
                const keep = callback(selectorString)
                decisionsCache[selectorString] = keep
                return keep
              }
            )
            return child.selector.children.length > 0
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

      obj.children = clean(obj.children, callback)
      return obj

    }

    const objsCleaned = {}

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
        // console.log(`STYLESHEET ${stylesheet.href}`);
        // console.log(`stylesheetsContents keys ${Object.keys(stylesheetsContents)}`);
        // For this specific stylesheet, let's look up what's actually needed
        // based on what's actually in the DOM.
        // XXX Need to make sure 'stylesheet.href' is a absolute full URL
        const obj = stylesheetsContents[stylesheet.href]
        // if (typeof ast === 'undefined') {
        //   throw new Error(
        //     `Unable to find ${stylesheet.href} in stylesheetsContents`
        //   )
        // }
        // ast.stylesheet.rules = clean(ast.stylesheet.rules, document)
        objsCleaned[stylesheet.href] = cleaner(obj, selector => {
          // console.log(`selector '${selector}'`);
          // Here's the crucial part. Decide whether to keep the selector

          // Avoid doing a querySelector on hacks that will fail
          if (/:-(ms|moz)-/.test(selector)) {  // '.form-control:-ms-input-placeholder'
            return true
          }

          try {
            const keep = !!document.querySelector(selector)
            // if (keep) {
            //   console.log(`KEEP '${selector}'`);
            // } else {
            //   console.log(`DISCARD '${selector}'`);
            // }
            return keep
          } catch (ex) {
            console.error("EXCEPTION!!!!", selector, ex.toString());
            return true
          }
        })
      })
    return Promise.resolve(objsCleaned)
  }, stylesheetsContents)

  Object.keys(cleaned).forEach(url => {
    // console.log('For URL', url);
    const obj = cleaned[url]
    const cleanedAst = csstree.fromPlainObject(obj)
    const cleanedCSS = csstree.translate(cleanedAst)
    console.log(cleanedCSS);
  })

  browser.close()
})(urls[0])
