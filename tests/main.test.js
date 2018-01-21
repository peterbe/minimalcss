const fastify = require('fastify')()
const path = require('path')
const puppeteer = require('puppeteer')
const minimalcss = require('../index')

fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'examples')
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
  browser = await puppeteer.launch({})
})

afterAll(async () => {
  await fastify.close()
  await browser.close()
})

test('handles relative paths', async () => {
  const result =
    'body{background:url(/images/small.jpg)}p{background-image:url(images/small.jp)}'
  const { finalCss } = await runMinimalcss('css-relative-path')
  expect(finalCss).toEqual(result)
})

test('handles JS errors', async () => {
  expect.assertions(1)
  try {
    await runMinimalcss('jserror')
  } catch (e) {
    expect(e.message).toMatch('Error: unhandled')
  }
})

// test('handles 404 CSS file', async () => {
//   expect.assertions(1)
//   try {
//     await runMinimalcss('404css')
//   } catch (e) {
//     expect(e.message).toMatch('404 on')
//   }
// })
