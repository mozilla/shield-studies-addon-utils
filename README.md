|[README.md](#)| [Add-on template](https://github.com/mozilla/shield-studies-addon-template/)|[Engineering hints](./docs/engineering.md)|[More documentation](./docs/)|[Shield - Mozilla Wiki](https://wiki.mozilla.org/Firefox/Shield)
|-------|---------------|----|---|---|


# Shield Studies Add-on Utils
[![Build Status](https://travis-ci.org/mozilla/shield-studies-addon-utils.svg?branch=master)](https://travis-ci.org/mozilla/shield-studies-addon-utils)

A Firefox javascript module to be bundled with shield study add-ons (as `StudyUtils.jsm`). Provides these capabilities:

1. **Suggest variation for a client**
2. **Report study lifecycle data** using Telemetry
3. **Report feature interaction and success data** using Telemetry
4. **Annotate Telemetry Environment** to mark the user as special in the `main` ping.

The pings end up in the `shield-study-addon` Telemetry bucket for faster analysis.

Allows add-on developers to build [Shield Study][shield-wiki] (Normandy) compatible add-ons without having to think very much.

## What You are Building

- You are building a [LEGACY ADD-ON](https://developer.mozilla.org/en-US/Add-ons/Legacy_add_ons). To deploy these after 57, you will need the magic special signing.
- Web Extensions are not strong enough [yet](https://github.com/mozilla/shield-studies-addon-utils/issues/45).
- Jetpack / addon-sdk is NOT AT ALL SUPPORTED since v4.

## Get started

Check out [mozilla/shield-studies-addon-template/](https://github.com/mozilla/shield-studies-addon-template/) to get started with an example study where shield-studies-addon-utils is already installed and configured.

## Installing the `studyUtils.jsm` in your add-on

```
npm install --save-dev shield-studies-addon-utils
```

Copy `dist/studyUtils.jsm` to your `addon` source directory, where it will be zipped up.

## Summary

### Design Case

Your Study is:

- side-by-side variations (1 or more)

### Benefits

Using this, you get this analysis FOR FREE (and it's fast!)

- Branch x channel x VARIATION x experiment-id x PHASE (install, reject, alive etc) using UNIFIED TELEMETRY

## <span id="engineering-hints">Engineering and Process</span>

THIS IS TEMPORARY LIST, as of 2017-11-16.

- [Shield article on Mozilla Wiki](https://wiki.mozilla.org/Firefox/Shield)
- [Shield Studies article on Mozilla Wiki](https://wiki.mozilla.org/Firefox/Shield/Shield_Studies)
- [mozilla/shield-studies-addon-template/](https://github.com/mozilla/shield-studies-addon-template/)
- [Current work-in-progress docs and launch process](https://github.com/mozilla/shield-studies-addon-utils/issues/93)
- [Long, rambling engineering docs](./docs/engineering.md)
- Come to slack:  #shield

## Gotchas, Opinions, Side Effects, and Misfeatures

1.  No handling of 'timers'.  No saved state at all (including the variation name), unless you handle it yourself.

2.  No 'running' pings in v4 (yet).

3.  User disable also uninstalls (and cleans up).

## Development on the Utils

- open an issue
- hack and file a PR


## history of major versions

- v4.x: (proposed)  additional functions for common cases
- v4: First `.jsm` release.  Uses packet format for PACKET version 3.
- v3: Attempt to formalize on `shield-study` PACKET version 3.  Jetpack based.  Prototype used for `raymak/page-reload`.  All work abandoned, and no formal npm release in this series.  Work done at `v3-shield-packet-format` branch.  LAST JETPACK (addon-sdk) RELEASE.
s v2: Code refactor to es6 `class` with event models.  Added cli tooling.  Packet format is still arbitrary and per-study.  Jetpack based.  Last used in studies in Q2 2017.
- v1: Initial work and thinking.  Telemetry packets are rather arbitrary.  Jetpack based.
