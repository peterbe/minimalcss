/* Replace repeated important comments and leave the first behind.
This is useful when you have concatenated multiple pages' CSS and they
each have a licence comment, for example, in the beginning. In that
case we only want to keep the first of each.
*/
const cleanRepeatedComments = css => {
  const once = {}
  return css.replace(/\/\*\![\s\S]*?\*\/\n*/gm, match => {
    if (once[match]) {
      return ''
    }
    once[match] = true
    return match
  })
}

module.exports = {cleanRepeatedComments}
