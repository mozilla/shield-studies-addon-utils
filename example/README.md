# Example Study Addon

## Build

```
npm install
jpm run --prefs userPrefs/localPrefs.json  # or in that dir.
```

## The work:

### `lib/variations.js`

Must export:

- `isEligible`: boolean, called during INSTALL only.
- `cleanup`: safely multi-callable "undo effect" function, for end of study cleanup.
- `variations`: key-value of `name`, `effectFunction`

### `lib/index.js`

Main caller for startup, shutdown.

## Debugging advice:

### Console levels

- https://developer.mozilla.org/en-US/Add-ons/SDK/Tools/console#Logging_Levels
- `extensions.sdk.console.logLevel`, `extensions.extensionID.sdk.console.logLevel`

### useful prefs.

- `shield.fakedie`: won't actually remove addon during a 'die' event.

## Side effects

- A timer to check for 'day rollover' and expiry runs every 5 minutes.
- sets a few prefs in the addon-specific prefs tree.  If you use `variation` and `firstrun` this may surprise you.
