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

test('removes unused @keyframes', async () => {
  const result = ''
  const { finalCss } = await runMinimalcss('keyframe-removes')
  expect(finalCss).toEqual(result)
})

test('leaves used @keyframes', async () => {
  const result =
    '@keyframes RotateSlot{3%{margin-top:-2em}0%{transform:rotate(0deg)}}.SomeSelector{animation:RotateSlot infinite 5s linear}'
  const { finalCss } = await runMinimalcss('keyframe-leaves')
  expect(finalCss).toEqual(result)
})

test('removes used inline @keyframes', async () => {
  const result = ''
  const { finalCss } = await runMinimalcss('keyframe-removes-inline')
  expect(finalCss).toEqual(result)
})

test('removes unused @fontface', async () => {
  const result = ''
  const { finalCss } = await runMinimalcss('fontface-removes')
  expect(finalCss).toEqual(result)
})

test('leaves used @fontface', async () => {
  const result =
    "@font-face{font-family:'Lato';font-style:normal;font-weight:400;src:local('Lato Regular'),local('Lato-Regular'),url(https://fonts.gstatic.com/s/lato/v14/MDadn8DQ_3oT6kvnUq_2r_esZW2xOQ-xsNqO47m55DA.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2212,U+2215}.SomeSelector{font-family:'Lato'}"
  const { finalCss } = await runMinimalcss('fontface-leaves')
  expect(finalCss).toEqual(result)
})

test('removes used inline @fontface', async () => {
  const result = ''
  const { finalCss } = await runMinimalcss('fontface-removes-inline')
  expect(finalCss).toEqual(result)
})

test('leaves used pseudo classes', async () => {
  const result =
    'a{color:red}a:active{color:olive}input:disabled{color:red}a:focus{color:green}a:hover{color:#00f}a:visited{color:orange}'
  const { finalCss } = await runMinimalcss('pseudo-classes')
  expect(finalCss).toEqual(result)
})

test('media queries', async () => {
  const result =
    '@media only screen and (min-device-width:414px) and (max-device-width:736px) and (-webkit-min-device-pixel-ratio:3){a{color:red}}@media only screen and (min-device-width:375px) and (max-device-width:812px) and (-webkit-min-device-pixel-ratio:3){a{color:green}}'
  const { finalCss } = await runMinimalcss('media-queries')
  expect(finalCss).toEqual(result)
})

test('evaluate DOM multiple times', async () => {
  const result = '.SomeSelector{color:red}.OtherSelector{background:#000}'
  const { finalCss } = await runMinimalcss('evaluate-dom-multiple-times')
  expect(finalCss).toEqual(result)
})
