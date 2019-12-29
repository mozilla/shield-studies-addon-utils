| [WebExtensions API:s](./docs/api.md) | [Engineering your add-on](#engineering-your-own-study-add-on) |
| ------------------------------------ | ------------------------------------------------------------- |


# Shield Studies Add-on Utils

[![CircleCI badge](https://img.shields.io/circleci/project/github/mozilla/shield-studies-addon-utils/master.svg?label=CircleCI)](https://circleci.com/gh/mozilla/shield-studies-addon-utils/)

## Features

This is the home of the [`shield-studies-addon-utils` npm package](https://www.npmjs.com/package/shield-studies-addon-utils), which provides:

### `shield-study` telemetry

Validate and send `shield-study`, `shield-study-addon` Telemetry, allowing experiments to submit experiment-scoped stringified key-value pairs that are directly available for analysis.

### Pioneer telemetry

Validate, encrypt and send `shield-study`, `shield-study-addon` Pioneer Telemetry.

### Other telemetry helpers

Validate telemetry payloads against JSON schemas and calculate the size of a ping before submitting it.

### Add-on test helpers

Helper classes and methods to write Selenium-based functional/unit tests for your study add-on.

### Survey URLs helper

For formatting 'post' and 'mid-study' survey URLs to have correct appended query arguments in the format that matches the corresponding SurveyGizmo library elements

## Help and support

Thinking about building a Study Add-on? Please read [the docs on Pref-Flip and Add-On Experiments](https://mana.mozilla.org/wiki/display/FIREFOX/Pref-Flip+and+Add-On+Experiments) first.

## Installing Shield Studies Add-on Utils in your add-on

```sh
npm install --save shield-studies-addon-utils
```

* Run `copyStudyUtils yourAddonSrc/privileged/` which copies `webExtensionApis/study/api.js` and `webExtensionApis/study/schema.json` to your add-on's source directory under `yourAddonSrc/privileged/study`,
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

## WebExtension APIs Provided by Shield Studies Add-on Utils

### `browser.study.*`

[`browser.study` API documentation](./webExtensionApis/study/api.md)

#### Supported telemetry pipelines

Depending on which telemetry pipeline is used, the pings end up in different destinations:

* `shield` - The pings end up in the `shield-study` and `shield-study-addon` Telemetry buckets for instant access to submitted payloads via [STMO](https://sql.telemetry.mozilla.org/).
* `pioneer` - The pings are encrypted and end up in the Pioneer processing pipeline.
* TODO: `event-telemetry` - The pings end up in the ordinary destination for event telemetry (Not Yet Implemented)

### `browser.studyDebug.*`

[`browser.studyDebug` API documentation](./webExtensionApis/study/api.md)

Used by the project-internal tests only.

## Engineering your own study add-on

* Check out [the official study add-on example](https://github.com/mozilla/normandy-nextgen-study-example)
* Read [./docs/engineering.md](./docs/engineering.md) for development documentation aimed at study add-on engineers.

## Development on the Shield-Studies-Addon-Utils

* Open an issue
* Hack and file a PR
* `npm test` must pass.
* Read [./docs/development-on-the-utils.md](./docs/development-on-the-utils.md) for more in-depth development documentation.

## History of recent major versions

* v6.0: Rip out most functionality, keeping only some high priority utils\* that neither the Normandy WebExtension API nor [the Nextgen study example](https://github.com/mozilla/normandy-nextgen-study-example) provides
* v5.3: [Better study endings](https://github.com/mozilla/shield-studies-addon-utils/issues/246) and `browser.study.fullSurveyUrl()`
* v5.2: Added Pioneer and Firefox 67 support
* v5.1: Added preferences for testing overrides, study logger and other enhancements
* v5: API exposed as a Web Extension Experiment. Minimal viable add-on example added. Test coverage improved. Test utils added.

\* Some features that was handled in v5 has not been ported over to neither Normandy nor v6 of the utils:

* expiry
* lifecycle telemetry (first seen, installed, exit etc)
* configurable endings (annotated exit telemetry and launching of exit surveys etc)
* telemetry testing flag specific to study telemetry (disable telemetry via about:config during testing instead)
* pref-controlled study-specific study logger (use ordinary add-on-scoped logging instead)
