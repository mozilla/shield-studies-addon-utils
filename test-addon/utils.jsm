/* eslint no-unused-vars: "off" */

const { studyUtils } = Components.utils.import("resource://test-addon/StudyUtils.jsm", {});
Components.utils.import("resource://gre/modules/TelemetryArchive.jsm");
Components.utils.import("resource://gre/modules/Console.jsm");

var EXPORTED_SYMBOLS = ["fakeSetup", "getMostRecentPingsByType"];

function fakeSetup() {
  studyUtils.setup({
    studyName: "shield-utils-test",
    endings: {},
    addon: {id: "1", version: "1"},
    telemetry: { send: true, removeTestingFlag: false },
  });
  studyUtils.setVariation({ name: "puppers", weight: "2" });
}

async function getMostRecentPingsByType(type) {
  const pings = await TelemetryArchive.promiseArchivedPingList();

  // get most recent ping per type
  const mostRecentPings = {};
  for (const ping of pings.filter((p) => p.type === type)) {
    if (ping.type in mostRecentPings) {
      if (mostRecentPings[ping.type].timestampCreated < ping.timestampCreated) {
        mostRecentPings[ping.type] = ping;
      }
    } else {
      mostRecentPings[ping.type] = ping;
    }
  }

  return TelemetryArchive.promiseArchivedPingById(mostRecentPings[type].id);
}
