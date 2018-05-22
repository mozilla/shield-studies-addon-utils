/* eslint-env node */

const {
  searchTelemetryArchive,
} = require("../webExtensionApis/study/src/telemetry");

const firefox = require("selenium-webdriver/firefox");
const Context = firefox.Context;

module.exports.telemetry = {
  getActiveExperiments: async driver => {
    driver.setContext(Context.CHROME);
    return driver.executeAsyncScript(async callback => {
      ChromeUtils.import(
        "resource://gre/modules/TelemetryEnvironment.jsm",
      );
      callback(TelemetryEnvironment.getActiveExperiments());
    });
  },

  /**
   * Expose browser.study.searchSentTelemetry() to test utils so that it can
   * be used regardless of the current browser context as well as
   * after the extension has been uninstalled
   *
   * @param {object} driver Configured Firefox driver instance
   * @param {object} searchTelemetryQuery (See `broswer.study.searchSentTelemetry`)
   * @returns {Promise<*>} Array of Pings (See `broswer.study.searchSentTelemetry`)
   */
  searchSentTelemetry: async (driver, searchTelemetryQuery) => {
    driver.setContext(Context.CHROME);
    return driver.executeAsyncScript(
      async (_searchTelemetryArchive, _searchTelemetryQuery, callback) => {
        // eslint-disable-next-line no-eval
        eval(_searchTelemetryArchive);
        ChromeUtils.import("resource://gre/modules/TelemetryArchive.jsm");
        callback(
          await searchTelemetryArchive(TelemetryArchive, _searchTelemetryQuery),
        );
      },
      searchTelemetryArchive,
      searchTelemetryQuery,
    );
  },

  getShieldPingsAfterTimestamp: async (driver, ts) => {
    return module.exports.telemetry.searchSentTelemetry(driver, {
      type: ["shield-study", "shield-study-addon"],
      timestamp: ts,
    });
  },

  filterPings: (conditionArray, pings) => {
    const resultingPings = [];
    for (const condition of conditionArray) {
      const index = pings.findIndex(ping => condition(ping));
      if (index === -1) {
        continue;
      }
      resultingPings.push(pings[index]);
    }
    return resultingPings;
  },

  summarizePings: pings => {
    return pings.map(p => [p.payload.type, p.payload.data]);
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
