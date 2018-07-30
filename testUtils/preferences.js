/* eslint-env node */

const firefox = require("selenium-webdriver/firefox");
const Context = firefox.Context;

module.exports.preferences = {
  /**
   * Expose Preferences.get() so that tests can assert the value of preferences
   */
  get: async (driver, prefName, defaultValue) => {
    driver.setContext(Context.CHROME);
    return driver.executeAsyncScript(
      async ($prefName, $defaultValue, callback) => {
        ChromeUtils.import("resource://gre/modules/Preferences.jsm");
        // eslint-disable-next-line no-undef
        const result = Preferences.get($prefName, $defaultValue);
        callback(result);
      },
      prefName,
      defaultValue,
    );
  },
};
