/**
 * Take call "important comments" and extract them all to the
 * beginning of the CSS string.
 * This makes it possible to merge when minifying across blocks of CSS.
 * For example, if you have (ignore the escaping for the sake of demonstration):
 *
 *   /*! important 1 *\/
 *   p { color: red; }
 *   /*! important 2 *\/
 *   p { background-color: red; }
 *
 * You can then instead get:
 *
 *   /*! important 1 *\/
 *   /*! important 2 *\/
 *   p { color: red; background-color: red; }
 *
 * @param {string} css
 * @return {string}
 */
const collectImportantComments = css => {
  const once = new Set()
  let cleaned = css.replace(/\/\*\![\s\S]*?\*\/\n*/gm, match => {
    once.add(match)
    return ''
  })
  let combined = Array.from(once)
  combined.push(cleaned)
  return combined.join('\n')
}

/**
 * Reduce a CSS selector to be without any pseudo class parts.
 * For example, from `a:hover` return `a`. And from `input::-moz-focus-inner`
 * to `input`.
 * Also, more advanced ones like `a[href^="javascript:"]:after` to
 * `a[href^="javascript:"]`.
 * The last example works too if the input was `a[href^='javascript:']:after`
 * instead (using ' instead of ").
 *
 * @param {string} selector
 * @return {string}
 */
const reduceCSSSelector = selector => {
  return selector.split(
    /:(?=([^"'\\]*(\\.|["']([^"'\\]*\\.)*[^"'\\]*['"]))*[^"']*$)/g
  )[0]
}

/**
 * Remove the ' and/or " at the beginning and end of a string if it has it.
 * @param {string} string
 * @return {string}
 */
const unquoteString = string => {
  const first = string.charAt(0)
  const last = string.charAt(string.length - 1)
  if (first === last && (first === '"' || first === "'")) {
    return string.substring(1, string.length - 1)
  }
  return string
}

module.exports = { collectImportantComments, reduceCSSSelector, unquoteString }
