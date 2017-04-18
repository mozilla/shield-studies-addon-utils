# Shield Studies Addon Utils [![Build Status](https://travis-ci.org/tombell/travis-ci-status.svg?branch=master)](https://travis-ci.org/tombell/travis-ci-status)

- Instrument your Firefox (jetpack/addon-sdk) Addon!
- Build Shield Study (Normandy) compatible addons without having to think very much.

**Turn Back Now If** your Addon is web-extension only.

## Install `addon-utils` into an addon source directory

```
cd "$your-addon-source-dir"
npm install --save-dev shield-studies-addon-utils
```

## Tutorial and Full Usage

[fully worked tutorial - How To Shield Study](./howToShieldStudy.md)

## Examples

See `examples` directory for these examples:

- [SIMPLE possible pref-flip study, with random assignment][simple-example]
- [COMPLEX study subclassing Study to add more probes, determistic assigment, and a bunch of other things][complex-example]

## Summary

### Design Case

Your Study is:

- side-by-side variations (1 or more)
- 'one-phase'.  No warm up periods.  If you want that stuff, handle it yourself, or file bugs, or look at the

### Benefits

Using this, you get this analysis FOR FREE (and it's fast!)

- Branch x channel x VARIATION x experiment-id x PHASE (install, reject, alive etc) using UNIFIED TELEMETRY

- In particular, this library has 100% test coverage for lots of **startup** and **shutdown** cases, so that your addon does the Right Thing across restarts.

  - maintains same variation across restarts
  - testable, tested code
  - doesn't care much about your variations, so long as they are 'multi-callable' safely.


## Development

- open an issue
- hack and file a PR


## Gotchas, Opinions, Side Effects, and Misfeatures

1.  This assumes `jetpack` (`jpm`) style addons, with

    - `require`
    - `jpm` startup and shutdown semantics

2.  Some prefs will be set and running during an experiment in the "addon-specific" pref tree.

3.  Disable also uninstalls (and cleans up)

4.  Undoubtedly, there are others.  It scratches my itch.  I have built a lot of things in the past, and this seems to be a superset of most of them.


[simple-example]: ./examples/simple
[complex-example]: ./examples/complex




