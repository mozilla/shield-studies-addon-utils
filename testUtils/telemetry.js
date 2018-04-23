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
  pingsReport: pings => {
    if (pings.length === 0) {
      return { report: "No pings found" };
    }
    const p0 = pings[0].payload;
    // print common fields
    const report =
      `
// common fields

branch        ${p0.branch}
study_name    ${p0.study_name}
addon_version ${p0.addon_version}
version       ${p0.version}

` +
      pings
        .map(
          (p, i) => `${i} ${p.creationDate} ${p.payload.type}
${JSON.stringify(p.payload.data, null, 2)}

`,
        )
        .join("\n");

    return report;
  },
};
