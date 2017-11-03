#!/usr/bin/env bash
set -eo pipefail

error() {
    echo "
The above printed files weren't prettier enough.

To check a file use, for example:
    prettier src/run.js | diff src/run.js -

To fix up a file use:
    prettier --write src/run.js

The config is defined in .prettierrc
Ideally configure your editor to automatically apply.
See https://prettier.io/docs/en/editors.html#content
"
    exit 1
}

prettier --list-different "src/*.js" "bin/*.js" || error
