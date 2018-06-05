/* eslint-env node */

/* This file is a helper script that will install the extension from the .xpi
 * file and setup useful preferences for debugging. This is the same setup
 * that the automated Selenium-Webdriver/Mocha tests run, except in this case
 * we can manually interact with the browser.
 * NOTE: If changes are made, they will not be reflected in the browser upon
 * reloading, as the .xpi file has not been recreated.
 */

require("geckodriver");

// Note: Geckodriver already has quite a good set of default preferences
// for disabling various items.
// https://github.com/mozilla/geckodriver/blob/master/src/marionette.rs
const FIREFOX_PREFERENCES = {
  // Ensure e10s is turned on.
  "browser.tabs.remote.autostart": true,
  "browser.tabs.remote.autostart.1": true,
  "browser.tabs.remote.autostart.2": true,
  // These are good to have set up if you're debugging tests with the browser
  // toolbox.
  "devtools.chrome.enabled": true,
  "devtools.debugger.remote-enabled": true,
  "devtools.debugger.prompt-connection": false,
  "general.warnOnAboutConfig": false,

  "extensions.legacy.enabled": true,

  // WARNING:  also of interest, gecko webdriver sets many prefs at:
  // https://dxr.mozilla.org/mozilla-central/source/testing/geckodriver/src/prefs.rs
  // INCLUDING
  // ("toolkit.telemetry.server", Pref::new("https://%(server)s/dummy/telemetry/")),
};

// Re-usable test methods from shield-studies-addon-utils
const { nav } = require("../../testUtils/nav");
const { setup } = require("../../testUtils/setup");

const utils = {
  FIREFOX_PREFERENCES,
  nav,
  setup,
};

(async() => {
  try {
    console.log("Starting up firefox");
    const driver = await utils.setup.promiseSetupDriver(
      utils.FIREFOX_PREFERENCES,
    );
    console.log("Load temporary addon.");
    await utils.setup.installAddon(driver);
    // navigate to a regular page
    utils.nav.gotoURL(driver, "about:debugging");
  } catch (e) {
    console.error(e); // eslint-disable-line no-console
  }
})();
