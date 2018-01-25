const fastify = require('fastify')()
const path = require('path')
const puppeteer = require('puppeteer')
const minimalcss = require('../index')

fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'examples')
})

fastify.get('/307.css', (req, reply) => {
  reply.redirect(307, '/redirect.css')
})

fastify.get('/307.html', (req, reply) => {
  reply.redirect(307, '/redirect.html')
})

let browser

const runMinimalcss = path => {
  return minimalcss.minimize({
    browser,
    urls: [`http://localhost:3000/${path}.html`]
  })
}

beforeAll(async () => {
  await fastify.listen(3000)
  browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
})

afterAll(async () => {
  await fastify.close()
  await browser.close()
})

test('handles relative paths', async () => {
  const { finalCss } = await runMinimalcss('css-relative-path')
  expect(finalCss).toMatch('background:url(/images/small.jpg)')
  expect(finalCss).toMatch('background-image:url(/images/small.jpg)')
  expect(finalCss).toMatch(
    'background:url(http://127.0.0.1:3000/images/small.jpg)'
  )
  expect(finalCss).toMatch(
    'background-image:url(http://127.0.0.1:3000/images/small.jpg)'
  )
})

test('handles JS errors', async () => {
  expect.assertions(1)
  try {
    await runMinimalcss('jserror')
  } catch (e) {
    expect(e.message).toMatch('Error: unhandled')
  }
})

test('cares only about external CSS files', async () => {
  const result = '.external{color:red}'
  const { finalCss } = await runMinimalcss('css-in-js')
  expect(finalCss).toEqual(result)
})

test('handles 404 CSS file', async () => {
  expect.assertions(1)
  try {
    await runMinimalcss('404css')
  } catch (e) {
    expect(e.message).toMatch('404 on')
  }
})

test('media queries print removed', async () => {
  const result = ''
  const { finalCss } = await runMinimalcss('media-queries-print')
  expect(finalCss).toEqual(result)
})

test('handles 307 CSS file', async () => {
  const result = 'p{color:violet}'
  const { finalCss } = await runMinimalcss('307css')
  expect(finalCss).toEqual(result)
})

test('handles 307 HTML file', async () => {
  const result = 'p{color:violet}'
  const { finalCss } = await runMinimalcss('307')
  expect(finalCss).toEqual(result)
})
