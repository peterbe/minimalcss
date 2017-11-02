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

module.exports = { collectImportantComments }
