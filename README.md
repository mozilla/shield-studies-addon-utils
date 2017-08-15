| index | [example]     |
|-------|---------------|


# Shield Studies Addon Utils [![Build Status](https://travis-ci.org/tombell/travis-ci-status.svg?branch=master)](https://travis-ci.org/tombell/travis-ci-status)

- Instrument your Firefox Addon!
- Build Shield Study (Normandy) compatible addons without having to think very much.

## Assumptions

- You are building a [LEGACY ADDONS](https://developer.mozilla.org/en-US/Add-ons/Legacy_add_ons).  To deploy these after 57, you will need the magic special signing.
-  Jetpack / addon-sdk is NOT SUPPORTED.
- WebExtensions are not strong enough

## history of major versions

- v4.x: (proposed)  additional functions for common cases
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

## Example embedded web extension study

See [examples](`example`) directory.

## Summary

### Design Case

Your Study is:

- side-by-side variations (1 or more)

### Benefits

Using this, you get this analysis FOR FREE (and it's fast!)

- Branch x channel x VARIATION x experiment-id x PHASE (install, reject, alive etc) using UNIFIED TELEMETRY


## Development

- open an issue
- hack and file a PR


## Gotchas, Opinions, Side Effects, and Misfeatures

1.  No handling of 'timers'.  No saved state at all (including the variation name), unless you handle it yourself.

2.  No 'running' pings in v4 (yet).

3.  User disable also uninstalls (and cleans up)


[example]: examples/README.md


