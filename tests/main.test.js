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
  const { finalCss } = await runMinimalcss('css-in-js')
  expect(finalCss).toEqual('.external{color:red}')
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
  const { finalCss } = await runMinimalcss('media-queries-print')
  expect(finalCss).toEqual('')
})

test('removes unused @keyframes', async () => {
  const { finalCss } = await runMinimalcss('keyframe-removes')
  expect(finalCss).toEqual('')
})

test('leaves used @keyframes', async () => {
  const { finalCss } = await runMinimalcss('keyframe-leaves')
  expect(finalCss).toMatch('@keyframes RotateSlot')
})

test.skip('leaves used inline @keyframes', async () => {
  const { finalCss } = await runMinimalcss('keyframe-removes-inline')
  expect(finalCss).toMatch('@keyframes RotateSlot')
})

test('removes unused @fontface', async () => {
  const { finalCss } = await runMinimalcss('fontface-removes')
  expect(finalCss).toEqual('')
})

test('leaves used @fontface', async () => {
  const { finalCss } = await runMinimalcss('fontface-leaves')
  expect(finalCss).toMatch("@font-face{font-family:'Lato';")
})

test.skip('leaves used inline @fontface', async () => {
  const { finalCss } = await runMinimalcss('fontface-removes-inline')
  expect(finalCss).toMatch("@font-face{font-family:'Lato';")
})

test('leaves used pseudo classes', async () => {
  const { finalCss } = await runMinimalcss('pseudo-classes')
  expect(finalCss).toMatch('a:active')
  expect(finalCss).toMatch('a:focus')
  expect(finalCss).toMatch('a:hover')
  expect(finalCss).toMatch('a:visited')
  expect(finalCss).toMatch('input:disabled')
})

test('media queries', async () => {
  const { finalCss } = await runMinimalcss('media-queries')
  expect(finalCss).toMatch('@media only screen and (min-device-width:414px)')
  expect(finalCss).toMatch('@media only screen and (min-device-width:375px)')
})

test('evaluate DOM multiple times', async () => {
  const { finalCss } = await runMinimalcss('evaluate-dom-multiple-times')
  expect(finalCss).toMatch('.SomeSelector')
  expect(finalCss).toMatch('.OtherSelector')
})

test('form elements', async () => {
  const { finalCss } = await runMinimalcss('form-elements')
  expect(finalCss).toMatch('input[type=radio]:checked')
  expect(finalCss).toMatch('input[type=checkbox]:checked')
  expect(finalCss).toMatch('option:selected')
})
