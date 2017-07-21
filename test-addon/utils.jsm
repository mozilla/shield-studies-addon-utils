/* eslint no-unused-vars: "off" */

const { studyUtils } = Components.utils.import("resource://test-addon/StudyUtils.jsm", {});

var EXPORTED_SYMBOLS = ["fakeSetup"];

function fakeSetup() {
  studyUtils.setup({
    studyName: "shield-utils-test",
    endings: {},
    addon: {id: "1", version: "1"},
    telemetry: { send: true, removeTestingFlag: false },
  });
  studyUtils.setVariation({ name: "puppers", weight: "2" });
}
