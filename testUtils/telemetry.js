/* eslint-env node */

const firefox = require("selenium-webdriver/firefox");
const Context = firefox.Context;

module.exports.telemetry = {
  getActiveExperiments: async driver => {
    driver.setContext(Context.CHROME);
    return driver.executeAsyncScript(async callback => {
      Components.utils.import(
        "resource://gre/modules/TelemetryEnvironment.jsm",
      );
      callback(TelemetryEnvironment.getActiveExperiments());
    });
  },
  getMostRecentPingsByType: async(driver, pingType) => {
    driver.setContext(Context.CHROME);
    return driver.executeAsyncScript(async(passedPingType, callback) => {
      Components.utils.import("resource://gre/modules/TelemetryArchive.jsm");
      // Returns array of pings of type `type` in sorted order by timestamp
      // first element is most recent ping
      async function getMostRecentPingsByType(type) {
        const pings = await TelemetryArchive.promiseArchivedPingList();

        const filteredPings = pings.filter(p => p.type === type);
        filteredPings.sort((a, b) => b.timestampCreated - a.timestampCreated);

        const pingData = filteredPings.map(ping =>
          TelemetryArchive.promiseArchivedPingById(ping.id),
        );
        return Promise.all(pingData);
      }
      callback(await getMostRecentPingsByType(passedPingType));
    }, pingType);
  },
};
