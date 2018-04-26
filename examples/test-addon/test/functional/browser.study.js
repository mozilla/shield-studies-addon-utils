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

  it("should be able to access studyTest WebExtensions API from the extension page for tests", async() => {
    const hasAccessToShieldUtilsWebExtensionApi = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
      driver,
      async callback => {
        callback(browser && typeof browser.studyTest === "object");
      },
    );
    assert(hasAccessToShieldUtilsWebExtensionApi);
  });

  it("should be able to catch exceptions thrown in the WebExtension", async() => {
    const caughtError = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
      driver,
      async callback => {
        let _caughtError = null;

        try {
          throw new Error("Local exception");
        } catch (e) {
          // console.log("Caught error", e);
          _caughtError = e.toString();
        }

        callback(_caughtError);
      },
    );
    assert(caughtError === "Error: Local exception");
  });

  /*
  TODO: Figure out why if/how/when we can catch this type of exception (currently it stops test execution completely)
  it("should be able to catch exceptions thrown in the WebExtensions API", async() => {
    const caughtError = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
      driver,
      async callback => {
        let _caughtError = null;

        try {
          browser.studyTest.throwAnException("An exception thrown for test purposes");
          callback(false);
        } catch (e) {
          // console.log("Caught error", e);
          _caughtError = e.toString();
          callback(_caughtError);
        }

      },
    );
    assert(caughtError === "Error: An exception thrown for test purposes");
  });
  */

  it("should be able to catch exceptions thrown in an async WebExtensions API method", async() => {
    const caughtError = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
      driver,
      async callback => {
        let _caughtError = null;

        try {
          await browser.studyTest.throwAnExceptionAsync(
            "An async exception thrown for test purposes",
          );
          callback(false);
        } catch (e) {
          // console.log("Caught error", e);
          _caughtError = e.toString();
          callback(_caughtError);
        }
      },
    );
    assert(
      caughtError === "Error: An async exception thrown for test purposes",
    );
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

  it("should not be able to send telemetry before setup", async() => {
    const caughtError = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
      driver,
      async callback => {
        let _caughtError = null;
        try {
          await browser.study.sendTelemetry({ foo: "bar" });
          callback(false);
        } catch (e) {
          // console.log("Caught error", e);
          _caughtError = e.toString();
          callback(_caughtError);
        }
        callback(_caughtError);
      },
    );
    assert(
      caughtError ===
        "Error: telemetry: this method can't be used until `setup` is called",
    );
  });

  describe("test the browser.study.setup() side effects", function() {
    it("should fire the onReady event upon successful setup", async() => {
      const isFirstRun = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
        driver,
        async(_studySetupForTests, callback) => {
          // Ensure we have a configured study and are supposed to run our feature
          browser.study.onReady.addListener(async(studyInfo, _isFirstRun) => {
            callback(_isFirstRun);
          });
          browser.study.setup(_studySetupForTests);
        },
        studySetupForTests(),
      );
      assert(isFirstRun);
    });

    it("should have set the experiment to active in Telemetry", async() => {
      await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
        driver,
        async callback => {
          callback();
        },
      );
      const activeExperiments = await utils.telemetry.getActiveExperiments(
        driver,
      );
      const studySetup = studySetupForTests();
      assert(activeExperiments.hasOwnProperty(studySetup.activeExperimentName));
    });

    it("shield-study-addon telemetry should be working", async() => {
      const shieldTelemetryPing = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
        driver,
        async callback => {
          // Send custom telemetry
          await browser.study.sendTelemetry({ foo: "bar" });
          const studyPings = await browser.study.searchSentTelemetry({
            type: ["shield-study-addon"],
          });
          callback(studyPings[0]);
        },
      );
      assert(shieldTelemetryPing.payload.data.attributes.foo === "bar");
    });

    describe("should have sent the expected telemetry", function() {
      let studyPings;

      before(async() => {
        studyPings = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
          driver,
          async callback => {
            const _studyPings = await browser.study.searchSentTelemetry({
              type: ["shield-study", "shield-study-addon"],
            });
            callback(_studyPings);
          },
        );
        // For debugging tests
        // console.log("Pings report: ", utils.telemetry.pingsReport(studyPings));
      });

      it("should have sent at least one shield telemetry ping", async() => {
        assert(studyPings.length > 0, "at least one shield telemetry ping");
      });

      it("should have sent one shield-study telemetry ping with study_state=enter", async() => {
        const filteredPings = utils.telemetry.filterPings(
          [
            ping =>
              ping.type === "shield-study" &&
              ping.payload.data.study_state === "enter",
          ],
          studyPings,
        );
        assert(
          filteredPings.length > 0,
          "at least one shield-study telemetry ping with study_state=enter",
        );
      });

      /*
      it("should have sent one shield-study telemetry ping with study_state=installed", async() => {
        const filteredPings = utils.telemetry.filterPings(
          [
            ping =>
              ping.type === "shield-study" &&
              ping.payload.data.study_state === "installed",
          ],
          studyPings,
        );
        assert(
          filteredPings.length > 0,
          "at least one shield-study telemetry ping with study_state=installed",
        );
      });
      */

      it("should have sent one shield-study-addon telemetry ping with payload.data.attributes.foo=bar", async() => {
        const filteredPings = utils.telemetry.filterPings(
          [
            ping =>
              ping.type === "shield-study-addon" &&
              ping.payload.data.attributes.foo === "bar",
          ],
          studyPings,
        );
        assert(
          filteredPings.length > 0,
          "at least one shield-study-addon telemetry ping with payload.data.attributes.foo=bar",
        );
      });
    });

    describe("test the browser.study.endStudy() side effects", function() {
      before(async() => {
        await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
          driver,
          async callback => {
            // TODO add tests for other reasons (?)
            await browser.study.endStudy("expired", {
              baseUrls: ["some.url"],
              endingName: "anEnding",
              endingClass: "ended-positive",
            });
            callback();
          },
        );
      });

      it("should have set the experiment as inactive", async() => {
        const activeExperiments = await utils.telemetry.getActiveExperiments(
          driver,
        );
        assert(!activeExperiments.hasOwnProperty("shield-utils-test"));
      });

      describe("should have sent the expected exit telemetry", function() {
        let studyPings;

        before(async() => {
          studyPings = await utils.telemetry.searchSentTelemetry(driver, {
            type: ["shield-study", "shield-study-addon"],
          });
          // For debugging tests
          // console.log("Final pings report: ", utils.telemetry.pingsReport(studyPings));
        });

        it("one shield-study telemetry ping with study_state=exit", async() => {
          const filteredPings = utils.telemetry.filterPings(
            [
              ping =>
                ping.type === "shield-study" &&
                ping.payload.data.study_state === "exit",
            ],
            studyPings,
          );
          assert(
            filteredPings.length > 0,
            "at least one shield-study telemetry ping with study_state=exit",
          );
        });

        it("one shield-study telemetry ping with study_state=expired", async() => {
          const filteredPings = utils.telemetry.filterPings(
            [
              ping =>
                ping.type === "shield-study" &&
                ping.payload.data.study_state === "expired",
            ],
            studyPings,
          );
          assert(
            filteredPings.length > 0,
            "at least one shield-study telemetry ping with study_state=expired",
          );
        });
      });
    });
  });
});
