/* eslint-env node, mocha */
/* global browser */

const KEEPOPEN = process.env.KEEPOPEN;
/** Complete list of tests for testing
 *
 * - the public api for `browser.study`
 */

/** About webdriver extension based tests
 *
 * `addonExec`:  Created in the one-time "before" function for each suite.
 *
 * Webdriver
 * - `driver` created:  uses the fx profile, sets up connenction
 *    and translation to Marionette
 * - installs the `test-addon` extension
 * - waits for UI as a signal that the extension page is ready.
 * - now can `await addonExec`, as short-named bound version of
 *   "executeAsyncScriptInExtensionPageForTests",
 *   which runs in the exentension page contenxt and promises values we
 *   can use in tests in this file (node / mocha context).
 *
 *  ## Creating a new test
 *
 *  1.  Goal, call back from the webExtension with the data you need to test
 *  2.  Do the test in the script using node's `assert`
 *
 *  ## Tips for `addonExec`
 *
 *  1. If something breaks / test fails, fx will stay open (`--bail`).
 *     Look in the BrowserConsole
 *  2. Callback with a complex object if you need a lot of return values
 *  3. Recall that `studyDebug` exists for doing resets, getting internals, etc
 */

// TODO create new profile per test?

const assert = require("assert");
const utils = require("./utils");

const MINUTES_PER_DAY = 60 * 24;

// node's util, for printing a deeply nested object to node console
const { inspect } = require("util");
// eslint-disable-next-line no-unused-vars
function full(myObject) {
  return inspect(myObject, { showHidden: false, depth: null });
}

// eslint-disable-next-line no-unused-vars
const delay = ms => new Promise(res => setTimeout(res, ms));

// simple merge all by top level keys, right-most wins
function merge(...sources) {
  return Object.assign({}, ...sources);
}

/** return a studySetup, shallow merged from overrides
 *
 * @return {object} mergedStudySetup
 */
function studySetupForTests(...overrides) {
  // Minimal configuration to pass schema validation
  const studySetup = {
    activeExperimentName: "shield-utils-test-addon@shield.mozilla.org",
    studyType: "shield",
    endings: {
      ineligible: {
        baseUrls: [
          "https://qsurvey.mozilla.com/s3/Shield-Study-Example-Survey/?reason=ineligible",
        ],
      },
      BrowserStudyApiEnding: {
        baseUrls: [
          "https://qsurvey.mozilla.com/s3/Shield-Study-Example-Survey/?reason=BrowserStudyApiEnding",
        ],
      },
    },
    telemetry: {
      send: false, // assumed false. Actually send pings if true
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
    // Dynamic study configuration flags
    allowEnroll: true,
    testing: {},
  };

  return merge(studySetup, ...overrides);
}

describe("PUBLIC API `browser.study` (not specific to any add-on background logic)", function() {
  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(15000);

  let driver;
  // run in the extension page
  let addonExec;

  before(async function createAddonExec() {
    driver = await utils.setupWebdriver.promiseSetupDriver(
      utils.FIREFOX_PREFERENCES,
    );
    await utils.setupWebdriver.installAddon(driver);
    await utils.ui.openBrowserConsole(driver);

    // make a shorter alias
    addonExec = utils.executeJs.executeAsyncScriptInExtensionPageForTests.bind(
      utils.executeJs,
      driver,
    );
  });

  // hint: skipping driver.quit() may be useful when debugging failed tests,
  // leaving the browser open allowing inspection of the ui and browser logs
  after(() => !KEEPOPEN && driver.quit());

  /* Reset a study */
  async function resetStudy() {
    // console.debug("resetting");
    const reset = await addonExec(async function(cb) {
      await browser.studyDebug.reset();
      const internals = await browser.studyDebug.getInternals();
      return cb(internals);
    });
    assert(reset.isSetup === false);
    // console.debug("reset done");
    return reset;
  }

  describe("testing infrastructure works", function() {
    it("should be able to access window.browser from the extension page for tests", async () => {
      const hasAccessToWebExtensionApi = await addonExec(async callback => {
        callback(typeof browser === "object");
      });
      assert(hasAccessToWebExtensionApi);
    });

    it("should be able to access study WebExtensions API from the extension page for tests", async () => {
      const hasAccessToShieldUtilsWebExtensionApi = await addonExec(
        async callback => {
          callback(browser && typeof browser.study === "object");
        },
      );
      assert(hasAccessToShieldUtilsWebExtensionApi);
    });

    it("should be able to access studyDebug WebExtensions API from the extension page for tests", async () => {
      const hasAccessToShieldUtilsWebExtensionApi = await addonExec(
        async callback => {
          callback(browser && typeof browser.studyDebug === "object");
        },
      );
      assert(hasAccessToShieldUtilsWebExtensionApi);
    });

    it("should be able to catch exceptions thrown in the WebExtension", async () => {
      const caughtError = await addonExec(async callback => {
        let _caughtError = null;

        try {
          throw new Error("Local exception");
        } catch (e) {
          // console.debug("Caught error", e);
          _caughtError = e.toString();
        }

        callback(_caughtError);
      });
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
            browser.studyDebug.throwAnException("An exception thrown for test purposes");
            callback(false);
          } catch (e) {
            // console.debug("Caught error", e);
            _caughtError = e.toString();
            callback(_caughtError);
          }

        },
      );
      assert(caughtError === "Error: An exception thrown for test purposes");
    });
    */

    it("should be able to catch exceptions thrown in an async WebExtensions API method", async () => {
      const caughtError = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
        driver,
        async callback => {
          let _caughtError = null;

          try {
            await browser.studyDebug.throwAnExceptionAsync(
              "An async exception thrown for test purposes",
            );
            callback(false);
          } catch (e) {
            // console.debug("Caught error", e);
            _caughtError = e.toString();
            callback(_caughtError);
          }
        },
      );
      assert(
        caughtError === "Error: An async exception thrown for test purposes",
      );
    });
  });

  describe("test the setup requirement", function() {
    it("should not be able to send telemetry before setup", async () => {
      const caughtError = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
        driver,
        async callback => {
          let _caughtError = null;
          try {
            await browser.study.sendTelemetry({ foo: "bar" });
            callback(false);
          } catch (e) {
            // console.debug("Caught error", e);
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

    it("most functions throw if not studyUtils is not setup", async function() {
      await resetStudy();
      const caughtErrors = await addonExec(async callback => {
        const _caughtErrors = [];
        try {
          await browser.study.endStudy("ineligible");
        } catch (e) {
          _caughtErrors.push(e.toString());
        }

        try {
          await browser.study.sendTelemetry({ a: "b" });
        } catch (e) {
          _caughtErrors.push(e.toString());
        }

        try {
          await browser.study.getStudyInfo();
        } catch (e) {
          _caughtErrors.push(e.toString());
        }

        callback(_caughtErrors);
      });
      const expected = [
        "Error: endStudy: this method can't be used until `setup` is called",
        "Error: telemetry: this method can't be used until `setup` is called",
        "Error: info: this method can't be used until `setup` is called",
      ];
      assert.deepStrictEqual(expected, caughtErrors);
    });
  });

  describe("internals,studyInfo under several browser.setup() scenarios", function() {
    beforeEach(resetStudy);
    // afterEach();

    it("1. firstRun, expire.days, allowEnroll, !testing.expired should: isFirstRun, should: pings enter,install", async function() {
      // console.debug("doing test 1");
      const thisSetup = studySetupForTests();
      const data = await addonExec(async (setup, cb) => {
        // this is what runs in the webExtension scope.
        const info = await browser.study.setup(setup);
        const internals = await browser.studyDebug.getInternals();
        // call back with all the data we care about to Mocha / node
        cb({ info, internals });
      }, thisSetup);
      // console.debug(full(data));
      const { info, internals } = data;

      // tests
      const now = Number(Date.now());
      const seenTelemetryStates = internals.seenTelemetry["shield-study"].map(
        x => x.data.study_state,
      );
      assert(internals.isSetup, "should be isSetup");
      assert(!internals.isEnded, "should not be ended");
      assert(!internals.isEnding, "should not be ending");
      assert(info.isFirstRun, "should be isFirstRun");
      assert(info.variation, "should be a variation");
      assert.strictEqual(info.variation.name, "control", "should be 'control'");

      assert(now - info.firstRunTimestamp < 5000, "less than 5 seconds old");
      assert(
        info.delayInMinutes > 13 * MINUTES_PER_DAY,
        "should not expire within 13 days",
      );
      assert(
        info.delayInMinutes < 15 * MINUTES_PER_DAY,
        "should expire within 15 days",
      );
      assert.deepStrictEqual(
        seenTelemetryStates,
        ["enter", "installed"],
        "should have seen correct study state telemetry",
      );
    });

    it("2. secondRun, expire.days, allowEnroll, !testing.expired should be !firstRun, should NOT have enter or install pings", async function() {
      // console.debug("doing test 2");
      const now = Number(Date.now());
      const thisSetup = studySetupForTests({});
      const data = await addonExec(
        async (setup, nowTs, cb) => {
          // this is what runs in the webExtension scope.
          await browser.studyDebug.setFirstRunTimestamp(nowTs);
          const info = await browser.study.setup(setup);
          const internals = await browser.studyDebug.getInternals();
          // call back with all the data we care about to Mocha / node
          cb({ info, internals });
        },
        thisSetup,
        now,
      );
      // console.debug(full(data));
      const { info, internals } = data;

      // tests
      const seenTelemetryStates = internals.seenTelemetry["shield-study"].map(
        x => x.data.study_state,
      );

      assert(internals.isSetup, "should be isSetup");
      assert(!internals.isEnded, "should not be ended");
      assert(!internals.isEnding, "should not be ending");
      assert(!info.isFirstRun, "should NOT be isFirstRun");
      assert(info.variation, "should be a variation");
      assert.strictEqual(info.variation.name, "control", "should be 'control'");

      assert.strictEqual(
        info.firstRunTimestamp,
        now,
        "firstRunTimestamp should be what we set",
      );
      assert(now - info.firstRunTimestamp < 5000, "less than 5 seconds old");
      assert(
        info.delayInMinutes > 13 * MINUTES_PER_DAY,
        "should not expire within 13 days",
      );
      assert(
        info.delayInMinutes < 15 * MINUTES_PER_DAY,
        "should expire within 15 days",
      );
      assert.deepStrictEqual(
        seenTelemetryStates,
        [],
        "should have seen any study state telemetry",
      );
    });

    it("3. firstRun, expire.days, !allowEnroll, !testing.expired should end ineligible, pings enter,ineligible,exit", async function() {
      // console.debug("doing test 3");
      const now = Number(Date.now());
      const thisSetup = studySetupForTests({
        allowEnroll: false,
      });
      const data = await addonExec(async (setup, cb) => {
        // this is what runs in the webExtension scope.
        const info = await browser.study.setup(setup);
        const internals = await browser.studyDebug.getInternals();
        // call back with all the data we care about to Mocha / node
        cb({ info, internals });
      }, thisSetup);
      // console.debug(full(data));
      const { info, internals } = data;

      // tests
      const seenTelemetryStates = internals.seenTelemetry["shield-study"].map(
        x => x.data.study_state,
      );

      assert(internals.isSetup, "should be isSetup");
      assert(internals.isEnded, "should be ended");
      assert(internals.isEnding, "should be ending");
      assert(info.isFirstRun, "should be isFirstRun");
      assert(info.variation, "should be a variation");
      assert.strictEqual(info.variation.name, "control", "should be 'control'");

      assert(now - info.firstRunTimestamp < 5000, "less than 5 seconds old");
      assert(
        info.delayInMinutes > 13 * MINUTES_PER_DAY,
        "should not expire within 13 days",
      );
      assert(
        info.delayInMinutes < 15 * MINUTES_PER_DAY,
        "should expire within 15 days",
      );
      assert.deepStrictEqual(
        seenTelemetryStates,
        ["enter", "ineligible", "exit"],
        "should have seen correct study state telemetry",
      );
    });

    it("4. testing.variationName chooses that branch", async function() {
      // console.debug("doing test 4");
      const thisSetup = studySetupForTests({
        testing: {
          variationName: "the-rare-one",
        },
        weightedVariations: [
          {
            name: "the-rare-one",
            weight: 1,
          },
          {
            name: "common",
            weight: 1000000,
          },
        ],
      });
      const data = await addonExec(async (setup, cb) => {
        // this is what runs in the webExtension scope.
        const info = await browser.study.setup(setup);
        const internals = await browser.studyDebug.getInternals();
        // call back with all the data we care about to Mocha / node
        cb({ info, internals });
      }, thisSetup);
      // console.debug(full(data));
      const { info } = data;
      assert.strictEqual(
        info.variation.name,
        "the-rare-one",
        "should be 'the-rare-one'",
      );
    });

    it("5. testing.variationName: if variation name isn't in weightedVariations, throw setup error", async function() {
      // console.debug("doing test 5");
      const thisSetup = studySetupForTests({
        testing: {
          variationName: "not-there",
        },
      });
      const error = await addonExec(async (setup, cb) => {
        // this is what runs in the webExtension scope.
        try {
          await browser.study.setup(setup);
        } catch (e) {
          cb(e.toString());
        }
        cb("This should be an error");
      }, thisSetup);
      // console.debug(full(error));
      assert.strictEqual(
        error,
        'Error: setup error: testing.variationName "not-there" not in [{"name":"control","weight":1}]',
        "should be an exception",
      );
    });

    it("6. testing.firstRunTimestamp override works as expected", async function() {
      // console.debug("doing test 6");
      const thisSetup = studySetupForTests({
        testing: {
          firstRunTimestamp: 123,
        },
      });
      const data = await addonExec(async (setup, cb) => {
        // this is what runs in the webExtension scope.
        const info = await browser.study.setup(setup);
        const internals = await browser.studyDebug.getInternals();
        // call back with all the data we care about to Mocha / node
        cb({ info, internals });
      }, thisSetup);
      // console.debug(full(data));
      const { info } = data;
      assert.strictEqual(
        info.firstRunTimestamp,
        123,
        "should be the same as our override",
      );
    });

    it("7. testing.expired override works as expected", async function() {
      // console.debug("doing test 7");
      const thisSetup = studySetupForTests({
        testing: {
          expired: true,
        },
      });
      const data = await addonExec(async (setup, cb) => {
        // this is what runs in the webExtension scope.
        const info = await browser.study.setup(setup);
        const internals = await browser.studyDebug.getInternals();
        // call back with all the data we care about to Mocha / node
        cb({ info, internals });
      }, thisSetup);
      // console.debug(full(data));
      const { info } = data;
      assert.strictEqual(info.delayInMinutes, 0, "should be zero");
    });
  });

  describe("life-cycle tests", function() {
    describe("setup, sendTelemetry, manually invoked endStudy", function() {
      let studyInfo;
      const overrides = {
        activeExperimentName: "test:browser.study.api",
        telemetry: {
          send: true,
          removeTestingFlag: false,
        },
        endings: {
          customEnding: {
            baseUrls: [
              "https://qsurvey.mozilla.com/s3/Shield-Study-Example-Survey/?reason=customEnding",
            ],
            category: "ended-positive",
          },
        },
      };

      before(async function resetSetupDoTelemetryAndWait() {
        await resetStudy();
        studyInfo = await addonExec(async (_studySetupForTests, callback) => {
          // Ensure we have a configured study and are supposed to run our feature
          browser.study.onReady.addListener(async _studyInfo => {
            await browser.study.sendTelemetry({ foo: "bar" });
            callback(_studyInfo);
          });
          await browser.study.setup(_studySetupForTests);
        }, studySetupForTests(overrides));
        await delay(1000); // wait a second to telemetry to settle on disk.
      });

      it("should fire the onReady event upon successful setup", async () => {
        // console.debug(studyInfo);
        assert.strictEqual(
          studyInfo.activeExperimentName,
          overrides.activeExperimentName,
        );
      });

      describe("telemetry archive / controller effects", function() {
        let studyPings;
        before(async () => {
          studyPings = await addonExec(async callback => {
            const _studyPings = await browser.study.searchSentTelemetry({
              type: ["shield-study", "shield-study-addon"],
            });
            callback(_studyPings);
          });
          // console.debug(full(studyPings.map(x => x.payload)));
          // For debugging tests
          // console.debug("Pings report: ", utils.telemetry.pingsReport(studyPings));
        });

        it("should have set the experiment to active in Telemetry", async () => {
          const activeExperiments = await utils.telemetry.getActiveExperiments(
            driver,
          );
          // console.debug(activeExperiments);
          assert(
            activeExperiments.hasOwnProperty(studyInfo.activeExperimentName),
          );
        });

        it("shield-study-addon telemetry should be working (as seen by telemetry)", async () => {
          const shieldTelemetryPings = await addonExec(async callback => {
            const _studyPings = await browser.study.searchSentTelemetry({
              type: ["shield-study-addon"],
            });
            callback(_studyPings.map(x => x.payload));
          });
          // console.debug("pings", full(shieldTelemetryPings));
          assert(shieldTelemetryPings[0].data.attributes.foo === "bar");
        });

        it("should have sent at least one shield telemetry ping", async () => {
          assert(studyPings.length > 0, "at least one shield telemetry ping");
        });

        it("should have sent one shield-study telemetry ping with study_state=enter", async () => {
          const filteredPings = studyPings.filter(
            ping =>
              ping.type === "shield-study" &&
              ping.payload.data.study_state === "enter",
          );
          assert(
            filteredPings.length > 0,
            "at least one shield-study telemetry ping with study_state=enter",
          );
        });

        it("should have sent one shield-study telemetry ping with study_state=installed", async () => {
          const filteredPings = studyPings.filter(
            ping =>
              ping.type === "shield-study" &&
              ping.payload.data.study_state === "installed",
          );
          assert(
            filteredPings.length > 0,
            "at least one shield-study telemetry ping with study_state=installed",
          );
        });

        it("should have sent one shield-study-addon telemetry ping with payload.data.attributes.foo=bar", async () => {
          const filteredPings = studyPings.filter(
            ping =>
              ping.type === "shield-study-addon" &&
              ping.payload.data.attributes.foo === "bar",
          );
          assert(
            filteredPings.length > 0,
            "at least one shield-study-addon telemetry ping with payload.data.attributes.foo=bar",
          );
        });
      });

      describe("browser.study.endStudy() side effects for first time called", function() {
        let endingResult;
        before(async () => {
          endingResult = await addonExec(async callback => {
            browser.study.onEndStudy.addListener(async _endingResult => {
              callback(_endingResult);
            });
            await browser.study.endStudy("customEnding");
          });
          // let telemetry and disk/files sync up
          await delay(1000);
        });
        it("should have fired onEndStudy event with the endingResult", function() {
          // console.debug(full(endingResult));
          assert(endingResult);
          assert.strictEqual(endingResult.endingName, "customEnding");
          assert.strictEqual(endingResult.queryArgs.fullreason, "customEnding");
          assert(endingResult.shouldUninstall);
          assert.strictEqual(endingResult.urls.length, 1);
        });

        it("should have set the experiment as inactive", async () => {
          const activeExperiments = await utils.telemetry.getActiveExperiments(
            driver,
          );
          assert(
            !activeExperiments.hasOwnProperty(studyInfo.activeExperimentName),
          );
        });

        it("should throw when calling endStudy multiple times", async function() {
          const caughtErrors = await addonExec(async callback => {
            const _caughtErrors = [];
            const reasons = ["ineligible", "expired", "user-disable"];
            for (const r of reasons) {
              try {
                await browser.study.endStudy(r);
              } catch (e) {
                // console.debug("Caught error", e);
                _caughtErrors.push(e.toString());
              }
            }
            callback(_caughtErrors);
          });
          const expected = [
            "Error: endStudy, requested:  ineligible, but already ending customEnding",
            "Error: endStudy, requested:  expired, but already ending customEnding",
            "Error: endStudy, requested:  user-disable, but already ending customEnding",
          ];
          assert.deepStrictEqual(expected, caughtErrors);
        });

        describe("should have sent the expected exit telemetry", function() {
          let studyPings;

          before(async () => {
            studyPings = await utils.telemetry.searchSentTelemetry(driver, {
              type: ["shield-study", "shield-study-addon"],
            });
            // For debugging tests
            // console.debug(full(studyPings.map(x => [x.type, x.payload])));
            // console.debug("Final pings report: ", utils.telemetry.pingsReport(studyPings));
          });

          it("one shield-study telemetry ping with study_state=exit", async () => {
            const filteredPings = studyPings.filter(
              ping =>
                ping.type === "shield-study" &&
                ping.payload.data.study_state === "exit",
            );
            assert(
              filteredPings.length > 0,
              "at least one shield-study telemetry ping with study_state=exit",
            );
          });

          it("one shield-study telemetry ping with study_state_fullname=customEnding", async () => {
            const filteredPings = studyPings.filter(
              ping =>
                ping.type === "shield-study" &&
                ping.payload.data.study_state === "ended-positive" &&
                ping.payload.data.study_state_fullname === "customEnding",
            );
            assert(
              filteredPings.length > 0,
              "at least one shield-study telemetry ping with study_state_fullname=customEnding",
            );
          });
        });
      });
    });

    describe("setup of an already expired study should result in endStudy('expired') without even emitting onReady", function() {
      let endingResult;
      const overrides = {
        activeExperimentName: "test:browser.study.api",
        telemetry: {
          send: true,
          removeTestingFlag: false,
        },
        endings: {
          expired: {
            baseUrls: [
              "https://qsurvey.mozilla.com/s3/Shield-Study-Example-Survey/?reason=expired",
            ],
          },
        },
        testing: {
          expired: true,
        },
      };

      before(async function resetSetupAndAwaitEndStudy() {
        await resetStudy();
        endingResult = await addonExec(
          async (_studySetupForTests, callback) => {
            // Ensure we have a configured study and are supposed to run our feature
            browser.study.onEndStudy.addListener(async _endingResult => {
              console.log("In onEndStudy listener", _endingResult);
              callback(_endingResult);
            });
            browser.study.onReady.addListener(async _studyInfo => {
              throw new Error(
                "onReady should not have been emitted",
                _studyInfo,
              );
            });
            await browser.study.setup(_studySetupForTests);
          },
          studySetupForTests(overrides),
        );
      });

      describe("browser.study.endStudy() side effects", function() {
        it("should have fired onEndStudy event with the endingResult", function() {
          // console.debug(full(endingResult));
          assert(endingResult);
          assert.strictEqual(endingResult.endingName, "expired");
          assert.strictEqual(endingResult.queryArgs.fullreason, "expired");
          assert(endingResult.shouldUninstall);
          assert.strictEqual(
            endingResult.urls.length,
            1,
            "the ending should have the expected number of urls configured",
          );
        });

        it("should have set the experiment as inactive", async () => {
          const activeExperiments = await utils.telemetry.getActiveExperiments(
            driver,
          );
          assert(
            !activeExperiments.hasOwnProperty(overrides.activeExperimentName),
          );
        });

        describe("should have sent the expected exit telemetry", function() {
          let studyPings;

          before(async () => {
            studyPings = await utils.telemetry.searchSentTelemetry(driver, {
              type: ["shield-study", "shield-study-addon"],
            });
            // For debugging tests
            // console.debug(full(studyPings.map(x => [x.type, x.payload])));
            // console.debug("Final pings report: ", utils.telemetry.pingsReport(studyPings));
          });

          it("one shield-study telemetry ping with study_state=exit", async () => {
            const filteredPings = studyPings.filter(
              ping =>
                ping.type === "shield-study" &&
                ping.payload.data.study_state === "exit",
            );
            assert(
              filteredPings.length > 0,
              "at least one shield-study telemetry ping with study_state=exit",
            );
          });

          it("one shield-study telemetry ping with study_state=expired", async () => {
            const filteredPings = studyPings.filter(
              ping =>
                ping.type === "shield-study" &&
                ping.payload.data.study_state === "expired",
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

  describe("api: validateJSON", function() {
    it("api: validateJSON should work as expected", async function() {
      const answers = await addonExec(async callback => {
        const validations = [];
        validations.push(
          await browser.study.validateJSON(
            { a: 1 },
            { type: "object", properties: { a: { type: "number" } } },
          ),
        );
        validations.push(
          await browser.study.validateJSON(
            { a: 1 },
            { type: "object", properties: { a: { type: "string" } } },
          ),
        );
        callback(validations);
      });
      const expected = [
        { errors: [], valid: true },
        {
          errors: [
            {
              dataPath: ".a",
              keyword: "type",
              message: "should be string",
              params: { type: "string" },
              schemaPath: "#/properties/a/type",
            },
          ],
          valid: false,
        },
      ];
      assert.deepStrictEqual(expected, answers);
    });
  });

  describe("endStudy", function() {
    it("see the browser.study.endStudy() side effects above", () =>
      assert(true));
  });

  describe("getStudyInfo", function() {
    describe("correctness: see browser.study.setup() tests", function() {
      // tests
      it("during first run, isFirstRun is true", function() {});
      it("during second run, isFirstRun is false", function() {});
      it("if duration.days in studySetup(), have a delayInMinutes in studyInfo", async function() {});
    });
  });

  describe("searchSentTelemetry (light testing)", function() {
    it("searches get results, see the endStudy() and other test", function() {});
  });

  describe("uninstall by users?", function() {});

  // TODO 5.1
  describe.skip("possible 5.1 future tests.", function() {
    describe("getDataPermissions", function() {
      it("returns correct and current list of permissions");
    });

    describe("surveyUrl", function() {
      describe("needs setup", function() {
        it("throws StudyNotsSetupError  if not setup");
      });
      describe("correctly constructs urls queryArgs from profile info", function() {
        it("an example url is correct");
      });
    });
    describe.skip("log", function() {
      it("log level works?");
    });
  });
});
