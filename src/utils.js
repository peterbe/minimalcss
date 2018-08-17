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
  )[0];
};

/**
 * Remove the ' and/or " at the beginning and end of a string if it has it.
 * @param {string} string
 * @return {string}
 */
const unquoteString = string => {
  const first = string.charAt(0);
  const last = string.charAt(string.length - 1);
  if (first === last && (first === '"' || first === "'")) {
    return string.substring(1, string.length - 1);
  }
  return string;
};

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

module.exports = { reduceCSSSelector, removeSequentialSemis, unquoteString };
