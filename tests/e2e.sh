#!/usr/bin/env bash
set -eo pipefail

# Basics
./bin/minimalcss.js --help

# Version
./bin/minimalcss.js -v

# Some output
./bin/minimalcss.js --verbose -o output.css https://news.ycombinator.com/
cat output.css
rm output.css
