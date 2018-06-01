| [Add-on template](https://github.com/mozilla/shield-studies-addon-template/) | [Engineering hints](#engineering-and-process) | [More documentation](./docs/) | [Shield - Mozilla Wiki](https://wiki.mozilla.org/Firefox/Shield) |
| ---------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------- | ---------------------------------------------------------------- |


# Shield Studies Add-on Utils

[![Build Status](https://travis-ci.org/mozilla/shield-studies-addon-utils.svg?branch=master)](https://travis-ci.org/mozilla/shield-studies-addon-utils)

## Important notice

### We are moving to Web Extension Experiments

In an effort to remove the necessity of creating legacy add-ons for Shield studies, we are working on [supporting a pure Web Extension Experiment workflow in this template](https://github.com/mozilla/shield-studies-addon-template/issues/53) with a new version, v5, of the [Shield utilities](https://github.com/mozilla/shield-studies-addon-utils/). Support for these workflows is not yet stable. In the meantime, **we do not recommend using this v4 of Shield Utils**.

Instead, we recommend that you:
* build your study as a WEE ([Web Extension Experiment](https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/index.html))
* help us test the requisite [experimental Shield API(s)](https://github.com/mozilla/shield-studies-addon-utils/) on the `develop` branch of this repo.

Example Shield add-ons (implemented as WEEs) using the experimental Shield API(s):
* https://github.com/mozilla/shield-studies-addon-utils/blob/develop/examples/small-study
* https://github.com/mozilla/shield-cloudstorage

## What is this for?

This is a Firefox JavaScript module to be bundled with shield study add-ons (as `StudyUtils.jsm`). Provides these capabilities:

1.  **Suggest variation for a client** (Deterministically! i.e. based on a hash of non-PII user info, they will always get assigned to the same branch every time the study launches)
2.  **Report study lifecycle data** using Telemetry
3.  **Report feature interaction and success data** using Telemetry
4.  **Registers/uregisters the study as an active experiment** (By annotating the Telemetry Environment, marking the user as special in the `main` ping).
5.  **Validates schema for study config**
6.  **Handles study endings** (endStudy method bundles lots of tasks in one, including appending survey URLs specified in Config.jsm with query strings/sending the user to a survey and uninstalling the add-on)

The pings end up in the `shield-study` and `shield-study-addon` Telemetry buckets for faster analysis.

Allows add-on developers to build [Shield Study](https://wiki.mozilla.org/Firefox/Shield/Shield_Studies) ([Normandy](https://wiki.mozilla.org/Firefox/Shield#Normandy_-_User_Profile_Matching_and_Recipe_Deployment)) compatible add-ons without having to think very much.

## What You are Building

* You are building a [legacy add-on](https://developer.mozilla.org/Add-ons/Legacy_add_ons). To deploy these after 57, you will need the magic special signing.
* Shield study add-ons can not be based on Web Extensions [yet](https://github.com/mozilla/shield-studies-addon-utils/issues/45).
* Jetpack / addon-sdk is not at all supported since v4 of this utils library.

## Get started

Check out [mozilla/shield-studies-addon-template/](https://github.com/mozilla/shield-studies-addon-template/) to get started with an example study where shield-studies-addon-utils is already installed and configured.

## Installing the `StudyUtils.jsm` in your add-on

```
npm install --save-dev shield-studies-addon-utils
```

Copy `dist/StudyUtils.jsm` to your `addon` source directory, where it will be zipped up.

## Engineering and Process

* [Shield article on Mozilla Wiki](https://wiki.mozilla.org/Firefox/Shield)
* [Shield Studies article on Mozilla Wiki](https://wiki.mozilla.org/Firefox/Shield/Shield_Studies)
* [mozilla/shield-studies-addon-template/](https://github.com/mozilla/shield-studies-addon-template/)
* [Current work-in-progress docs and launch process](https://github.com/mozilla/shield-studies-addon-utils/issues/93)
* [Long, rambling engineering docs](./docs/engineering.md)
* Come to slack: #shield

## Gotchas, Opinions, Side Effects, and Misfeatures

1.  No handling of 'timers'. No saved state at all (including the variation name), unless you handle it yourself.

2.  No 'running' pings in v4 (yet).

3.  User disable also uninstalls (and cleans up).

## Development on the Utils

* open an issue
* hack and file a PR

## History of major versions

* v5: (In development) API exposed as a Web Extension Experiment
* v4.1: Improved utils for common cases
* v4: First `.jsm` release. Uses packet format for PACKET version 3.
* v3: Attempt to formalize on `shield-study` PACKET version 3. Jetpack based. Prototype used for `raymak/page-reload`. All work abandoned, and no formal npm release in this series. Work done at `v3-shield-packet-format` branch. LAST JETPACK (addon-sdk) RELEASE.
* v2: Code refactor to es6 `class` with event models. Added cli tooling. Packet format is still arbitrary and per-study. Jetpack based. Last used in studies in Q2 2017.
* v1: Initial work and thinking. Telemetry packets are rather arbitrary. Jetpack based.

### Legacy template repositories

Repositories that should not be used as templates for new studies:

<https://github.com/gregglind/template-shield-study> - The incubation repo for the updated structure and contents of this repo, ported to the official template in late 2017.
<https://github.com/benmiroglio/shield-study-embedded-webextension-hello-world-example> - A repository that was created in 2017 to help new Shield/Pioneer engineers to quickly get up and running with a Shield add-on, built upon an older and much more verbose add-on template. It's documentation has been ported to the official template repo.
<https://github.com/johngruen/shield-template> - Despite its name, this repo is for static amo consent pages and does not contain any template for Shield studies
