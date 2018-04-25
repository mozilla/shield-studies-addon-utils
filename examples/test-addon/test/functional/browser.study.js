/* eslint-env node, mocha */
/* global browser */

const assert = require("assert");
const utils = require("./utils");

// TODO create new profile per test?
// then we can test with a clean profile every time

function studySetupForTests() {
  // Minimal configuration to pass schema validation
  const studySetup = {
    activeExperimentName: "shield-utils-test-addon@shield.mozilla.org",
    studyType: "shield",
    endings: {
      ineligible: {
        baseUrl: "http://www.example.com/?reason=ineligible",
      },
    },
    telemetry: {
      send: true, // assumed false. Actually send pings?
      removeTestingFlag: false, // Marks pings to be discarded, set true for to have the pings processed in the pipeline
    },
    logLevel: 10,
    weightedVariations: [
      {
        name: "control",
        weight: 1,
      },
    ],
    expire: {
      days: 14,
    },
  };

  // Set dynamic study configuration flags
  studySetup.allowEnroll = true;

  return studySetup;
}

describe("Tests for the browser.study.* API (not specific to any add-on background logic)", function() {
  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(15000);

  let driver;

  before(async() => {
    driver = await utils.setup.promiseSetupDriver(utils.FIREFOX_PREFERENCES);
    await utils.setup.installAddon(driver);
    await utils.ui.openBrowserConsole(driver);
  });

  // hint: skipping driver.quit() may be useful when debugging failed tests,
  // leaving the browser open allowing inspection of the ui and browser logs
  after(() => driver.quit());

  it("should be able to access window.browser from the extension page for tests", async() => {
    const hasAccessToWebExtensionApi = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
      driver,
      async callback => {
        callback(typeof browser === "object");
      },
    );
    assert(hasAccessToWebExtensionApi);
  });

  it("should be able to access study WebExtensions API from the extension page for tests", async() => {
    const hasAccessToShieldUtilsWebExtensionApi = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
      driver,
      async callback => {
        callback(browser && typeof browser.study === "object");
      },
    );
    assert(hasAccessToShieldUtilsWebExtensionApi);
  });

  it("should return the correct variation based on specific weightedVariations", async() => {
    const chosenVariation = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
      driver,
      async callback => {
        const weightedVariations = [
          {
            name: "control",
            weight: 1,
          },
          {
            name: "kittens",
            weight: 1.5,
          },
          {
            name: "puppers",
            weight: 2,
          },
        ];

        const fraction = 0.3;
        const variation = await browser.study.deterministicVariation(
          weightedVariations,
          "shield",
          fraction,
        );

        callback(variation);
      },
    );
    assert(chosenVariation);
    assert(chosenVariation.name === "kittens");
  });

  it("telemetry should be working", async() => {
    const shieldTelemetryPing = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
      driver,
      async(_studySetupForTests, callback) => {
        // Ensure we have configured study and are supposed to run our feature
        await browser.study.setup(_studySetupForTests);

        // Send custom telemetry
        await browser.study.sendTelemetry({ foo: "bar" });

        const studyPings = await browser.study.searchSentTelemetry({
          type: ["shield-study-addon"],
        });
        callback(studyPings[0]);
      },
      studySetupForTests(),
    );
    assert(shieldTelemetryPing.payload.data.attributes.foo === "bar");
  });

  describe('test the library\'s "startup" process', function() {
    it("should send the correct ping on first seen", async() => {
      const firstSeenPing = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
        driver,
        async(_studySetupForTests, callback) => {
          // Ensure we have configured study and are supposed to run our feature
          await browser.study.setup(_studySetupForTests);

          browser.studyTest.firstSeen();

          const studyPings = await browser.study.searchSentTelemetry({
            type: ["shield-study"],
          });
          callback(studyPings[0]);
        },
        studySetupForTests(),
      );
      assert(firstSeenPing.payload.data.study_state === "enter");
    });

    it("should set the experiment to active in Telemetry", async() => {
      await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
        driver,
        async(_studySetupForTests, callback) => {
          // Ensure we have configured study and are supposed to run our feature
          await browser.study.setup(_studySetupForTests);

          browser.studyTest.setActive();

          callback();
        },
        studySetupForTests(),
      );
      const activeExperiments = await utils.telemetry.getActiveExperiments(
        driver,
      );
      const studySetup = studySetupForTests();
      assert(activeExperiments.hasOwnProperty(studySetup.activeExperimentName));
    });

    it("should send the correct telemetry ping on first install", async() => {
      const installedPing = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
        driver,
        async(_studySetupForTests, callback) => {
          // Ensure we have configured study and are supposed to run our feature
          await browser.study.setup(_studySetupForTests);

          await browser.studyTest.startup({ reason: 5 }); // ADDON_INSTALL = 5

          const studyPings = await browser.study.searchSentTelemetry({
            type: ["shield-study"],
          });
          callback(studyPings[0]);
        },
        studySetupForTests(),
      );
      assert(installedPing.payload.data.study_state === "installed");
    });
  });

  describe("test the library's endStudy() function", function() {
    before(async() => {
      await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
        driver,
        async(_studySetupForTests, callback) => {
          // Ensure we have configured study and are supposed to run our feature
          await browser.study.setup(_studySetupForTests);

          // TODO add tests for other reasons (?)
          await browser.study.endStudy("expired", {
            baseUrls: ["some.url"],
            endingName: "anEnding",
            endingClass: "ended-positive",
          });
          callback();
        },
        studySetupForTests(),
      );
    });

    it("should set the experiment as inactive", async() => {
      const activeExperiments = await utils.telemetry.getActiveExperiments(
        driver,
      );
      assert(!activeExperiments.hasOwnProperty("shield-utils-test"));
    });

    it("should send the correct exit telemetry", async() => {
      const studyPings = await utils.telemetry.getMostRecentPingsByType(
        driver,
        "shield-study",
      );

      assert(studyPings.length >= 2);

      // The two exit pings are sent immediately after one another and it's
      // original sending order is not reflected by the return of
      // TelemetryArchive.promiseArchivedPingList
      // Thus, we can only test that the last two pings are the correct ones
      // but not that their order is correct

      const theMostRecentPing = studyPings[0];
      const thePingBeforeTheMostRecentPing = studyPings[1];

      assert(theMostRecentPing);
      assert(thePingBeforeTheMostRecentPing);

      assert(
        theMostRecentPing.payload.data.study_state === "exit" ||
          theMostRecentPing.payload.data.study_state === "expired",
      );
      assert(
        thePingBeforeTheMostRecentPing.payload.data.study_state === "exit" ||
          thePingBeforeTheMostRecentPing.payload.data.study_state === "expired",
      );

      if (theMostRecentPing.payload.data.study_state === "exit") {
        assert(
          thePingBeforeTheMostRecentPing.payload.data.study_state === "expired",
        );
      }

      if (thePingBeforeTheMostRecentPing.payload.data.study_state === "exit") {
        assert(theMostRecentPing.payload.data.study_state === "expired");
      }
    });
  });
});
