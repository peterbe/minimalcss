/**
 * @param {{urls:Array<string>, debug: boolean, loadimages: boolean}} options
 * @return {Promise<{ finalCss: string, stylesheetAstObjects:any, stylesheetContents: string }>}
 */
declare function minimalcss(options: any): any;

/**
 * Take call "important comments" and extract them all to the
 * beginning of the CSS string.
 * This makes it possible to merge when minifying across blocks of CSS.
 * For example, if you have (ignore the escaping for the sake of demonstration):
 *   /*! important 1 *\/
 *   p { color: red; }
 *   /*! important 2 *\/
 *   p { background-color: red; }
 * You can then instead get:
 *   /*! important 1 *\/
 *   /*! important 2 *\/
 *   p { color: red; background-color: red; }
 * @param {string} css
 * @return {string}
 */
declare function collectImportantComments(css: string): string;

