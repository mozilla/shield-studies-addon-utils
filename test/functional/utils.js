/* eslint-env node */

/**
 * Geckodriver translates WebDriver calls into Firefox Marionette protocol.
 * WebDriver allows remote protocol execution of test code.
 * The geckodriver package downloads and installs geckodriver for us.
 *
 * Use it by requiring it.
 */
require("geckodriver");

// Additional preferences set during tests
const FIREFOX_PREFERENCES = {
  // Ensure e10s is turned on.
  "browser.tabs.remote.autostart": true,
  "browser.tabs.remote.autostart.1": true,
  "browser.tabs.remote.autostart.2": true,

  // Improve debugging using `browser toolbox`.
  "devtools.chrome.enabled": true,
  "devtools.debugger.remote-enabled": true,
  "devtools.debugger.prompt-connection": false,

  // Removing warning for `about:config`
  "general.warnOnAboutConfig": false,

  // Force variation for testing
  "extensions.button_icon_preference.variation": "puppers",

  /** WARNING: Geckodriver sets many additional prefs at:
   * https://dxr.mozilla.org/mozilla-central/source/testing/geckodriver/src/prefs.rs
   *
   * In, particular, this DISABLES actual telemetry uploading
   * ("toolkit.telemetry.server", Pref::new("https://%(server)s/dummy/telemetry/")),
   *
   */
};

// Re-usable test methods from shield-studies-addon-utils
const { executeJs } = require("../../testUtils/executeJs");
const { nav } = require("../../testUtils/nav");
const { setupWebdriver } = require("../../testUtils/setupWebdriver");
const { telemetry } = require("../../testUtils/telemetry");
const { ui } = require("../../testUtils/ui");

const studySchema = require("../../test-addon/src/privileged/study/schema.json");

const Ajv = require("ajv/dist/ajv.min.js");
const ajv = new Ajv();

/**
 * Validates input data based on a specified schema
 * @param {Object} data - The data to be validated
 * @param {Object} schema - The schema to validate against
 * @returns {boolean} - Will return true if the data is valid
 */
function validateJSON(data, schema) {
  const valid = ajv.validate(schema, data);
  return { valid, errors: ajv.errors || [] };
}

// What we expose to our add-on-specific tests
module.exports = {
  FIREFOX_PREFERENCES,
  executeJs,
  nav,
  setupWebdriver,
  studySchema,
  telemetry,
  ui,
  validateJSON,
};
