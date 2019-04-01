| [WebExtensions API:s](./docs/api.md) | [Small example](./examples/small-study/) | [(Full) WebExtension template](https://github.com/mozilla/shield-studies-addon-template/) | [Engineering your add-on](#engineering-your-own-study-add-on) | [Shield - Mozilla Wiki](https://wiki.mozilla.org/Firefox/Shield) |
| ------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |


# Shield Studies Add-on Utils

[![CircleCI badge](https://img.shields.io/circleci/project/github/mozilla/shield-studies-addon-utils/master.svg?label=CircleCI)](https://circleci.com/gh/mozilla/shield-studies-addon-utils/)

This is the home of the [`shield-studies-addon-utils` npm package](https://www.npmjs.com/package/shield-studies-addon-utils), which provides:

* WebExtensionExperiment API's

  * `browser.study`

* Additional useful testing interface

  * `browser.studyDebug`

* Scripts:

  * `copyStudyUtils` shell command copying these files in your study add-on.

## Goals:

Allows writing [Shield and Pioneer Add-on Experiments](https://mana.mozilla.org/wiki/display/FIREFOX/Pref-Flip+and+Add-On+Experiments) that manage their own life-cycle.

* **assign variations**: deterministic, persistent variation assignments for A/B multi-variant studies.
* **startup/shutdown/disable/uninstall**: has strong opinions about business logic for Telemetry around startup, shutdown
* **expiration**: helps handle study expiration by storing first run timestamp in a preference
* **eligibility**: consistent handling of post-install / first run eligiblity
* **telemetry helpers** make it easier to send correctly formatted `shield-study`, `shield-study-addon` Telemetry.
* **format survey URLs** and other 'post' and 'mid-study' URLs to have correct appended query arguments, to
  * create flow-control logic during surveys
  * proper version, study and other tracking variables

## Help and support

Thinking about building a Study Add-on? Please read [the docs on Pref-Flip and Add-On Experiments](https://mana.mozilla.org/wiki/display/FIREFOX/Pref-Flip+and+Add-On+Experiments) first.

If you haven't checked out [the template](https://github.com/mozilla/shield-studies-addon-template) yet, do it. It contains a lot of best practices that helps study add-ons pass QA quicker.

## Learn the API

1.  **Read** the API: [study api.md](./docs/api.md)

    Documentation of the API. Notice that there are

    * `functions`: async functions in the `browser.study`.
    * `events`: webExtension events in the `browser.study`
    * `types`: jsonschema draft-04 formats.

2.  **Explore** [`examples/small-study`](./examples/small-study/):

    * [`manifest.json`](./examples/small-study/src/manifest.json)

      Notice the `experiment_apis` section. This maps `browser.study` to the privileged API code. (See details below)

    * [`studySetup.js`](./examples/small-study/src/studySetup.js)

      Construct a `studySetup` usable by `browser.study.setup`

    * [`background.js`](./examples/small-study/src/background.js)

      Using the `browser.study` API within a small instrumented feature.

3.  **Create magic** using [mozilla/shield-studies-addon-template/](https://github.com/mozilla/shield-studies-addon-template/) to get started with an example study where `shield-studies-addon-utils` is already installed and configured.

## Installing the Shield Studies Add-on Utils in your add-on

1.  Install the Package

    ```sh
    npm install --save shield-studies-addon-utils
    ```

2.  Copy the files to your 'privileged' src directory

    ```sh
    # copyStudyUtils is installed in `node_modules/.bin`
    copyStudyUtils ./privileged --example
    ```

    Suggestion: make this part of your `package.json:scripts.postinstall` script.

3.  Set logging in `about:config`

    ```
    prefName: shieldStudy.logLevel
    values: All|Trace|Debug|Info|Warn|Error
    ```

Again, [the template](https://github.com/mozilla/shield-studies-addon-template) has this preconfigured already.

## WebExtension APIs Provided by Shield Studies Add-on Utils

### `browser.study.*`

[`browser.study` API documentation](./webExtensionApis/study/api.md)

Provides these capabilities:

1.  **deterministically decide variation for a client** (`setup`), i.e. based on a hash of non-PII user info, they will always get assigned to the same branch every time the study launches)
2.  **Report study lifecycle data** using Telemetry configured.
3.  **Report feature interaction and success data** using study-specific Telemetry (`sendTelemetry`).
4.  **Registers/unregisters the study as an active experiment** (By annotating the Telemetry Environment, marking the user as special in the `main` ping).
5.  **Validates setup using schema for study configuration**.
6.  **Handles study endings** (`endStudy` method bundles lots of tasks in one, including appending survey URLs specified in Config.jsm with query strings/sending the user to a survey and uninstalling the add-on).

To use in your study (long-version):

* `copyStudyUtils yourAddonSrc/privileged/` which copies `webExtensionApis/study/api.js` and `webExtensionApis/study/schema.json` to your add-on's source directory under `yourAddonSrc/privileged/study`,
* add the following to your add-on's manifest.json:

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

* `shield` - The pings end up in the `shield-study` and `shield-study-addon` Telemetry buckets for instant access to submitted payloads via [STMO](https://sql.telemetry.mozilla.org/).
* `pioneer` - The pings are encrypted and end up in the Pioneer processing pipeline.
* TBD: `custom-telemetry-events` - The pings end up in the ordinary destination for custom telemetry events (Not Yet Implemented)

### `browser.studyDebug.*`

[`browser.studyDebug` API documentation](./webExtensionApis/study/api.md)

Tools for writing tests, getting and resetting StudyUtils internals.

## Engineering your own study add-on

* Check out [mozilla/shield-studies-addon-template/](https://github.com/mozilla/shield-studies-addon-template/) to start from.
* Read [./docs/engineering.md](./docs/engineering.md) for development documentation aimed at study add-on engineers.

### DO NOT USE These Old Template Repositories

Repositories that should not be used as templates for new studies:

* NO. <https://github.com/benmiroglio/shield-study-embedded-webextension-hello-world-example> - A repository that was created in 2017 to help new Shield/Pioneer engineers to quickly get up and running with a Shield add-on, built upon an older and much more verbose add-on template. It's documentation has been ported to the official template repo.
* NO. <https://github.com/johngruen/shield-template> - Despite its name, this repo is for static AMO consent pages and does not contain any template for Shield studies

## Development on the Shield-Studies-Addon-Utils

* Open an issue
* Hack and file a PR
* `npm test` must pass.
* Read [./docs/development-on-the-utils.md](./docs/development-on-the-utils.md) for more in-depth development documentation.

## History of major versions

* v5.3: [Better study endings](https://github.com/mozilla/shield-studies-addon-utils/issues/246) and `browser.study.fullSurveyUrl()`
* v5.2: Added Pioneer and Firefox 67 support
* v5.1: Added preferences for testing overrides, study logger and other enhancements
* v5: API exposed as a Web Extension Experiment. Minimal viable add-on example added. Test coverage improved. Test utils added.
* v4.1: Improved utils for common cases
* v4: First `.jsm` release for shipping studies as [legacy add-ons](https://developer.mozilla.org/Add-ons/Legacy_add_ons). Used packet format for PACKET version 3. (Jetpack / addon-sdk is not at all supported since v4 of this utils library)
* v3: Attempt to formalize on `shield-study` PACKET version 3. Jetpack based. Prototype used for `raymak/page-reload`. All work abandoned, and no formal npm release in this series. Work done at `v3-shield-packet-format` branch. LAST JETPACK (addon-sdk) RELEASE.
* v2: Code refactor to es6 `class` with event models. Added cli tooling. Packet format is still arbitrary and per-study. Jetpack based. Last used in studies in Q2 2017.
* v1: Initial work and thinking. Telemetry packets are rather arbitrary. Jetpack based.
