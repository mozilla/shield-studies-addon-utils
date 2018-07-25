| [`browser.study` api](./docs/api.md) | [small example](./examples/small-study/) | [(Full) WebExtension template](https://github.com/mozilla/shield-studies-addon-template/) | [Engineering hints](#engineering-and-process) | [Shield - Mozilla Wiki](https://wiki.mozilla.org/Firefox/Shield) |
| ------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------- |


# Shield Studies Addon Utils

[![CircleCI badge](https://img.shields.io/circleci/project/github/mozilla/shield-studies-addon-utils/master.svg?label=CircleCI)](https://circleci.com/gh/mozilla/shield-studies-addon-utils/)

This is the home of the [`shield-studies-addon-utils` npm package](https://www.npmjs.com/package/shield-studies-addon-utils), which provides:

* WebExtensionExperiment API's
  * `browser.study`
  * `browser.prefs` (TBD)
* Additional useful testing interface

  * `browser.studyDebug`

* Scripts:
  * `copyStudyUtils` shell command copying these files in your study add-on.

## Goals:

Allows writing [Shield and Pioneer](https://wiki.mozilla.org/Firefox/Shield/Shield_Studies) ([Normandy](https://wiki.mozilla.org/Firefox/Shield#Normandy_-_User_Profile_Matching_and_Recipe_Deployment)) study WebExension Experiments correctly.

* **assign variations**: deterministic, persistent variation assignments for A/B multi-variant studies.
* **startup/shutdown/disable/uninstall**: has strong opinions about business logic for Telemetry around startup, shutdown
* **expiration**: helps handle study expiration by storing first run timestamp in a preference
* **eligibility**: consistent handling of post-install / first run eligiblity
* **telemetry helpers** make it easier to send correctly formatted `shield-study`, `shield-study-addon` Telemetry.
* **format survey urls** and other 'post' and 'mid-study' urls to have correct appended query arguments, to
  * create flow-control logic during surveys
  * proper version, study and other tracking variables

## Learn the API

0.  **Read** the API: [study api.md](./docs/api.md)

    Documentation of the API. Notice that there are

    * `functions`: async functions in the `browser.study`.
    * `events`: webExtension events in the `browser.study`
    * `types`: jsonschema draft-04 formats.

1.  **Explore** [`examples/small-study`](./examples/small-study/):

    * [`manifest.json`](./examples/small-study/src/manifest.json)

      Notice the `experiment_apis` section. This maps `browser.study` to the privileged api code. (See details below)

    * [`studySetup.js`](./examples/small-study/src/studySetup.js)

      Construct a `studySetup` usable by `browser.study.setup`

    * [`background.js`](./examples/small-study/src/background.js)

      Using the `browser.study` api within a small instrumented feature.

1.  **Create magic** using [mozilla/shield-studies-addon-template/](https://github.com/mozilla/shield-studies-addon-template/) to get started with an example study where `shield-studies-addon-utils` is already installed and configured.

## Installing the Shield Studies Addon Utils in your add-on

1.  Install the Package

    **Stable version.**

    ```
    npm install --save shield-studies-addon-utils
    ```

    **V5.1 develop branch**

    ```
    npm install --save mozilla/shield-studies-addon-utils#develop
    ```

2.  Copy the files to your 'privileged' src directory

    ```
    # copyStudyUtils is installed in `node_modules/.bin`
    copyStudyUtils ./privileged --example
    ```

    Suggestion: make this part of your `package.json:scripts.postinstall` script.

3.  Set logging in `about:config`

    ```
    prefName: shieldStudy.logLevel
    values: All|Trace|Debug|Info|Warn|Error
    ```

## WebExtension APIs Provided by Shield Studies Addon Utils

### `browser.study.*`

[`browser.study` API documentation](./docs/study/api.md)

Provides these capabilities:

1.  **deterministically decide variation for a client** (`setup`), i.e. based on a hash of non-PII user info, they will always get assigned to the same branch every time the study launches)
2.  **Report study lifecycle data** using Telemetry configured.
3.  **Report feature interaction and success data** using study-specific Telemetry (`sendTelemetry`).
4.  **Registers/unregisters the study as an active experiment** (By annotating the Telemetry Environment, marking the user as special in the `main` ping).
5.  **Validates setup using schema for study configuration**.
6.  **Handles study endings** (`endStudy` method bundles lots of tasks in one, including appending survey URLs specified in Config.jsm with query strings/sending the user to a survey and uninstalling the add-on).

To use in your study (long-version):

* `copyStudyUtils yourAddonSrc/privileged/` which copies `webExtensionApis/study/api.js` and `webExtensionApis/study/schema.json` to your add-on's source directory under `yourAddonSrc/privileged/study`,
* addthe following to your add-on's manifest.json:

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

* `shield` - The pings end up in the `shield-study` and `shield-study-addon` Telemetry buckets for faster analysis.
* TBD: `pioneer` - The pings are encrypted and end up in the Pioneer processing pipeline
* TBD: `custom-telemetry-events` - The pings end up in the ordinary destination for custom telemetry events (Not Yet Implemented)

### `browser.studyDebug.*`

[`browser.studyDebug` API documentation](./docs/study/api.md)

Tools for writing tests, getting and resetting StudyUtils iternals.

### `browser.prefs.*`

**Not yet implemented**

Allows your web extension add-on to set and read preferences.

To use, copy and adjust the files as per the `study` API above.

## Engineering and Process

* Come to Slack: #shield
* [Shield article on Mozilla Wiki](https://wiki.mozilla.org/Firefox/Shield)
* [Shield Studies article on Mozilla Wiki](https://wiki.mozilla.org/Firefox/Shield/Shield_Studies)
* [mozilla/shield-studies-addon-template/](https://github.com/mozilla/shield-studies-addon-template/)

### Hints and opinions.

1.  We put all the privileged code in `src/privileged` to make it easy for QA
2.  The 'Firefox privileged' modules cannot use webExtension apis (`browserAction`, `management`, etc.). Use a `background.js` script (using messages and events) to co-ordinate multiple privileged modules.
3.  Our toolchain for making schemas: `schema.yaml => {schema.json, api.md}`

## Directory Highlights

(see Build Process below)

* `webExtensionApis/study`

Firefox WebExtension Experiments APIs providing capabilities for study add-ons that are yet not available in the built-in WebExtension APIs

* `testUtils/`

  Test utilities (helper classes to write functional/unit tests for your study add-on)

* `examples/`

  Tested and verified example add-ons using the WebExtension Experiments APIs and test utilities

```
.
├── LICENSE
├── README.md
├── bin/
├── docs/
├── examples/
│   └── small-study/
├── misc/
│   └── shield-study-helper-addon/
├── package-lock.json
├── package.json
├── test/
├── test-addon/
├── testUtils/
└── webExtensionApis/
   └── study/
        ├── api.js
        ├── schema.json
        ├── schema.yaml
        ├── src/
        └── webpack.config.js
```

## Build process overview: `npm run build`

Goal: create the `study/api.js` and `study/schema.json` files that implement the `browser.study` WEE interface, for use by WebExtension Add-ons.

1.  **Format** `eslint`, `prettier` all javascript code in all directories
2.  **Bundle** `webExtensionApis/study/api.js`, the `browser.study` WEE interface.

* `webpack` `study/src/*` into `study/api.js`

  * `study/src/index.js` contains the `getApi` call, as seen by webExtension add-ons.
  * `study/src/studyUtils` is a conversion of the 'studyUtils.jsm' from v4, and contains most of the privileged code
  * Tools for well-formatted Telemetry:

    * includes `ajv` for schema validation (for sending Telemetry)
    * includes the Telemetry Parquet Shield Schemas from `shield-study-schemas/schemas-client/*`

3.  **Derive** `webExtensionApis/study/schema.json`, the `browser.study` WEE interface.

* `webExtensionApis/study/schema.yaml` is the canonical source. Using Yaml allows easily multiline comments
* `npm run build:schema`

      - converts `schema.yaml => schema.json`
      - validates that schema is probably a valid WEE schema.
      - creates API docs `schema.yaml => docs/api.md`

## Testing overview: `npm run test`

(If you are looking for ideas about QA for your study addon, see the FAQ.)

Goal: Use `webdriver` to exercise the `browser.study` API to prove correctness.

1.  Builds and formats the API using `npm run build`
2.  Copies the created WEE interface files into `test-addon/src/privileged/`
3.  Build the `test-addon/` using `web-ext build`. This add-on creates a **detached panel**. Inside this panel is a context where `browser.study` will be useable.
4.  Do tests:

    1.  `mocha` test runner uses files in `testUtils/` to
    2.  Install the addon (using `webdriver`)
    3.  Switch context to the panel, so that we can exercise `browser.study`. The function that does this: `setupWebDriver`
    4.  Run all tests. Most API tests are at: `test/functional/browser.study.api.js`
    5.  Most tests are of this `Selenium`/`WebDriver`/`GeckoDriver` form:

        * run some async code in the panel context using `addonExec`
        * in that code, exercise the `browser.study` api.
        * callback with the results of `browser.study.setup()`, and/or `browser.studyDebug.getInternals()` as necessary.
        * use `node` `assert` to check the called back result.

**Note**: `browser.studyDebug.getInternals()` gets internals of the `studyUtils` singleton as needful. `browser.studyDebug` also allows other manipulation of the studyUtils singleton, for use by tests, and to induce states and reactions.

## FAQ

* What's the deal with Webpack?

  * We want `api.js` to be one file, for ease of use by study authors
  * We want the source to be broken up into logical pieces
  * Firefox doens't come with a usable JSONSchema library (`Schema.jsm` isn't very usable.
  * We want Jsonschema validation to guard args, and to send Telemetry
  * we use `webpack` to bundle src and AJV (jsonschema) into `api.js`

* Why is testing so wack / smelly?

  * We don't know Firefox

    * We are ignorant about Mochitest,
    * so we rebuilt a lot of things in Selenium / webDriver

  * The things we are testing are mostly weird / hard addon edge cases
    * a lot of the code is to simulate weird things like add-on install / unintall / startup / setup under weird combinations of conditions

* What Telemetry is sent when?

  * firstrun only: `enter`

    * if (! allowEnroll)

      `ineligible` => `exit` then uninstall the add-on.

    * else: `install`

  * second and subsequent:

    * if (expired)

      `expire` => `exit` (then uninstall)

    * if (endStudy(reason)), then

      `ended-positive|ended-neutral|ended-negative` => `exit`

* What is `allowEnroll` and other startup semantics?

  (See telemetry above)

  * IsFirstRun => user doesn't have the pref set for `{id}.firstRunTimestamp`

  * IIF first run, then allowEnroll can make the user `ineligible`

* Expiration

  * use [`browser.alarms`](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/alarms/create). See the `examples/small-study`.
  * `browser.study.setup({expire: {days: 1}})` will help to calculate when to fire the alarm

- Ending a study.

  * studies end when

    1.  you call `browser.study.endStudy`
    2.  studies hit their `expire.days` after `firstRunTimestamp`
    3.  user disables the study from `about:addons`
    4.  Normandy revokes a study (which looks like `user-disable`, see #194)

  * In all cases (except the 'user-disable', see #194), the webExtension will see an `onEndStudy` if registered. It's up to the add-on to then open all endingUrls, and actually uninstall the study.

- QA

  * put your 'jsm' files in `privileged` by convention.
  * your addon can use prefs to override the `testing` fields in a `studySetup` (to choose a variation).
  * exercising all the study endings is hard. Ideas welcome.
  * proving that your addon doesn't regress performance is hard. Ideas welcome.

## Development on the Shield-Studies-Addon-Utils

* Open an issue
* Hack and file a PR
* `npm run test` must pass.
* Useful testing helpers.
  * `KEEPOPEN=1 npm run test` keeps Firefox open
  * `SKIPLINT=1 npm run test` skips linting
  * `npm run test-only` skips build steps.
* Read [./docs/development-on-the-utils.md](./docs/development-on-the-utils.md) for more in-depth development documentation.

## History of major versions

* v5.1: (In development at: `mozilla/shield-studies-addon-utils#develop`). Further extensions.
* v5: API exposed as a Web Extension Experiment. Minimal viable add-on example added. Test coverage improved. Test utils added.
* v4.1: Improved utils for common cases
* v4: First `.jsm` release for shipping studies as [legacy add-ons](https://developer.mozilla.org/Add-ons/Legacy_add_ons). Used packet format for PACKET version 3. (Jetpack / addon-sdk is not at all supported since v4 of this utils library)
* v3: Attempt to formalize on `shield-study` PACKET version 3. Jetpack based. Prototype used for `raymak/page-reload`. All work abandoned, and no formal npm release in this series. Work done at `v3-shield-packet-format` branch. LAST JETPACK (addon-sdk) RELEASE.
* v2: Code refactor to es6 `class` with event models. Added cli tooling. Packet format is still arbitrary and per-study. Jetpack based. Last used in studies in Q2 2017.
* v1: Initial work and thinking. Telemetry packets are rather arbitrary. Jetpack based.

### DO NOT USE These Old Template Repositories

Repositories that should not be used as templates for new studies:

* NO. <https://github.com/benmiroglio/shield-study-embedded-webextension-hello-world-example> - A repository that was created in 2017 to help new Shield/Pioneer engineers to quickly get up and running with a Shield add-on, built upon an older and much more verbose add-on template. It's documentation has been ported to the official template repo.
* NO. <https://github.com/johngruen/shield-template> - Despite its name, this repo is for static amo consent pages and does not contain any template for Shield studies
