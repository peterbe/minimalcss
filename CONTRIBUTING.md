# Contributing

The README has instructions about how to do testing and lint checking.

Generally you do:

```sh
$ git clone https://github.com/peterbe/minimalcss.git
$ cd minimalcss
$ ./bin/minimalcss.js https://news.ycombinator.com
```

If you make a PR, Travis will run unit tests, lint checks and end-to-end
testing. Hopefully it's clear from any errors there what needs to be done.

## Style guide

All patches are expected to run [Prettier](https://github.com/prettier/prettier)
as described and configured in the `.prettierrc`. You can run this with
`yarn lintcheck`. There are no lint checking pre-commit git hooks.

Variables names should be camelCase and it's `someUrl` or `someCss` not
`someURL` or `someCSS`.
