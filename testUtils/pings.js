/* eslint-env node */

module.exports.pings = {
  /** Returns array of pings of type `type` in reverse sorted order by timestamp
   * first element is most recent ping
   *
   * as seen in shield-study-addon-util's `utils.jsm`
   * options
   * - type:  string or array of ping types
   * - n:  positive integer. at most n pings.
   * - timestamp:  only pings after this timestamp.
   * - headersOnly: boolean, just the 'headers' for the pings, not the full bodies.
   */
  getTelemetryPings: async(driver, passedOptions) => {
    // callback is how you get the return back from the script
    return driver.executeAsyncScript(async(options, callback) => {
      let { type } = options;
      const { n, timestamp, headersOnly } = options;
      Components.utils.import("resource://gre/modules/TelemetryArchive.jsm");
      // {type, id, timestampCreated}
      let pings = await TelemetryArchive.promiseArchivedPingList();
      if (type) {
        if (!(type instanceof Array)) {
          type = [type]; // Array-ify if it's a string
        }
      }
      if (type) pings = pings.filter(p => type.includes(p.type));

      if (timestamp) pings = pings.filter(p => p.timestampCreated > timestamp);

      pings.sort((a, b) => b.timestampCreated - a.timestampCreated);
      if (n) pings = pings.slice(0, n);
      const pingData = headersOnly
        ? pings
        : pings.map(ping => TelemetryArchive.promiseArchivedPingById(ping.id));

      callback(await Promise.all(pingData));
    }, passedOptions);
  },

  getShieldPingsAfterTimestamp: async(driver, ts) => {
    return module.exports.pings.getTelemetryPings(driver, {
      type: ["shield-study", "shield-study-addon"],
      timestamp: ts,
    });
  },

  summarizePings: pings => {
    return pings.map(p => [p.payload.type, p.payload.data]);
  },

  pingsReport: async pings => {
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

    return { report };
  },

  searchTelemetry: (conditionArray, telemetryArray) => {
    const resultingPings = [];
    for (const condition of conditionArray) {
      const index = telemetryArray.findIndex(ping => condition(ping));
      if (index === -1) {
        throw new module.exports.pings.SearchError(condition);
      }
      resultingPings.push(telemetryArray[index]);
    }
    return resultingPings;
  },

  SearchError: class extends Error {
    constructor(condition) {
      const message = `Could not find ping satisfying condition: ${condition.toString()}`;
      super(message);
      this.message = message;
      this.name = "SearchError";
    }
  },
};
