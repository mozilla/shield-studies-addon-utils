# Example Study Addon

## Build

```
npm install
```

## Scenarios

### Normal install

- will see orientation

`jpm run -b Aurora --prefs userPrefs/localPrefs.json`

### Consistent variation choices

- will always be 'strong' vartion in `about:config`

`jpm run -b Aurora --prefs userPrefs/consistentArm.json`

### Ineligible user

- will see self-destruct immediately
- no survey
- (optional) handling by addon

`jpm run -b Aurora --prefs userPrefs/prefsExpired.json`

### Expired (completed) study

- addon self-destructs immediately,
- survey for 'end-of-study'

`jpm run -b Aurora --prefs userPrefs/prefsExpired.json`



## Code descriptions:

### `lib/studyInfo.js`

Object with these keys

- `name`: study name for use with Telemetry recording
- `duration`: days before study self-destructs and expires
- `surveyUrl`: called at `end-of-study` and if user uninstalls or disables
- `isEligible`: boolean function, called during INSTALL only.  If false, study will silently uninstall.
- `cleanup`: safely multi-callable "undo effect" function, for end of study cleanup.
- `variations`: key-value of `name`, `effectFunction` that actually do the work of implementing the feature or changes

### `lib/index.js`

Main caller for startup, shutdown.


## Debugging advice:

### Console levels

- https://developer.mozilla.org/en-US/Add-ons/SDK/Tools/console#Logging_Levels
- `extensions.sdk.console.logLevel`, `extensions.extensionID.sdk.console.logLevel`

### Useful Prefs.

- `shield.fakedie`: won't actually remove addon during a 'die' event.

## Side effects

- A timer to check for 'day rollover' and expiry runs every 5 minutes.
- sets a few prefs in the addon-specific prefs tree.

  * `<addon>.shield.variation`
  * `<addon>.shield.firstrun`
