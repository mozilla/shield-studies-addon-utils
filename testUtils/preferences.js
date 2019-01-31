/* eslint-env node */

const firefox = require("selenium-webdriver/firefox");
const Context = firefox.Context;

module.exports.preferences = {
  /**
   * Expose Preferences.get() so that tests can assert the value of preferences
   *
   * @param {object} driver See Preferences.get()
   * @param {string} prefName See Preferences.get()
   * @param {any} defaultValue See Preferences.get()
   * @returns {Promise<*>} See Preferences.get()
   */
  get: async (driver, prefName, defaultValue) => {
    driver.setContext(Context.CHROME);
    return driver.executeAsyncScript(
      async ($prefName, $defaultValue, callback) => {
        const { Preferences } = ChromeUtils.import(
          "resource://gre/modules/Preferences.jsm",
          null,
        );
        // eslint-disable-next-line no-undef
        const result = Preferences.get($prefName, $defaultValue);
        callback(result);
      },
      prefName,
      defaultValue,
    );
  },
  /**
   * Expose Preferences.set() so that tests can set the value of preferences
   *
   * @param {object} driver See Preferences.set()
   * @param {string} prefName See Preferences.set()
   * @param {any} prefValue See Preferences.set()
   * @returns {Promise<*>} See Preferences.set()
   */
  set: async (driver, prefName, prefValue) => {
    driver.setContext(Context.CHROME);
    return driver.executeAsyncScript(
      async ($prefName, $prefValue, callback) => {
        const { Preferences } = ChromeUtils.import(
          "resource://gre/modules/Preferences.jsm",
          null,
        );
        // eslint-disable-next-line no-undef
        const result = Preferences.set($prefName, $prefValue);
        callback(result);
      },
      prefName,
      prefValue,
    );
  },
};
