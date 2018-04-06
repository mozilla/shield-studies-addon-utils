# Development on the Utils

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
```
