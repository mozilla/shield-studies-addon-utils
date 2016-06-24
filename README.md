# Shield Studies Addon Utils [![Build Status](https://travis-ci.org/tombell/travis-ci-status.svg?branch=master)](https://travis-ci.org/tombell/travis-ci-status)

Instrumented your Firefox Addon!

Build Shield Study (Normandy) compatible addons without having to think very much.

In particular, this has 100% test coverage for lots of **startup** and **shutdown** cases, so that your addon does the Right Thing across restarts.

- maintains same variation across restarts
- testable, tested code
- doesn't care much about your variations, so long as they are 'multi-callable' safely.

## Design Case

Your experiment is:

- side-by-side variations (1 or more)
- 'one-phase'.  No warm up periods.  If you want that stuff, handle it yourself, or file bugs

## Benefits

Using this, you get this analysis FOR FREE (and it's fast!)

- Branch x channel x VARIATION x experiment-id x PHASE (install, reject, alive etc) using UNIFIED TELEMETRY

## Example usage

See `example` directory, for a simple "single-pref" app, with

- `isEligible`
- `cleanup`
- `variations`


## Gotchas, Opinions, Side Effects, and Misfeatures

1.  This assumes `jetpack` (`jpm`) style addons, with

    - `require`
    - `jpm` startup and shutdown semantics

2.  Some prefs will be set and running during an experiment in the "addon-specific" pref tree.

3.  Disable also uninstalls (and cleans up)

4.  Undoubtedly, there are others.  It scratches my itch.  I have built a lot of things in the past.
