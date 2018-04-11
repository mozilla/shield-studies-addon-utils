/* eslint-env node */

const firefox = require("selenium-webdriver/firefox");
const Context = firefox.Context;

module.exports.telemetryEnvironment = {
  getActiveExperiments: async driver => {
    driver.setContext(Context.CHROME);
    return driver.executeAsyncScript(async callback => {
      Components.utils.import(
        "resource://gre/modules/TelemetryEnvironment.jsm",
      );
      callback(TelemetryEnvironment.getActiveExperiments());
    });
  },
};
