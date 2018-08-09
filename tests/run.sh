#!/usr/bin/env bash
set -eo pipefail

case $1 in
  # e2e)
  #   ./tests/e2e.js
  #   ;;
  #test)
  #  yarn test $@
  #  ;;
  *)
    exec "$@"
    ;;
esac
