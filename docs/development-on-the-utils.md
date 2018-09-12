# Development on the Utils

## Directory Highlights

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

1.  **Format** `eslint`, `prettier` all JavaScript code in all directories
2.  **Bundle** `webExtensionApis/study/api.js`, the `browser.study` WEE interface.

* `webpack` `study/src/*` into `study/api.js`

  * `study/src/index.js` contains the `getApi` call, as seen by webExtension add-ons.
  * `study/src/studyUtils` is a conversion of the 'studyUtils.jsm' from v4, and contains most of the privileged code
  * Tools for well-formatted Telemetry:

    * includes `ajv` for schema validation (for sending Telemetry)
    * includes the Telemetry Parquet Shield Schemas from `shield-study-schemas/schemas-client/*`

3.  **Derive** `webExtensionApis/study/schema.json`, the `browser.study` WEE interface.

Our toolchain for making schemas: `schema.yaml => {schema.json, api.md}`

* `webExtensionApis/study/schema.yaml` is the canonical source. Using YAML allows easily multiline comments
* `npm run build:schema`

      - converts `schema.yaml => schema.json`
      - validates that schema is probably a valid WEE schema.
      - creates API docs `schema.yaml => docs/api.md`

## Testing overview: `npm run test`

(If you are looking for ideas about QA for your study add-on, see the FAQ.)

Goal: Use `webdriver` to exercise the `browser.study` API to prove correctness.

1.  Builds and formats the API using `npm run build`
2.  Copies the created WEE interface files into `test-addon/src/privileged/`
3.  Build the `test-addon/` using `web-ext build`. This add-on creates a **detached panel**. Inside this panel is a context where `browser.study` will be useable.
4.  Do tests:

    1.  `mocha` test runner uses files in `testUtils/` to
    2.  Install the add-on (using `webdriver`)
    3.  Switch context to the panel, so that we can exercise `browser.study`. The function that does this: `setupWebDriver`
    4.  Run all tests. Most API tests are at: `test/functional/browser.study.api.js`
    5.  Most tests are of this `Selenium`/`WebDriver`/`GeckoDriver` form:

        * run some async code in the panel context using `addonExec`
        * in that code, exercise the `browser.study` API.
        * callback with the results of `browser.study.setup()`, and/or `browser.studyDebug.getInternals()` as necessary.
        * use `node` `assert` to check the called back result.

**Note**: `browser.studyDebug.getInternals()` gets internals of the `studyUtils` singleton as needful. `browser.studyDebug` also allows other manipulation of the studyUtils singleton, for use by tests, and to induce states and reactions.

## FAQ

* What's the deal with Webpack?

  * We want `api.js` to be one file, for ease of use by study authors
  * We want the source to be broken up into logical pieces
  * Firefox doesn't come with a usable JSONSchema library (`Schema.jsm` isn't very usable.
  * We want Jsonschema validation to guard args, and to send Telemetry
  * we use `webpack` to bundle src and AJV (jsonschema) into `api.js`

* Why is testing so wack / smelly?

  * We don't know Firefox

    * We are ignorant about Mochitest,
    * so we rebuilt a lot of things in Selenium / webDriver

  * The things we are testing are mostly weird / hard add-on edge cases
    * a lot of the code is to simulate weird things like add-on install / uninstall / startup / setup under weird combinations of conditions

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

  * IF first run, then allowEnroll can make the user `ineligible`

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
  * your add-on can use prefs to override the `testing` fields in a `studySetup` (to choose a variation).
  * exercising all the study endings is hard. Ideas welcome.
  * proving that your add-on doesn't regress performance is hard. Ideas welcome.

## File structure

```
├── Dockerfile   # Dockerfile possibly needed by CI
├── LICENSE
├── README.md
├── docs    # Docs that were written for v4, needs updating to be relevant for v5
│   ├── development-on-the-utils.md # Engineering docs for utils developers
│   ├── engineering.md # Engineering docs for study add-on developers
│   ├── survival.md # Doc that probably should be merged with engineering.md
│   └── tutorial.md # Doc that probably should be merged with engineering.md
├── examples   # Should be: Tested and verified example add-ons using the WebExtension Experiments APIs and test utils
│   ├── minimal-viable-addon    # <-- A place to put an example of a minimal viable add-on (if not the test-addon or the template will be used for this instead)
│   └── test-addon    # Add-on used to test the apis and test utils
│       ├── bin
│       │   └── bundle-shield-studies-addon-utils.sh  # The add-on's script for copying relevant files from the utils repo to the add-on (separate script instead of cramming this copying into package.json)
│       ├── dist  # Where add-on builds are stored
│       │   └── shield_utils_test_add-on-1.0.0.zip
│       ├── src   # The add-on / web extension that uses study utils
│       │   ├── background.js
│       │   ├── extension-page-for-tests  # The extension page that pops up when running the test add-on - used by selenium to run extension-privileged js in the tests (for more info, see testUtils/executeJs.js
│       │   │   ├── index.html
│       │   │   └── page.js
│       │   ├── icons # An icon in the form of a shield
│       │   │   ├── LICENSE
│       │   │   └── shield-icon.svg
│       │   ├── manifest.json # The WebExtension manifest file
│       │   ├── privileged # WebExtension Experiments copied to the add-on by ../bin/bundle-shield-studies-addon-utils.sh (see further below for explanations)
│       │   │   ├── prefs
│       │   │   │   ├── api.js
│       │   │   │   └── schema.json
│       │   │   └── study
│       │   │       ├── api.js
│       │   │       └── schema.json
│       │   └── studySetup.js
│       ├── test
│       │   └── functional
│       │       ├── shield_utils_test.js
│       │       └── utils.js
│       └── web-ext-config.js
├── misc # Other possibly relevant helper utils / add-ons
│   └── shield-study-helper-addon # Legacy add-on that displays sent pings by add-ons using the util APIs
│       ├── addon
│       │   ├── bootstrap.js
│       │   ├── chrome.manifest
│       │   ├── install.rdf
│       │   └── webextension
│       │       ├── icon.png
│       │       ├── manifest.json
│       │       ├── qa.html
│       │       └── qa.js
│       ├── build.sh
│       ├── package-lock.json
│       ├── package.json
│       └── run-firefox.js
├── package-lock.json
├── package.json
├── testUtils  #  Test utils (helper classes to write functional/unit tests for your study add-on)
│   ├── executeJs.js
│   ├── nav.js
│   ├── pings.js
│   ├── setup.js
│   ├── ui.js
│   └── wip.js
└── webExtensionApis   # Firefox WebExtension Experiments APIs providing capabilities for study add-ons that are yet not available in the built-in WebExtension APIs
    ├── prefs  # Allows your web extension add-on to set and read preferences.
    │   ├── api.js
    │   └── schema.json
    └── study # The browser.study.* WebExtension API - see ./README.md for more information
        ├── api.js # Built by webpack from the contents of the src/ directory
        ├── schema.json # The WebExtension API schema
        ├── src # Source code that gets bundled by webpack into api.js
        │   ├── index.js # Exposes the WE API
        │   ├── jsonschema.js # Logic for JSON schema validation
        │   ├── sampling.js # Logic for choosing a variation
        │   ├── schemas # Schemas used by this API
        │   │   ├── index.js
        │   │   ├── schema.studySetup.json
        │   │   └── schema.weightedVariations.json
        │   ├── studyUtils.js # The former StudyUtils.in.jsm file from v4
        │   └── studyUtilsBootstrap.js # The logic that was previously addon/bootstrap.js in the template repo
        └── webpack.config.js # Webpack configuration for bundling/building the study API's api.js file

>> tree -a -I 'node_modules|.git|.DS_Store'
```

# Continuous Integration

[Circle CI](https://circleci.com/) is used for continuous integration. Configured via `./.circleci/config.yml`.

Full docs available at https://circleci.com/docs/2.0/local-cli/

## Install cli to test Circle CI locally

```shell
curl -o /usr/local/bin/circleci https://circle-downloads.s3.amazonaws.com/releases/build_agent_wrapper/circleci && chmod +x /usr/local/bin/circleci
```

## Validate Circle CI configuration

```shell
circleci config validate -c .circleci/config.yml
```

## Run Circle CI locally (requires Docker)

To prevent re-use of the local `node_modules` directory (which may contain locally compiled binaries which will cause troubles inside the Docker environment), clone your repository into a clean directory then run CircleCI inside that directory:

```shell
git clone . /tmp/$(basename $PWD)
cd /tmp/$(basename $PWD)
circleci build
```

Note: Steps related to caching and uploading/storing artifacts will report as failed locally. This is not necessarily a problem, they are designed to fail since the operations are not supported locally by the CircleCI build agent.
