'use strict';

const puppeteer = require('puppeteer');
// @ts-ignore
const csso = require('csso');
// @ts-ignore
const csstree = require('css-tree');
const cheerio = require('cheerio');
const utils = require('./utils');
const { createTracker } = require('./tracker');
const url = require('url');

const isOk = (response) => response.ok() || response.status() === 304;

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
const postProcessOptimize = (ast) => {
  // First walk the AST to know which animations are ever mentioned
  // by the remaining rules.
  const activeAnimationNames = new Set(
    csstree.lexer
      .findAllFragments(ast, 'Type', 'keyframes-name')
      .map((entry) => csstree.generate(entry.nodes.first()))
  );

  // This is the function we use to filter @keyframes atrules out,
  // if its name is not actively used.
  // It also filters out all `@media print` atrules.
  csstree.walk(ast, {
    visit: 'Atrule',
    enter: (node, item, list) => {
      const basename = csstree.keyword(node.name).basename;
      if (basename === 'keyframes') {
        if (!activeAnimationNames.has(csstree.generate(node.prelude))) {
          list.remove(item);
        }
      } else if (basename === 'media') {
        if (csstree.generate(node.prelude) === 'print') {
          list.remove(item);
        }
      }
    },
  });

  // Now figure out what font-families are at all used in the AST.
  const activeFontFamilyNames = new Set();
  csstree.walk(ast, {
    visit: 'Declaration',
    enter: function (node) {
      // walker pass through `font-family` declarations inside @font-face too
      // this condition filter them, to walk through declarations
      // inside a rules only.
      if (this.rule) {
        csstree.lexer
          .findDeclarationValueFragments(node, 'Type', 'family-name')
          .forEach((entry) => {
            const name = utils.unquoteString(
              csstree.generate({
                type: 'Value',
                children: entry.nodes,
              })
            );
            activeFontFamilyNames.add(name);
          });
      }
    },
  });

  // Walk into every font-family rule and inspect if we uses its declarations
  csstree.walk(ast, {
    visit: 'Atrule',
    enter: (atrule, atruleItem, atruleList) => {
      if (csstree.keyword(atrule.name).basename === 'font-face') {
        // We're inside a font-face rule! Let's dig deeper.
        csstree.walk(atrule, {
          visit: 'Declaration',
          enter: (declaration) => {
            if (csstree.property(declaration.property).name === 'font-family') {
              const name = utils.unquoteString(
                csstree.generate(declaration.value)
              );
              // was this @font-face used?
              if (!activeFontFamilyNames.has(name)) {
                atruleList.remove(atruleItem);
              }
            }
          },
        });
      }
    },
  });
};

const processStylesheet = ({
  text,
  pageUrl,
  responseUrl,
  stylesheetAsts,
  stylesheetContents,
}) => {
  const ast = csstree.parse(text);
  csstree.walk(ast, (node) => {
    if (node.type !== 'Url') return;
    const value = node.value;
    let path = value.value;
    if (value.type !== 'Raw') {
      path = path.substr(1, path.length - 2);
    }
    const sameHost = url.parse(responseUrl).host === url.parse(pageUrl).host;
    if (/^https?:\/\/|^\/\/|^data:/i.test(path)) {
      // do nothing
    } else if (/^\//.test(path) && sameHost) {
      // do nothing
    } else {
      const resolved = new url.URL(path, responseUrl);
      if (sameHost) {
        path = resolved.pathname + resolved.search;
      } else {
        path = resolved.href;
      }
      if (value.type !== 'Raw') {
        value.value = `"${path}"`;
      } else {
        value.value = path;
      }
    }
  });
  stylesheetAsts[responseUrl] = ast;
  stylesheetContents[responseUrl] = text;
};

const processPage = ({
  page,
  options,
  pageUrl,
  stylesheetAsts,
  stylesheetContents,
  doms,
  allHrefs,
  redirectResponses,
  skippedUrls,
}) =>
  new Promise(async (resolve, reject) => {
    // If anything goes wrong, for example a `pageerror` event or
    // a bad download request (e.g. !response.ok), then remember that
    // we have fulfilled the promise and don't want to call `reject` or `resolve`
    // a second time.
    let fulfilledPromise = false;

    const tracker = createTracker(page);
    const safeReject = (error) => {
      if (fulfilledPromise) return;
      fulfilledPromise = true;
      if (error.message.startsWith('Navigation timeout')) {
        const urls = tracker.urls();
        if (urls.length > 1) {
          error.message += `\nTracked URLs that have not finished: ${urls.join(
            ', '
          )}`;
        } else if (urls.length > 0) {
          error.message += `\nFor ${urls[0]}`;
        }
      }
      tracker.dispose();
      reject(error);
    };

    const debug = options.debug || false;
    const loadimages = options.loadimages || false;
    const styletags = options.styletags || false;
    const withoutjavascript =
      options.withoutjavascript === undefined
        ? true
        : !!options.withoutjavascript;
    const disableJavaScript = !!options.disableJavaScript;

    try {
      if (options.userAgent) {
        await page.setUserAgent(options.userAgent);
      }

      if (options.viewport) {
        await page.setViewport(options.viewport);
      }

      if (options.timeout !== undefined) {
        page.setDefaultNavigationTimeout(options.timeout);
      }

      // A must or else you can't do console.log from within page.evaluate()
      page.on('console', (msg) => {
        if (debug) {
          for (let i = 0; i < msg.args.length; ++i) {
            console.log(`${i}: ${msg.args[i]}`);
          }
        }
      });

      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        const requestUrl = request.url();
        if (/data:image\//.test(requestUrl)) {
          // don't need to download those
          request.abort();
        } else if (!loadimages && resourceType === 'image') {
          request.abort();
        } else if (resourceType === 'font') {
          request.abort();
        } else if (stylesheetAsts[requestUrl]) {
          // no point downloading this again
          request.abort();
        } else if (options.skippable && options.skippable(request)) {
          // If the URL of the request that got skipped is a CSS file
          // not having it in stylesheetAsts is going to cause a
          // problem later when we loop through all <link ref="stylesheet">
          // tags.
          // So put in an empty (but not falsy!) object for this URL.
          skippedUrls.add(requestUrl);
          request.abort();
        } else {
          request.continue();
        }
      });

      // To build up a map of all downloaded CSS
      page.on('response', (response) => {
        const responseUrl = response.url();
        const resourceType = response.request().resourceType();
        if (response.status() >= 400) {
          return safeReject(
            new Error(`${response.status()} on ${responseUrl}`)
          );
        } else if (response.status() >= 300 && response.status() !== 304) {
          // If the 'Location' header points to a relative URL,
          // convert it to an absolute URL.
          // If it already was an absolute URL, it stays like that.
          const redirectsTo = new url.URL(
            response.headers().location,
            responseUrl
          ).toString();
          redirectResponses[responseUrl] = redirectsTo;
        } else if (resourceType === 'stylesheet') {
          response.text().then((text) => {
            processStylesheet({
              text,
              pageUrl,
              responseUrl,
              stylesheetAsts,
              stylesheetContents,
            });
          });
        }
      });

      page.on('pageerror', (error) => {
        if (options.ignoreJSErrors) {
          console.warn(error);
        } else {
          safeReject(error);
        }
      });

      let response;

      if (disableJavaScript) {
        await page.setJavaScriptEnabled(false);
      } else if (withoutjavascript) {
        // First, go to the page with JavaScript disabled.
        await page.setJavaScriptEnabled(false);
        response = await page.goto(pageUrl);
        if (!isOk(response)) {
          return safeReject(new Error(`${response.status()} on ${pageUrl}`));
        }
        const htmlVanilla = await page.content();
        doms.push(cheerio.load(htmlVanilla));
        await page.setJavaScriptEnabled(true);
      }

      // There is another use case *between* the pure DOM (without any
      // javascript) and after the network is idle.
      // For example, any CSSOM that is *made by javascript* but goes away
      // after all XHR is finished loading.
      // What we can do is do that lookup here using...
      //    response = await page.goto(pageUrl, {
      //        waitUntil: ['domcontentloaded']
      //    })
      // And add that to the list of DOMs.
      // This will slow down the whole processing marginally.

      // Second, goto the page and evaluate it with JavaScript.
      // The 'waitUntil' option determines how long we wait for all
      // possible assets to load.
      response = await page.goto(pageUrl, { waitUntil: 'networkidle0' });
      if (!isOk(response)) {
        return safeReject(
          new Error(`${response.status()} on ${pageUrl} (second time)`)
        );
      }
      const evalWithJavascript = await page.evaluate(() => {
        const html = document.documentElement.outerHTML;
        // The reason for NOT using a Set here is that that might not be
        // supported in ES5.
        const hrefs = [];
        const styles = [];
        const isCssStyleTag = (elem) =>
          elem.tagName === 'STYLE' &&
          (!elem.type || elem.type.toLowerCase() === 'text/css');

        const isStylesheetLink = (elem) =>
          elem.tagName === 'LINK' &&
          elem.href &&
          elem.rel.toLowerCase() === 'stylesheet' &&
          !elem.href.toLowerCase().startsWith('data:') &&
          !elem.href.toLowerCase().startsWith('blob:') &&
          elem.media.toLowerCase() !== 'print';

        // #fragments are omitted from puppeteer's response.url(), so
        // we need to strip them from stylesheet links, otherwise the
        // hrefs won't always match when we check for missing ASTs.
        const defragment = (href) => href.split('#')[0];
        const pageUrl = defragment(window.location.href);
        // Create a unique identifier for each style tag by appending
        // an xpath-like fragment to the page URL.  This allows us to
        // preserve the relative ordering of external stylesheets and
        // inline style tags.
        const styleTagUri = () => `${pageUrl}#style[${styles.length}]`;
        // Loop over all 'link' and 'style' elements in the document,
        // in order of appearance. For each element, collect the URI
        // of all the ones we're going to assess. For style elements,
        // also extract each tag's content.
        Array.from(document.querySelectorAll('link, style')).forEach((elem) => {
          if (isStylesheetLink(elem)) {
            const href = defragment(elem.href);
            hrefs.push(href);
          } else if (isCssStyleTag(elem)) {
            const href = styleTagUri();
            const text = elem.innerHTML;
            styles.push({ href, text });
            hrefs.push(href);
          }
        });
        return { html, hrefs, styles };
      });

      const htmlWithJavascript = evalWithJavascript.html;
      doms.push(cheerio.load(htmlWithJavascript));

      if (styletags) {
        // Parse each style tag as if it were an external stylesheet.
        evalWithJavascript.styles.forEach(({ href, text }) => {
          processStylesheet({
            text,
            pageUrl,
            stylesheetAsts,
            stylesheetContents,
            responseUrl: href,
          });
        });
      } else {
        // Remove each style tag URI from the list of hrefs.
        evalWithJavascript.styles.forEach(({ href }) => {
          evalWithJavascript.hrefs.splice(
            evalWithJavascript.hrefs.indexOf(href),
            1
          );
        });
      }

      evalWithJavascript.hrefs.forEach((href) => {
        // The order of allHrefs is important! That's what browsers do.
        // But we can't blindly using allHrefs.push() because the href
        // *might* already have been encountered. If it has been encountered
        // before, remove it and add it to the end of the array.
        if (allHrefs.includes(href)) {
          allHrefs.splice(allHrefs.indexOf(href), 1);
        }
        allHrefs.push(href);
      });

      if (!fulfilledPromise) {
        tracker.dispose();
        resolve();
      }
    } catch (e) {
      return safeReject(e);
    }
  });

/**
 *
 * @param {{ urls: Array<string>, debug: boolean, loadimages: boolean, skippable: function, browser: any, userAgent: string, withoutjavascript: boolean, viewport: any, puppeteerArgs: Array<string>, cssoOptions: Object, ignoreCSSErrors?: boolean, ignoreJSErrors?: boolean, styletags?: boolean, enableServiceWorkers?: boolean, disableJavaScript?: boolean, whitelist?: Array<string> }} options
 * @return Promise<{ finalCss: string, stylesheetContents: { [key: string]: string }, doms: Array<object> }>
 */
const minimalcss = async (options) => {
  const { urls } = options;
  const debug = options.debug || false;
  const cssoOptions = options.cssoOptions || {};
  const enableServiceWorkers = options.enableServiceWorkers || false;
  const puppeteerArgs = options.puppeteerArgs || [];
  const whitelist = options.whitelist || [];
  const whitelistRules = whitelist.map((rule) => new RegExp(rule));

  if (!enableServiceWorkers) {
    puppeteerArgs.push('--enable-features=NetworkService');
  }
  const browser =
    options.browser ||
    (await puppeteer.launch({
      args: puppeteerArgs,
    }));

  // All of these get mutated by the processPage() function. Once
  // per URL.
  const stylesheetAsts = {};
  const stylesheetContents = {};
  const doms = [];
  const allHrefs = [];
  const redirectResponses = {};
  const skippedUrls = new Set();

  try {
    // Note! This opens one URL at a time synchronous
    for (let i = 0; i < urls.length; i++) {
      const pageUrl = urls[i];
      const page = await browser.newPage();
      if (!enableServiceWorkers) {
        await page._client.send('ServiceWorker.disable');
      }
      try {
        await processPage({
          page,
          options,
          pageUrl,
          stylesheetAsts,
          stylesheetContents,
          doms,
          allHrefs,
          redirectResponses,
          skippedUrls,
        });
      } catch (e) {
        throw e;
      } finally {
        await page.close();
      }
    }
  } catch (e) {
    throw e;
  } finally {
    // We can close the browser now that all URLs have been opened.
    if (!options.browser) {
      browser.close();
    }
  }

  // All URLs have been opened, and we now have multiple DOM (cheerio) objects.
  // But first check that every spotted stylesheet (by <link> tags)
  // got downloaded.
  const missingASTs = [...allHrefs].filter((url) => {
    return !(
      stylesheetAsts[url] ||
      skippedUrls.has(url) ||
      redirectResponses[url]
    );
  });
  if (missingASTs.length) {
    throw new Error(
      `Found stylesheets that failed to download (${missingASTs})`
    );
  }

  // This is the protection against ever looking up the same CSS selector
  // more than once. We can confidently pre-populate it with a couple that
  // we're confident about.
  // The `''` selector is odd looking but comes from `:before` which is a
  // valid CSS selector.
  // See https://codepen.io/peterbe/pen/YBLyOd and
  // https://github.com/Semantic-Org/Semantic-UI/blob/master/dist/components/reset.min.css
  const decisionsCache = { '*': true, body: true, html: true, '': true };

  // Now, let's loop over ALL links and process their ASTs compared to
  // the DOMs.
  const isSelectorMatchToAnyElement = (selectorString) => {
    if (whitelistRules.some((regex) => regex.test(selectorString))) {
      return true;
    }
    // Here's the crucial part. Decide whether to keep the selector
    // Find at least 1 DOM that contains an object that matches
    // this selector string.
    return doms.some((dom) => {
      try {
        return dom(selectorString).length > 0;
      } catch (ex) {
        // Be conservative. If we can't understand the selector,
        // best to leave it in.
        if (debug) {
          console.warn(selectorString, ex.toString());
        }
        return true;
      }
    });
  };
  allHrefs.forEach((href) => {
    while (redirectResponses[href]) {
      href = redirectResponses[href];
    }
    if (skippedUrls.has(href)) {
      // skippedUrls are URLs that for some reason was deliberately not
      // downloaded. You can supply a `options.skippable` function which
      // might, for some reason, skip certain URLs. But if we don't
      // remember which URLs we skipped, when we later find all the
      // <link> tags to start analyze, we'd get an error here because
      // we deliberately chose to now parse its CSS.
      return;
    }
    const ast = stylesheetAsts[href];
    csstree.walk(ast, {
      visit: 'Rule',
      enter: function (node, item, list) {
        if (
          this.atrule &&
          csstree.keyword(this.atrule.name).basename === 'keyframes'
        ) {
          // Don't bother inspecting rules that are inside a keyframe.
          return;
        }

        if (!node.prelude.children) {
          const cssErrorMessage = `Invalid CSS found while evaluating ${href}: "${node.prelude.value}"`;
          if (options.ignoreCSSErrors) {
            console.warn(cssErrorMessage);
            list.remove(item);
          } else {
            throw new Error(cssErrorMessage);
          }
        } else {
          node.prelude.children.forEach((node, item, list) => {
            // Translate selector's AST to a string and filter pseudos from it
            // This changes things like `a.button:active` to `a.button`
            const selectorString = utils.reduceCSSSelector(
              csstree.generate(node)
            );

            // Before we begin, do a little warmup of the decision cache.
            // From a given selector, e.g. `div.foo p.bar`, we can first look
            // up if there's an point by first doing a lookup for `div.foo`
            // because if that doesn't exist we *know*  we can ignore more
            // "deeper" selectors like `div.foo p.bar` and `div.foo span a`.
            const parentSelectors = utils.getParentSelectors(selectorString);

            // If "selectorString" was `.foo .bar span`, then
            // this `parentSelectors` array will be
            // `['.foo', '.foo .bar']`.
            // If `selectorString` was just `.foo`, then
            // this `parentSelectors` array will be `[]`.
            let bother = true;
            parentSelectors.forEach((selectorParentString) => {
              if (bother) {
                // Is it NOT in the decision cache?
                if (selectorParentString in decisionsCache === false) {
                  decisionsCache[
                    selectorParentString
                  ] = isSelectorMatchToAnyElement(selectorParentString);
                }
                // What was the outcome of that? And if the outcome was
                // that it was NOT there, set the 'bother' to false which
                // will popoulate the decision cache immediately.
                if (!decisionsCache[selectorParentString]) {
                  bother = false;
                  decisionsCache[selectorString] = false;
                }
              } else {
                decisionsCache[selectorParentString] = false;
              }
            });

            if (selectorString in decisionsCache === false) {
              decisionsCache[selectorString] = isSelectorMatchToAnyElement(
                selectorString
              );
            }
            if (!decisionsCache[selectorString]) {
              // delete selector from a list of selectors
              list.remove(item);
            }
          });

          if (node.prelude.children.isEmpty()) {
            // delete rule from a list
            list.remove(item);
          }
        }
      },
    });
  });
  // Every unique URL in every <link> tag has been checked.
  // We can't simply loop over allHrefs because it might contain
  // entries that *aren't* in stylesheetAsts. For example, a page
  // might have a href in there but it's been deliberately skipped.
  // That's why we need to make a ordered copy of it based on
  // each item existing in stylesheetAsts.
  const allUsedHrefs = [];
  allHrefs.forEach((href) => {
    while (redirectResponses[href]) {
      href = redirectResponses[href];
    }
    if (stylesheetAsts[href]) {
      allUsedHrefs.push(href);
    }
  });
  const allCombinedAst = {
    type: 'StyleSheet',
    loc: null,
    children: allUsedHrefs.reduce(
      (children, href) => children.appendList(stylesheetAsts[href].children),
      new csstree.List()
    ),
  };

  // Lift important comments (i.e. /*! comment */) up to the beginning
  const comments = new csstree.List();
  csstree.walk(allCombinedAst, {
    visit: 'Comment',
    enter: (_node, item, list) => {
      comments.append(list.remove(item));
    },
  });
  allCombinedAst.children.prependList(comments);

  // Why not just allow the return of the "unminified" CSS (in case
  // some odd ball wants it)?
  // 'allCombinedAst' concatenates multiple payloads of CSS.
  // It only contains the selectors that are supposedly
  // in the DOM. However it does contain *duplicate* selectors.
  // E.g. `p { color: blue; } p { font-weight: bold; }`
  // When ultimately, what was need is `p { color: blue; font-weight: bold}`.
  // The csso.minify() function will solve this, *and* whitespace minify
  // it too.
  csso.syntax.compress(allCombinedAst, cssoOptions);
  postProcessOptimize(allCombinedAst);
  const finalCss = csstree.generate(allCombinedAst);
  const returned = {
    finalCss,
    stylesheetContents,
    doms,
  };
  return Promise.resolve(returned);
};

module.exports = { run: minimalcss };
