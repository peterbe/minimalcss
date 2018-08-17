const fastify = require('fastify')();
const path = require('path');
const puppeteer = require('puppeteer');
const minimalcss = require('../index');

fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'examples')
});

// Important that the URL doesn't end with .css
fastify.get('/307-css', (req, reply) => {
  reply.redirect(307, '/redirected.css');
});

fastify.get('/307.html', (req, reply) => {
  reply.redirect(307, '/redirected.html');
});

fastify.get('/timeout.html', (req, reply) => {
  setTimeout(() => reply.send('timeout'), 300);
});

fastify.get('/timeout.css', (req, reply) => {
  setTimeout(() => reply.send('timeout'), 300);
});

let browser;

const runMinimalcss = (path, options = {}) => {
  options.browser = browser;
  options.urls = [`http://localhost:3000/${path}.html`];
  return minimalcss.minimize(options);
};

beforeAll(async () => {
  await fastify.listen(3000);
  browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
});

afterAll(async () => {
  await fastify.close();
  await browser.close();
});

test('handles relative paths', async () => {
  const { finalCss } = await runMinimalcss('css-relative-path');
  expect(finalCss).toMatch('background:url(/images/small.jpg)');
  expect(finalCss).toMatch('background-image:url(/images/small.jpg)');
  expect(finalCss).toMatch(
    'background:url(http://127.0.0.1:3000/images/small.jpg)'
  );
  expect(finalCss).toMatch(
    'background-image:url(http://127.0.0.1:3000/images/small.jpg)'
  );
  expect(finalCss).toMatch(
    'background-image:url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7)'
  );
});

test('handles JS errors', async () => {
  expect.assertions(1);
  try {
    await runMinimalcss('jserror');
  } catch (e) {
    expect(e.message).toMatch('Error: unhandled');
  }
});

test('cares only about external CSS files', async () => {
  const { finalCss } = await runMinimalcss('css-in-js');
  expect(finalCss).toEqual('.external{color:red}');
});

test('handles 404 CSS file', async () => {
  expect.assertions(1);
  try {
    await runMinimalcss('404css');
  } catch (e) {
    expect(e.message).toMatch('404 on');
  }
});

test('media queries print removed', async () => {
  const { finalCss } = await runMinimalcss('media-queries-print');
  expect(finalCss).toEqual('');
});

test('removes unused @keyframes', async () => {
  const { finalCss } = await runMinimalcss('keyframe-removes');
  expect(finalCss).toEqual('');
});

test('leaves used @keyframes', async () => {
  const { finalCss } = await runMinimalcss('keyframe-leaves');
  expect(finalCss).toMatch('@keyframes RotateSlot');
});

test.skip('leaves used inline @keyframes', async () => {
  const { finalCss } = await runMinimalcss('keyframe-removes-inline');
  expect(finalCss).toMatch('@keyframes RotateSlot');
});

test('removes unused @fontface', async () => {
  const { finalCss } = await runMinimalcss('fontface-removes');
  expect(finalCss).toEqual('');
});

test('leaves used @fontface', async () => {
  const { finalCss } = await runMinimalcss('fontface-leaves');
  expect(finalCss).toMatch("@font-face{font-family:'Lato';");
});

test.skip('leaves used inline @fontface', async () => {
  const { finalCss } = await runMinimalcss('fontface-removes-inline');
  expect(finalCss).toMatch("@font-face{font-family:'Lato';");
});

test('leaves used pseudo classes', async () => {
  const { finalCss } = await runMinimalcss('pseudo-classes');
  expect(finalCss).toMatch('a:active');
  expect(finalCss).toMatch('a:focus');
  expect(finalCss).toMatch('a:hover');
  expect(finalCss).toMatch('a:visited');
  expect(finalCss).toMatch('input:disabled');
});

test('media queries', async () => {
  const { finalCss } = await runMinimalcss('media-queries');
  expect(finalCss).toMatch('@media only screen and (min-device-width:414px)');
  expect(finalCss).toMatch('@media only screen and (min-device-width:375px)');
});

test('evaluate DOM multiple times', async () => {
  const { finalCss } = await runMinimalcss('evaluate-dom-multiple-times');
  expect(finalCss).toMatch('.SomeSelector');
  expect(finalCss).toMatch('.OtherSelector');
});

test('form elements', async () => {
  const { finalCss } = await runMinimalcss('form-elements');
  expect(finalCss).toMatch('input[type=radio]:checked');
  expect(finalCss).toMatch('input[type=checkbox]:checked');
  expect(finalCss).toMatch('option:selected');
});

test('invalid css', async () => {
  expect.assertions(1);

  try {
    await runMinimalcss('invalid-css');
  } catch (error) {
    const expectedUrl = 'http://localhost:3000/invalid-css.css';
    const expectedInvalidCSS = '$body';
    expect(error.toString()).toMatch(
      `Invalid CSS found while evaluating ${expectedUrl}: "${expectedInvalidCSS}"`
    );
  }
});

test('ignoreCSSErrors', async () => {
  const { finalCss } = await runMinimalcss('invalid-css', {
    ignoreCSSErrors: true
  });
  expect(finalCss).toEqual('');
});

test('ignoreJSErrors', async () => {
  const { finalCss } = await runMinimalcss('jserror', {
    ignoreJSErrors: true
  });
  expect(finalCss).toEqual('');
});

test('handles 307 CSS file', async () => {
  const { finalCss } = await runMinimalcss('307css');
  expect(finalCss).toEqual('p{color:violet}');
});

test('handles 307 HTML file', async () => {
  const { finalCss } = await runMinimalcss('307');
  expect(finalCss).toEqual('p{color:violet}');
});

test("deliberately skipped .css shouldn't error", async () => {
  const { finalCss } = await runMinimalcss('skippable-stylesheets', {
    skippable: request => {
      return request.url().search(/must-skip.css/) > -1;
    }
  });
  expect(finalCss).toEqual('p{color:brown}');
});

test('order matters in multiple style sheets', async () => {
  // In inheritance.html it references two .css files. The
  // second one overrides the first one. But it's not a 100% overlap,
  // as the first one has some rules of its own.
  const { finalCss } = await runMinimalcss('inheritance');
  expect(finalCss).toEqual('p{color:violet;font-size:16px;font-style:italic}');
});

test('order matters in badly repeated style sheets', async () => {
  // In repeated-badly.html it references two .css files. One
  // of them repeated!
  // It looks like this:
  //  <head>
  //    <link rel=stylesheet href=second.css>
  //    <link rel=stylesheet href=first.css>
  //    <link rel=stylesheet href=second.css>
  //  </head>
  // This is clearly bad. The 'first.css' overrides 'second.css' but then
  // 'second.css' overrides again.
  // You should not do your HTML like this but it can happen and minimalcss
  // should cope and not choke.
  // If you open repeated.html in a browser, the rules
  // from repeated-second.css should decide lastly.
  const { finalCss } = await runMinimalcss('repeated');
  expect(finalCss).toEqual('p{color:violet;font-size:16px;font-style:italic}');
});

test.skip('handles css variables', async () => {
  const { finalCss } = await runMinimalcss('css-variables');
  expect(finalCss).toMatch('--main-bg-color:');
  expect(finalCss).not.toMatch('--unused-color:');
});

test('handles vendor prefixed properties', async () => {
  const { finalCss } = await runMinimalcss('vendor-prefixes');
  expect(finalCss).toMatch('-webkit-transition');
  expect(finalCss).toMatch('abracadabra');
});

test('leaves GET params in urls', async () => {
  const { finalCss } = await runMinimalcss('get-params-in-url');
  expect(finalCss).toMatch('/images/small.jpg?a=b');
});

test('avoids link tags that is css data', async () => {
  const { finalCss } = await runMinimalcss('css-in-link-tag');
  // Most important is that it doesn't crash.
  // See https://github.com/peterbe/minimalcss/issues/158
  expect(finalCss).toMatch('');
});

test('accept CSSO options', async () => {
  const cssoOptions = {};
  let { finalCss } = await runMinimalcss('comments', { cssoOptions });
  expect(finalCss).toMatch('test css comment');

  cssoOptions.comments = false;
  ({ finalCss } = await runMinimalcss('comments', { cssoOptions }));
  expect(finalCss).not.toMatch('test css comment');
});

test('handles extra semicolons', async () => {
  // Extra semicolons can cause csso.minify() to throw:
  // [TypeError: Cannot read property '0' of undefined]
  // https://github.com/peterbe/minimalcss/issues/243
  // https://github.com/css/csso/issues/378
  const { finalCss } = await runMinimalcss('extra-semicolons');
  expect(finalCss).toMatch('a{color:red}');
});

test('timeout error for page', async () => {
  expect.assertions(2);
  try {
    await runMinimalcss('timeout', { timeout: 200 });
  } catch (e) {
    expect(e.message).toMatch('Navigation Timeout Exceeded: 200ms exceeded');
    expect(e.message).toMatch('For http://localhost:3000/timeout.html');
  }
});

test('timeout error for resources', async () => {
  expect.assertions(2);
  try {
    await runMinimalcss('with-timeout', { timeout: 200 });
  } catch (e) {
    expect(e.message).toMatch('Navigation Timeout Exceeded: 200ms exceeded');
    expect(e.message).toMatch(
      'Tracked URLs that have not finished: http://localhost:3000/timeout.css?1, http://localhost:3000/timeout.css?2'
    );
  }
});

test('handles #fragments in stylesheet hrefs', async () => {
  const { finalCss } = await runMinimalcss('url-fragment');
  expect(finalCss).toMatch('p{color:red}');
});
