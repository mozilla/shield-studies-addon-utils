/* eslint-env node, mocha */
/* global browser */

const KEEPOPEN = process.env.KEEPOPEN;
/** Complete list of tests for testing
 *
 * - the public api for `browser.study` not specific to any add-on background logic
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

function publicApiTests(studyType) {
  /** return a studySetup, shallow merged from overrides
   *
   * @return {object} mergedStudySetup
   */
  function studySetupForTests(...overrides) {
    // Minimal configuration to pass schema validation
    const studySetup = {
      activeExperimentName: `shield-utils-test-addon@${studyType}.mozilla.org`,
      studyType,
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
        send: false,
        removeTestingFlag: false,
        internalTelemetryArchive: true,
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

  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(30000 + KEEPOPEN * 1000 * 2);

  let driver;
  let beginTime;
  let addonId;

  // run in the extension page
  let addonExec;

  async function createAddonExec() {
    driver = await utils.setupWebdriver.promiseSetupDriver(
      utils.FIREFOX_PREFERENCES,
    );
    await installAddon();
    await utils.ui.openBrowserConsole(driver);

    // make a shorter alias
    addonExec = utils.executeJs.executeAsyncScriptInExtensionPageForTests.bind(
      utils.executeJs,
      driver,
    );
  }

  async function installAddon() {
    beginTime = Date.now();
    if (addonId) {
      await utils.setupWebdriver.uninstallAddon(driver, addonId);
      addonId = null;
    }
    if (studyType === "pioneer") {
      await utils.setupWebdriver.installPioneerOptInAddon(driver);
    }
    addonId = await utils.setupWebdriver.installAddon(driver);
  }

  before(createAddonExec);

  // hint: skipping driver.quit() may be useful when debugging failed tests,
  // leaving the browser open allowing inspection of the ui and browser logs
  after(async () => {
    if (KEEPOPEN) {
      await driver.sleep(KEEPOPEN * 1000); // wait for KEEPOPEN seconds
    }
    driver.quit();
  });

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

  describe("getDataPermissions", function() {
    it("returns correct and current list of permissions", async () => {
      const thisSetup = studySetupForTests();
      const dataPermissions = await addonExec(async (setup, cb) => {
        // this is what runs in the webExtension scope.
        const $dataPermissions = await browser.study.getDataPermissions();
        // call back with all the data we care about to Mocha / node
        cb($dataPermissions);
      }, thisSetup);
      // console.debug(full(dataPermissions));

      // tests
      assert(dataPermissions.shield, "shield should be enabled");
      if (studyType === "pioneer") {
        assert(
          dataPermissions.pioneer,
          "user should have opted in for pioneer",
        );
      } else {
        assert(
          !dataPermissions.pioneer,
          "user should not have opted in for pioneer",
        );
      }
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
      const seenTelemetryStates = internals.seenTelemetry
        .filter(ping => ping.payload.type === "shield-study")
        .map(ping => ping.payload.data.study_state);
      assert(internals.isSetup, "should be isSetup");
      assert(!internals.isEnded, "should not be ended");
      assert(!internals.isEnding, "should not be ending");
      assert(info.isFirstRun, "should be isFirstRun");
      assert(info.variation, "should be a variation");
      assert.strictEqual(info.variation.name, "control", "should be 'control'");

      assert.notStrictEqual(
        info.firstRunTimestamp,
        null,
        "firstRunTimestamp should not be null since the study should be running",
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
      const seenTelemetryStates = internals.seenTelemetry
        .filter(ping => ping.payload.type === "shield-study")
        .map(ping => ping.payload.data.study_state);

      assert(internals.isSetup, "should be isSetup");
      assert(!internals.isEnded, "should not be ended");
      assert(!internals.isEnding, "should not be ending");
      assert(!info.isFirstRun, "should NOT be isFirstRun");
      assert(info.variation, "should be a variation");
      assert.strictEqual(info.variation.name, "control", "should be 'control'");

      assert.notStrictEqual(
        info.firstRunTimestamp,
        null,
        "firstRunTimestamp should not be null since the study should be running",
      );
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
      const seenTelemetryStates = internals.seenTelemetry
        .filter(ping => ping.payload.type === "shield-study")
        .map(ping => ping.payload.data.study_state);

      assert(internals.isSetup, "should be isSetup");
      assert(internals.isEnded, "should be ended");
      assert(internals.isEnding, "should be ending");
      assert(info.isFirstRun, "should be isFirstRun");
      assert(info.variation, "should be a variation");
      assert.strictEqual(info.variation.name, "control", "should be 'control'");

      assert.strictEqual(
        info.firstRunTimestamp,
        null,
        "firstRunTimestamp should be null (the study was never run)",
      );
      assert.strictEqual(
        info.delayInMinutes,
        null,
        "delayInMinutes should be null (the study was never run)",
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

    it("6a. testing.firstRunTimestamp override can be set to an integer", async function() {
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

    it("6b. testing.firstRunTimestamp override can be set to 0", async function() {
      // console.debug("doing test 6");
      const thisSetup = studySetupForTests({
        testing: {
          firstRunTimestamp: 0,
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
        0,
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
      let studyInfo, calculatedPingSize;
      const overrides = {
        activeExperimentName: "test:browser.study.api",
        telemetry: {
          send: true,
          removeTestingFlag: false,
          internalTelemetryArchive: true,
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

      before(async function reinstallSetupDoTelemetryAndWait() {
        await installAddon();
        const _ = await addonExec(async (_studySetupForTests, callback) => {
          // Ensure we have a configured study and are supposed to run our feature
          browser.study.onReady.addListener(async _studyInfo => {
            const samplePing = { foo: "bar" };
            await browser.study.sendTelemetry(samplePing);
            const _calculatedPingSize = await browser.study.calculateTelemetryPingSize(
              samplePing,
            );
            callback({
              studyInfo: _studyInfo,
              calculatedPingSize: _calculatedPingSize,
            });
          });
          await browser.study.setup(_studySetupForTests);
        }, studySetupForTests(overrides));
        studyInfo = _.studyInfo;
        calculatedPingSize = _.calculatedPingSize;
        await delay(1000); // wait a second to telemetry to settle on disk.
      });

      it("should fire the onReady event upon successful setup", async () => {
        // console.debug(studyInfo);
        assert.strictEqual(
          studyInfo.activeExperimentName,
          overrides.activeExperimentName,
        );
      });

      it("calculated ping size is as expected", async () => {
        const expectedPingSizes = {
          shield: 20,
          pioneer: 662,
        };
        assert.strictEqual(calculatedPingSize, expectedPingSizes[studyType]);
      });

      describe("telemetry archive / controller effects", function() {
        let studyPings;
        before(async () => {
          studyPings = await addonExec(async callback => {
            const _studyPings = await browser.study.searchSentTelemetry({
              type: [
                "shield-study",
                "shield-study-addon",
                "shield-study-error",
                "pioneer-study",
              ],
            });
            const internals = await browser.studyDebug.getInternals();
            callback({
              sent: _studyPings,
              seen: internals.seenTelemetry.reverse(),
            }); // Using reverse() to mimic the default sorting of telemetry archive results
          });
          // For debugging tests
          // console.debug("Pings report: ", utils.telemetry.pingsReport(studyPings.seen));
          // console.debug("Pings with id and payload: ", utils.telemetry.pingsDebug(studyPings.seen));
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

        it("should have sent at least one shield telemetry ping", async () => {
          assert(
            studyPings.sent.length > 0,
            "at least one shield telemetry ping",
          );
        });

        it("should have sent expected telemetry", async () => {
          const observed = utils.telemetry.summarizePings(
            studyType === "shield" ? studyPings.sent : studyPings.seen,
          );
          const expected = [
            [
              "shield-study-addon",
              {
                attributes: {
                  foo: "bar",
                },
              },
            ],
            [
              "shield-study",
              {
                study_state: "installed",
              },
            ],
            [
              "shield-study",
              {
                study_state: "enter",
              },
            ],
          ];
          assert.deepStrictEqual(
            expected,
            observed,
            "telemetry pings as as expected",
          );
        });
      });

      describe("browser.study.endStudy() side effects for first time called", function() {
        let endingResult, endingInternals;
        before(async () => {
          const _ = await addonExec(async callback => {
            browser.study.onEndStudy.addListener(async _endingResult => {
              const internals = await browser.studyDebug.getInternals();
              callback({
                endingResult: _endingResult,
                endingInternals: internals,
              });
            });
            await browser.study.endStudy("customEnding");
          });
          endingResult = _.endingResult;
          endingInternals = _.endingInternals;
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
            studyPings = {};
            studyPings.seen = endingInternals.seenTelemetry.reverse();
            studyPings.sent = await utils.telemetry.searchSentTelemetry(
              driver,
              {
                type: [
                  "shield-study",
                  "shield-study-addon",
                  "shield-study-error",
                  "pioneer-study",
                ],
                timestamp: beginTime,
              },
            );
            // For debugging tests
            // console.debug("Final pings report: ", utils.telemetry.pingsReport(studyPings.seen));
            // console.debug("Final pings with id and payload: ", utils.telemetry.pingsDebug(studyPings.seen));
          });

          it("should have sent at least one shield telemetry ping", async () => {
            assert(
              studyPings.sent.length > 0,
              "at least one shield telemetry ping",
            );
          });

          it("should have sent expected telemetry", async () => {
            const observed = utils.telemetry.summarizePings(
              studyType === "shield" ? studyPings.sent : studyPings.seen,
            );
            const expected = [
              [
                "shield-study",
                {
                  study_state: "exit",
                },
              ],
              [
                "shield-study",
                {
                  study_state: "ended-positive",
                  study_state_fullname: "customEnding",
                },
              ],
              [
                "shield-study-addon",
                {
                  attributes: {
                    foo: "bar",
                  },
                },
              ],
              [
                "shield-study",
                {
                  study_state: "installed",
                },
              ],
              [
                "shield-study",
                {
                  study_state: "enter",
                },
              ],
            ];
            assert.deepStrictEqual(
              expected,
              observed,
              "telemetry pings as as expected",
            );
          });
        });
      });
    });

    describe("setup of an ineligible study should result in endStudy('ineligible') without even emitting onReady", function() {
      let endingResult, endingInternals;
      const overrides = {
        activeExperimentName: "test:browser.study.api",
        telemetry: {
          send: true,
          removeTestingFlag: false,
          internalTelemetryArchive: true,
        },
        endings: {
          ineligible: {
            baseUrls: [],
          },
        },
        allowEnroll: false,
        testing: {},
      };

      before(async function reinstallSetupAndAwaitEndStudy() {
        await installAddon();
        const _ = await addonExec(async (_studySetupForTests, callback) => {
          // Ensure we have a configured study and are supposed to run our feature
          browser.study.onEndStudy.addListener(async _endingResult => {
            console.log(
              "In resetSetupAndAwaitEndStudy - onEndStudy listener",
              _endingResult,
            );
            const internals = await browser.studyDebug.getInternals();
            callback({
              endingResult: _endingResult,
              endingInternals: internals,
            });
          });
          browser.study.onReady.addListener(async _studyInfo => {
            console.log(
              "In resetSetupAndAwaitEndStudy - onReady listener",
              _studyInfo,
            );
            throw new Error("onReady should not have been emitted", _studyInfo);
          });
          await browser.study.setup(_studySetupForTests);
        }, studySetupForTests(overrides));
        endingResult = _.endingResult;
        endingInternals = _.endingInternals;
      });

      describe("browser.study.endStudy() side effects", function() {
        it("should have fired onEndStudy event with the endingResult", function() {
          // console.debug(full(endingResult));
          assert(endingResult);
          assert.strictEqual(endingResult.endingName, "ineligible");
          assert.strictEqual(endingResult.queryArgs.fullreason, "ineligible");
          assert(endingResult.shouldUninstall);
          assert.strictEqual(
            endingResult.urls.length,
            0,
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
            studyPings = {};
            studyPings.seen = endingInternals.seenTelemetry.reverse();
            studyPings.sent = await utils.telemetry.searchSentTelemetry(
              driver,
              {
                type: [
                  "shield-study",
                  "shield-study-addon",
                  "shield-study-error",
                  "pioneer-study",
                ],
                timestamp: beginTime,
              },
            );
            // For debugging tests
            // console.debug("Final pings report: ", utils.telemetry.pingsReport(studyPings.seen));
            // console.debug("Final pings with id and payload: ", utils.telemetry.pingsDebug(studyPings.seen));
          });

          it("should have sent at least one shield telemetry ping", async () => {
            assert(
              studyPings.sent.length > 0,
              "at least one shield telemetry ping",
            );
          });

          it("should have sent expected telemetry", async () => {
            const observed = utils.telemetry.summarizePings(
              studyType === "shield" ? studyPings.sent : studyPings.seen,
            );
            const expected = [
              [
                "shield-study",
                {
                  study_state: "exit",
                },
              ],
              [
                "shield-study",
                {
                  study_state: "ineligible",
                  study_state_fullname: "ineligible",
                },
              ],
              [
                "shield-study",
                {
                  study_state: "enter",
                },
              ],
            ];
            assert.deepStrictEqual(
              expected,
              observed,
              "telemetry pings as as expected",
            );
          });
        });
      });
    });

    describe("setup of an already expired study should result in endStudy('expired') without even emitting onReady", function() {
      let endingResult, endingInternals;
      const overrides = {
        activeExperimentName: "test:browser.study.api",
        telemetry: {
          send: true,
          removeTestingFlag: false,
          internalTelemetryArchive: true,
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

      before(async function reinstallSetupAndAwaitEndStudy() {
        await installAddon();
        const _ = await addonExec(async (_studySetupForTests, callback) => {
          // Ensure we have a configured study and are supposed to run our feature
          browser.study.onEndStudy.addListener(async _endingResult => {
            console.log(
              "In resetSetupAndAwaitEndStudy - onEndStudy listener",
              _endingResult,
            );
            const internals = await browser.studyDebug.getInternals();
            callback({
              endingResult: _endingResult,
              endingInternals: internals,
            });
          });
          browser.study.onReady.addListener(async _studyInfo => {
            console.log(
              "In resetSetupAndAwaitEndStudy - onReady listener",
              _studyInfo,
            );
            throw new Error("onReady should not have been emitted", _studyInfo);
          });
          await browser.study.setup(_studySetupForTests);
        }, studySetupForTests(overrides));
        endingResult = _.endingResult;
        endingInternals = _.endingInternals;
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
            studyPings = {};
            studyPings.seen = endingInternals.seenTelemetry.reverse();
            studyPings.sent = await utils.telemetry.searchSentTelemetry(
              driver,
              {
                type: [
                  "shield-study",
                  "shield-study-addon",
                  "shield-study-error",
                  "pioneer-study",
                ],
                timestamp: beginTime,
              },
            );
            // For debugging tests
            // console.debug("Final pings report: ", utils.telemetry.pingsReport(studyPings.seen));
            // console.debug("Final pings with id and payload: ", utils.telemetry.pingsDebug(studyPings.seen));
          });

          it("should have sent at least one shield telemetry ping", async () => {
            assert(
              studyPings.sent.length > 0,
              "at least one shield telemetry ping",
            );
          });

          it("should have sent expected telemetry", async () => {
            const observed = utils.telemetry.summarizePings(
              studyType === "shield" ? studyPings.sent : studyPings.seen,
            );
            const expected = [
              [
                "shield-study",
                {
                  study_state: "exit",
                },
              ],
              [
                "shield-study",
                {
                  study_state: "expired",
                  study_state_fullname: "expired",
                },
              ],
              [
                "shield-study",
                {
                  study_state: "enter",
                },
              ],
            ];
            assert.deepStrictEqual(
              expected,
              observed,
              "telemetry pings as as expected",
            );
          });
        });
      });
    });

    describe("setup of a study that expires within a few seconds should result in endStudy('expired') after a few seconds", function() {
      let endingResult, endingInternals;
      const overrides = {
        activeExperimentName: "test:browser.study.api",
        telemetry: {
          send: true,
          removeTestingFlag: false,
          internalTelemetryArchive: true,
        },
        expire: {
          days: 1,
        },
        endings: {
          expired: {
            baseUrls: [
              "https://qsurvey.mozilla.com/s3/Shield-Study-Example-Survey/?reason=expired",
            ],
          },
        },
        testing: {
          firstRunTimestamp: null, // needs to be set in the before-hook below in order to be executed just before the setup of the study
        },
      };

      before(async function reinstallSetupAndConfigureAlarm() {
        await installAddon();
        // Set the study to expire after a few seconds
        const now = Number(Date.now());
        const msInOneDay = 60 * 60 * 24 * 1000;
        overrides.testing.firstRunTimestamp = now - msInOneDay + 5000;
        // console.log("Expiration debug: now, firstRunTimestamp, new Date(), new Date(now), new Date(firstRunTimestamp)", now, overrides.testing.firstRunTimestamp, new Date(), new Date(now), new Date(overrides.testing.firstRunTimestamp));
        const _ = await addonExec(async (_studySetupForTests, callback) => {
          console.log(
            "In resetSetupAndConfigureAlarm - addonExec",
            _studySetupForTests,
          );
          // Ensure we have a configured study and are supposed to run our feature
          browser.study.onEndStudy.addListener(async _endingResult => {
            console.log(
              "In resetSetupAndConfigureAlarm - onEndStudy listener",
              _endingResult,
            );
            const internals = await browser.studyDebug.getInternals();
            callback({
              endingResult: _endingResult,
              endingInternals: internals,
            });
          });
          browser.study.onReady.addListener(async _studyInfo => {
            console.log(
              "In resetSetupAndConfigureAlarm - onReady listener",
              _studyInfo,
            );
            await browser.study.sendTelemetry({ foo: "bar" });
            const { delayInMinutes } = _studyInfo;
            if (delayInMinutes !== undefined) {
              const alarmName = `${browser.runtime.id}:studyExpiration`;
              const alarmListener = async alarm => {
                console.log(
                  "In resetSetupAndConfigureAlarm - alarmListener",
                  alarm,
                );
                if (alarm.name === alarmName) {
                  browser.alarms.onAlarm.removeListener(alarmListener);
                  await browser.study.endStudy("expired");
                }
              };
              console.log("Setting up alarm listener", alarmListener);
              browser.alarms.onAlarm.addListener(alarmListener);
              console.log("Creating alarm", alarmName, delayInMinutes);
              browser.alarms.create(alarmName, {
                delayInMinutes,
              });
            }
          });
          await browser.study.setup(_studySetupForTests);
        }, studySetupForTests(overrides));
        endingResult = _.endingResult;
        endingInternals = _.endingInternals;
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
            studyPings = {};
            studyPings.seen = endingInternals.seenTelemetry.reverse();
            studyPings.sent = await utils.telemetry.searchSentTelemetry(
              driver,
              {
                type: [
                  "shield-study",
                  "shield-study-addon",
                  "shield-study-error",
                  "pioneer-study",
                ],
                timestamp: beginTime,
              },
            );
            // For debugging tests
            // console.debug("Final pings report: ", utils.telemetry.pingsReport(studyPings.seen));
            // console.debug("Final pings with id and payload: ", utils.telemetry.pingsDebug(studyPings.seen));
          });

          it("should have sent at least one shield telemetry ping", async () => {
            assert(
              studyPings.sent.length > 0,
              "at least one shield telemetry ping",
            );
          });

          it("should have sent expected telemetry", async () => {
            const observed = utils.telemetry.summarizePings(
              studyType === "shield" ? studyPings.sent : studyPings.seen,
            );
            const expected = [
              [
                "shield-study",
                {
                  study_state: "exit",
                },
              ],
              [
                "shield-study",
                {
                  study_state: "expired",
                  study_state_fullname: "expired",
                },
              ],
              [
                "shield-study-addon",
                {
                  attributes: {
                    foo: "bar",
                  },
                },
              ],
            ];
            assert.deepStrictEqual(
              expected,
              observed,
              "telemetry pings as as expected",
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

  // TODO 5.2+
  describe.skip("possible 5.2+ future tests.", function() {
    describe("uninstall by users?", function() {});

    describe("surveyUrl", function() {
      describe("needs setup", function() {
        it("throws StudyNotSetupError  if not setup");
      });
      describe("correctly constructs urls queryArgs from profile info", function() {
        it("an example url is correct");
      });
    });
    describe.skip("log", function() {
      it("log level works?");
    });
  });
}

describe("PUBLIC API `browser.study` (studyType: shield)", function() {
  publicApiTests.call(this, "shield");
});

describe("PUBLIC API `browser.study` (studyType: pioneer)", function() {
  publicApiTests.call(this, "pioneer");
});
