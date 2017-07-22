/* eslint-env node, mocha */

const assert = require("assert");
const utils = require("./utils");
// const firefox = require("selenium-webdriver/firefox");

// const Context = firefox.Context;

// TODO create new profile per test?
// then we can test with a clean profile every time

describe("Shield Study Utils Functional Tests", function() {
  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(15000);

  let driver;

  before(async() => {
    driver = await utils.promiseSetupDriver();
    // install the addon (note: returns addon id)
    await utils.installAddon(driver);
  });

  after(() => driver.quit());

  it("should return the correct variation", async() => {
    const variation = await driver.executeAsyncScript(async(callback) => {
      const { studyUtils } = Components.utils.import("resource://test-addon/StudyUtils.jsm", {});
      // TODO move this to a Config.jsm file
      const studyConfig = {
        studyName: "shieldStudyUtilsTest",
        "weightedVariations": [
          {"name": "control",
            "weight": 1},
          {"name": "kittens",
            "weight": 1.5},
          {"name": "puppers",
            "weight": 2},  // we want more puppers in our sample
        ],
      };

      const sample = studyUtils.sample;
      const hashFraction = await sample.hashFraction("test");
      const chosenVariation = await sample.chooseWeighted(studyConfig.weightedVariations, hashFraction);
      callback(chosenVariation);
    });
    assert(variation.name === "puppers");
  });

  it("telemetry should be working", async() => {
    const shieldTelemetryPing = await driver.executeAsyncScript(async(callback) => {
      const { fakeSetup, getMostRecentPingsByType } = Components.utils.import("resource://test-addon/utils.jsm", {});
      const { studyUtils } = Components.utils.import("resource://test-addon/StudyUtils.jsm", {});
      Components.utils.import("resource://gre/modules/TelemetryArchive.jsm");

      fakeSetup();

      await studyUtils.telemetry({ "foo": "bar" });

      // TODO Fix this hackiness; caused by addClientId option in submitExternalPing
      // The ping seems to be sending (appears in about:telemetry) but does not appear
      // in the pings array
      await new Promise(resolve => setTimeout(resolve, 1000));

      callback(await getMostRecentPingsByType("shield-study-addon"));
    });
    assert(shieldTelemetryPing.payload.data.attributes.foo === "bar");
  });

  describe("test the library's \"startup\" process", function() {
    it("should send the correct ping on first seen", async() => {
      const firstSeenPing = await driver.executeAsyncScript(async(callback) => {
        const { fakeSetup, getMostRecentPingsByType } = Components.utils.import("resource://test-addon/utils.jsm", {});
        const { studyUtils } = Components.utils.import("resource://test-addon/StudyUtils.jsm", {});
        Components.utils.import("resource://gre/modules/TelemetryArchive.jsm");

        fakeSetup();

        studyUtils.firstSeen();

        callback(await getMostRecentPingsByType("shield-study"));
      });
      assert(firstSeenPing.payload.data.study_state === "enter");
    });

    it("should set the experient to active in Telemetry", async() => {
      const activeExperiments = await driver.executeAsyncScript(async(callback) => {
        const { fakeSetup } = Components.utils.import("resource://test-addon/utils.jsm", {});
        const { studyUtils } = Components.utils.import("resource://test-addon/StudyUtils.jsm", {});
        Components.utils.import("resource://gre/modules/TelemetryEnvironment.jsm");

        fakeSetup();

        studyUtils.setActive();

        callback(TelemetryEnvironment.getActiveExperiments());
      });
      assert(activeExperiments.hasOwnProperty("shield-utils-test"));
    });

    it("should send the correct telemetry ping on first install", async() => {
      const installedPing = await driver.executeAsyncScript(async(callback) => {
        const { fakeSetup, getMostRecentPingsByType } = Components.utils.import("resource://test-addon/utils.jsm", {});
        const { studyUtils } = Components.utils.import("resource://test-addon/StudyUtils.jsm", {});
        Components.utils.import("resource://gre/modules/TelemetryArchive.jsm");

        fakeSetup();

        await studyUtils.startup({reason: 5}); // ADDON_INSTALL = 5

        callback(await getMostRecentPingsByType("shield-study"));
      });
      assert(installedPing.payload.data.study_state === "installed");
    });
  });
});
