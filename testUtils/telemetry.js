/* eslint-env node */

const {
  searchTelemetryArchive,
} = require("../webExtensionApis/study/src/telemetry");

const firefox = require("selenium-webdriver/firefox");
const Context = firefox.Context;

// node's util, for printing a deeply nested object to node console
const { inspect } = require("util");

// eslint-disable-next-line no-unused-vars
function full(myObject) {
  return inspect(myObject, { showHidden: false, depth: null });
}

module.exports.telemetry = {
  getActiveExperiments: async driver => {
    driver.setContext(Context.CHROME);
    return driver.executeAsyncScript(async callback => {
      const { TelemetryEnvironment } = ChromeUtils.import(
        "resource://gre/modules/TelemetryEnvironment.jsm",
        null,
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
        const { TelemetryArchive } = ChromeUtils.import(
          "resource://gre/modules/TelemetryArchive.jsm",
          null,
        );
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

  summarizePings: pings => {
    return pings.map(p => [p.payload.type, p.payload.data]);
  },

  pingsDebug: pings => {
    return full(
      pings.map(x => {
        return { id: x.id, payload: x.payload };
      }),
    );
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
          (p, i) => `${p.creationDate} ${p.payload.type}
${JSON.stringify(p.payload.data, null, 2)}`,
        )
        .join("\n\n");

    return report;
  },
};
