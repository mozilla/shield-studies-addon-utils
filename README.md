| [Add-on template](https://github.com/mozilla/shield-studies-addon-template/) | [Engineering hints](#engineering-and-process) | [More documentation](./docs/) | [Shield - Mozilla Wiki](https://wiki.mozilla.org/Firefox/Shield) |
| ---------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------- | ---------------------------------------------------------------- |


# Shield Studies Add-on Utils

[![Build Status](https://travis-ci.org/mozilla/shield-studies-addon-utils.svg?branch=master)](https://travis-ci.org/mozilla/shield-studies-addon-utils)

APIs and tooling that allows add-on developers to build [Shield/Pioneer](https://wiki.mozilla.org/Firefox/Shield/Shield_Studies) ([Normandy](https://wiki.mozilla.org/Firefox/Shield#Normandy_-_User_Profile_Matching_and_Recipe_Deployment)) study add-ons efficiently.

## Overview

* `webExtensionApis` - Firefox WebExtension Experiments APIs providing capabilities for study add-ons that are yet not available in the built-in WebExtension APIs
* `testUtils` - Test utils (helper classes to write functional/unit tests for your study add-on)
* `examples` - Tested and verified example add-ons using the WebExtension Experiments APIs and test utils

## Get started

Check out [mozilla/shield-studies-addon-template/](https://github.com/mozilla/shield-studies-addon-template/) to get started with an example study where shield-studies-addon-utils is already installed and configured.

## Installing the utils in your add-on

```
npm install --save shield-studies-addon-utils
```

## Engineering and Process

* [Shield article on Mozilla Wiki](https://wiki.mozilla.org/Firefox/Shield)
* [Shield Studies article on Mozilla Wiki](https://wiki.mozilla.org/Firefox/Shield/Shield_Studies)
* [mozilla/shield-studies-addon-template/](https://github.com/mozilla/shield-studies-addon-template/)
* [Current work-in-progress docs and launch process](https://github.com/mozilla/shield-studies-addon-utils/issues/93)
* [Long, rambling engineering docs](./docs/engineering.md)
* Come to slack: #shield

## WebExtension APIs

### `browser.study.*`

Provides these capabilities:

1.  **Suggest variation for a client** (Deterministically! i.e. based on a hash of non-PII user info, they will always get assigned to the same branch every time the study launches)
2.  **Report study lifecycle data** using Telemetry
3.  **Report feature interaction and success data** using Telemetry
4.  **Registers/unregisters the study as an active experiment** (By annotating the Telemetry Environment, marking the user as special in the `main` ping).
5.  **Validates schema for study config**
6.  **Handles study endings** (endStudy method bundles lots of tasks in one, including appending survey URLs specified in Config.jsm with query strings/sending the user to a survey and uninstalling the add-on)

To use, copy `webExtensionApis/study/api.js` and `webExtensionApis/study/schema.json` to your add-on's source directory under `privileged/study`, then add-the following to your add-on's manifest.json:

```
  "experiment_apis": {
    "study": {
      "schema": "./privileged/study/schema.json",
      "parent": {
        "scopes": ["addon_parent"],
        "script": "./privileged/study/api.js",
        "paths": [["study"]]
      }
    }
  },
```

#### Data processing pipelines

Depending on which data processing pipeline the study add-on is configured to use, the pings end up in different destinations:

* `shield-parquet` - The pings end up in the `shield-study` and `shield-study-addon` Telemetry buckets for faster analysis.
* `pioneer` - The pings are encrypted and end up in the Pioneer processing pipeline
* `custom-telemetry-events` - The pings end up in the ordinary destination for custom telemetry events

### `browser.prefs.*`

Allows your web extension add-on to set and read preferences.

To use, copy and adjust the files as per the `study` API above.

## What You are Building

* You are building . To deploy these after 57, you will need the magic special signing.
* Shield study add-ons can not be based on Web Extensions [yet](https://github.com/mozilla/shield-studies-addon-utils/issues/45).

## Gotchas, Opinions, Side Effects, and Misfeatures

1.  No handling of 'timers'. No saved state at all (including the variation name), unless you handle it yourself.
2.  No 'running' pings in v4 (yet).
3.  User disable also uninstalls (and cleans up).

## Development on the Utils

* Open an issue
* Hack and file a PR
* [Development on the Utils](./docs/development-on-the-utils.md)

## History of major versions

* v5: (In development) API exposed as a Web Extension Experiment. Minimal viable add-on example added. Test coverage improved. Test utils added.
* v4.1: Improved utils for common cases
* v4: First `.jsm` release for shipping studies as [legacy add-ons](https://developer.mozilla.org/Add-ons/Legacy_add_ons). Used packet format for PACKET version 3. (Jetpack / addon-sdk is not at all supported since v4 of this utils library)
* v3: Attempt to formalize on `shield-study` PACKET version 3. Jetpack based. Prototype used for `raymak/page-reload`. All work abandoned, and no formal npm release in this series. Work done at `v3-shield-packet-format` branch. LAST JETPACK (addon-sdk) RELEASE.
* v2: Code refactor to es6 `class` with event models. Added cli tooling. Packet format is still arbitrary and per-study. Jetpack based. Last used in studies in Q2 2017.
* v1: Initial work and thinking. Telemetry packets are rather arbitrary. Jetpack based.

### Legacy template repositories

Repositories that should not be used as templates for new studies:

* <https://github.com/gregglind/template-shield-study> - The incubation repo for the updated structure and contents of the template repo, ported to the official template in late 2017.
* <https://github.com/benmiroglio/shield-study-embedded-webextension-hello-world-example> - A repository that was created in 2017 to help new Shield/Pioneer engineers to quickly get up and running with a Shield add-on, built upon an older and much more verbose add-on template. It's documentation has been ported to the official template repo.
* <https://github.com/johngruen/shield-template> - Despite its name, this repo is for static amo consent pages and does not contain any template for Shield studies
