# Example Study Addon

## Build

```
npm install
jpm run --prefs localPrefs.json  // or others.
```

## The work:

### `variations.js`

Must export:

- `isEligible`: boolean
- `cleanup`: safely multi-callable "undo effect" function
- `variations`: key-value of `name`, `effectFunction`

### `index.js`

Main caller for startup, shutdown.
