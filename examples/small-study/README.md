# An example `small-study`

## files

```
.
├── README.md
├── dist/               # `web-ext build` output
├── package-lock.json
├── package.json
├── src/
│   ├── studySetup.js   # mostly declarative study config
│   ├── background.js   # main script implementing addon
│   ├── icons/
│   │   ├── LICENSE
│   │   └── shield-icon.svg
│   ├── manifest.json
│   └── privileged/     # `npm run bundle-utils` copies `browser.study` api here.
└── web-ext-config.js
```

## setup / install

```
npm install -g web-ext

# rebuilds the utils from source then copies them in.
npm install
```

## start the study web extension experiment (WEE)

```
npm start    # web-ext run
```

## short description flow and description

1.  `manifest.json` maps `experiment_apis` to make lazy gettrers at `browser.study`
2.  Background loads

    * `studySetup.js`, a mostly declarative configuration for the study.
    * `background.js` which runs both the feature (a button / browserAction) and the `browser.study` lifecycle events

3.  `background.js:StudyLifeCycleHandler` tracks a little logic.

    * `browser.study.onEndStudy` is watched BEFORE we setup
    * `browser.study.setup(...)` does the setup, and handles the complex logic of startup / firstRun / shouldAllowEnroll

## Next Steps

1.  Get help from the Weird Science Team (#shield on Slack)
2.  Move on to the more complete [mozilla/shield-studies-addon-template]
3.  Edit things, goof around, try other aspects of the API.
