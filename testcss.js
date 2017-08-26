const css = require('css')
const fs = require('fs')

// const cssPayload = `
// body,p { font-size: 12px; } #foo { color: blue}
// @media (min-width:768px) and (max-width:991px){
//   .keep { color: pink }
//   .poop { color: brown}
// }
// @media (min-width:1000px){
//   .keepnothing { color: pink }
// }
// tag#id > .classthing { color:yellow }
//
// @-webkit-keyframes progress-bar-stripes{
//     0%{background-position:40px 0}to{background-position:0 0}
// }
//
// /* next is a comment */
// a{b:c}
//
// @font-face{font-family:Glyphicons Halflings;src:url(https://songsearch-2916.kxcdn.com/static/media/glyphicons-halflings-regular.f4769f9b.eot);src:url(https://songsearch-2916.kxcdn.com/static/media/glyphicons-halflings-regular.f4769f9b.eot?#iefix) format('embedded-opentype'),url(https://songsearch-2916.kxcdn.com/static/media/glyphicons-halflings-regular.448c34a5.woff2) format('woff2'),url(https://songsearch-2916.kxcdn.com/static/media/glyphicons-halflings-regular.fa277232.woff) format('woff'),url(https://songsearch-2916.kxcdn.com/static/media/glyphicons-halflings-regular.e18bbf61.ttf) format('truetype'),url(https://songsearch-2916.kxcdn.com/static/media/glyphicons-halflings-regular.89889688.svg#glyphicons_halflingsregular) format('svg')}
//
// `

const cssPayload = fs.readFileSync('bootstrap.css', 'UTF-8');
const obj = css.parse(cssPayload)

// const copy = Object.assign({}, obj)




// obj.stylesheet.rules = obj.stylesheet.rules.map(rule => {
//   console.log('RULE', rule);
//   if (rule.type === 'rule') {
//     // decide which selectors to keep
//     rule.selectors = rule.selectors.filter(selector => {
//       if (selector === 'p' || '#foo') {
//         return true
//       } else {
//         return false
//       }
//     })
//   }
//   return rule
// })

let selectorsCount = 0

const clean = (rules, dom) => {
  return rules.filter(rule => {
    // console.log('RULE', rule);
    if (rule.type === 'rule') {
      // console.dir(rule.selectors[0]);
      // decide which selectors to keep
      rule.selectors = rule.selectors.filter(selector => {
        selectorsCount++
        if (selector === 'p' || selector === '.keep' || selector==='.jumbotron') {
          return true
        } else {
          if (selector.indexOf('jumbotron')>-1) {
            console.log(selector);
          }

          return false
        }
      })
      if (!rule.selectors.length) {
        // Do not keep this rule!
        return false
      }
    } else if (rule.type === 'media') {
      // maybe keep
      rule.rules = clean(rule.rules, dom)
      return rule.rules.length > 0
    } else if (['keyframes', 'comment', 'font-face', 'supports'].includes(rule.type)) {
      // keep
      return true
    } else {
      console.warn("TYPE", rule.type);
      console.dir(rule)
    }
    return true
  })
}

obj.stylesheet.rules = clean(obj.stylesheet.rules, {})

console.log('selectorsCount', selectorsCount);

console.log('---------------------------------------------------------------');
// console.log(obj.stylesheet.rules);
// console.log(copy.stylesheet.rules);
const result = css.stringify(obj)
console.log(result);
