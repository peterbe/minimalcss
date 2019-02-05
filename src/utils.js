const csstree = require('css-tree');

/**
 * Simple single argument memoize function. Only works if the first and
 * only argument is a hashable. E.g. a string.
 */
function memoize(fn) {
  const cache = {};
  return argument => {
    if (argument in cache === false) {
      cache[argument] = fn(argument);
    }
    return cache[argument];
  };
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
const reduceCSSSelector = memoize(selector => {
  return selector.split(
    /:(?=([^"'\\]*(\\.|["']([^"'\\]*\\.)*[^"'\\]*['"]))*[^"']*$)/g
  )[0];
});

/**
 * Remove the ' and/or " at the beginning and end of a string if it has it.
 * @param {string} string
 * @return {string}
 */
const unquoteString = memoize(string => {
  const first = string.charAt(0);
  const last = string.charAt(string.length - 1);
  if (first === last && (first === '"' || first === "'")) {
    return string.substring(1, string.length - 1);
  }
  return string;
});

/**
 * Removes all sequences of two-or-more semicolons separated by zero-or-more
 * whitespace, replacing each sequence with a single semicolon.
 * @param {string} css
 * @return {string}
 */
const removeSequentialSemis = css => {
  while (/;\s*;/.test(css)) {
    css = css.replace(/;\s*;/g, ';');
  }
  return css;
};

/**
 * Given a string CSS selector (e.g. '.foo .bar .baz') return it with the
 * last piece (split by whitespace) omitted (e.g. '.foo .bar').
 * If there is no parent, return an empty string.
 *
 * @param {string} selector
 * @return {string[]}
 */
function getParentSelectors(selector) {
  if (!selector) return [];
  const parentSelectors = [];
  const selectorAst = csstree.parse(selector, { context: 'selector' });

  let generatedCSS;
  while (selectorAst.children.tail) {
    selectorAst.children.prevUntil(
      selectorAst.children.tail,
      (node, item, list) => {
        list.remove(item);
        return node.type === 'Combinator' || node.type === 'WhiteSpace';
      }
    );
    generatedCSS = csstree.generate(selectorAst);
    if (generatedCSS) {
      parentSelectors.push(generatedCSS);
    }
  }
  return parentSelectors.reverse();
}

module.exports = {
  reduceCSSSelector,
  removeSequentialSemis,
  unquoteString,
  getParentSelectors
};
