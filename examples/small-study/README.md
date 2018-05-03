# An example `small-study`

## files

```
.
├── README.md
├── built-addons/       # `web-ext build` output
├── package-lock.json
├── package.json
├── src/
│   ├── studySetup.js   # mostly declaritive study config
│   ├── background.js   # main script impelementing addon
│   ├── icons/
│   │   ├── LICENSE
│   │   └── shield-icon.svg
│   ├── manifest.json
│   └── privileged/     # npm run studyutils copies `browser.study` api here.
└── web-ext-config.js
```

## setup / install

```
npm install -g web-ext

# up tree to make the utils
(cd ../../ && npm run build)

## in this directory:

# uses the 'in-tree' version of the addon utils
npm install
# copy in necessary files.
npm run studyutils  
```

## start the study web extension experiment (WEE)

```
npm start    # web-ext run --no-reload
```

## short description flow and description

1.  `manifest.json` maps `experiment_apis` to make lazy gettres at `browser.study`
2.  Background loads

    * `studySetup.js`, mostly declarative config for studies.
    * `background.js` which runs both the feature (a button / browserAction) and the `browser.study` lifecycle events

3.  `background.js:StudyLifeCycleHandler` tracks a little logic.

    * `browser.study.onEndStudy` is watched BEFORE we setup
    * `browser.study.setup(...)` does the setup, and handles the complex logic of startup / firstRun / shouldAllowEnroll

## Next Steps

1.  Get help from the Weird Science Team
2.  Move on to the more complete [mozilla/shield-studies-addon-template]
3.  Edit things, goof around, try other aspects of the API.
