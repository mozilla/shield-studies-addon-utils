| index | [example]     |
|-------|---------------|


# Shield Studies Addon Utils [![Build Status](https://travis-ci.org/tombell/travis-ci-status.svg?branch=master)](https://travis-ci.org/tombell/travis-ci-status)

- Instrument your Firefox Addon!
- Build Shield Study (Normandy) compatible addons without having to think very much.

## Assumptions




## history of major versions

- v4: First `.jsm` release.  Uses packet format for PACKET version 3.
- v3: Attempt to formalize on `shield-study` PACKET version 3.  Jetpack based.  Prototype used for `raymak/page-reload`.  All work abandoned, and no formal npm release in this series.  Work done at `v3-shield-packet-format` branch.  LAST JETPACK (addon-sdk) RELEASE.
s v2: Code refactor to es6 `class` with event models.  Added cli tooling.  Packet format is still arbitrary and per-study.  Jetpack based.  Last used in studies in Q2 2017.
- v1: Initial work and thinking.  Telemetry packets are rather arbitrary.  Jetpack based.



## install

```
npm install --save-dev shield-studies-addon-utils
```

Copy the file to somewhere useful in your addon.


## Tutorial and Full Usage

[fully worked tutorial - How To Shield Study](./howToShieldStudy.md)

## Examples

See `examples` directory.

## Summary

### Design Case

Your Study is:

- side-by-side variations (1 or more)
- 'one-phase'.  No warm up periods.  If you want that stuff, handle it yourself, or file bugs

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

4.  Undoubtedly, there are others.  It scratches my itch.  I have built a lot of things in the past.


[example]: examples/README.md


