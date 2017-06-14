# Example Shield Study Embedded Web Extension

## install

`npm install`
`npm run build`


at second shell/prompt, watch files for changes to rebuild:

`npm run watch`


## in Firefox:

1. `about:debugging > [load temporary addon] > choose `dist/addon.xpi`
2. `tools > Web Developer > Browser Toolbox`

## Effects:

1.  See a new button (with a 'puzzle piece') symbol.
2.  to end early:  Click on button multiple times until the 'too-popular' endpoint is reached.

## Further extensions / modifications

1.  (TBD)

## Description of architecture

Embedded Web Extension (`/webextension/`) lives inside a restartless (`bootstrap.js`) extension.

During `bootstrap.js:startup(data, reason)`:

    a. `shieldUtils` imports and sets configuration from `Config.jsm`
    b. `bootstrap.js:chooseVariation` explicitly and deterministically chooses a variation from `studyConfig.weightedVariations`
    c.  the WebExtension starts up
    d.  `boostrap.js` listens for requests from the `webExtension` that are study related:  `["info", "telemetry", "endStudy"]`
    e.  `webExtension` (`background.js`) asks for `info` from `studyUtils` using `askShield` function.
    f.  Feature starts using the `variation` from that info.
    g.  Feature instruments user button to send `telemetry` and to `endStudy` if the button is clicked enough.


