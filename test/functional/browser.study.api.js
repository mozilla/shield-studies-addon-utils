/* eslint-env node, mocha */
/* global browser */

/** Complete list of tests for testing
 *
 * - the public api for `browser.study`
 */

/** About webdriver extension based tests
 *
 * (decribed in the one-time "before" function for each suite)
 * Webdriver
 * - `driver` created:  uses the fx profile, sets up connenction
 *    and translation to Marionette
 * - installs the `test-addon` extension
 * - waits for UI
 * - now can `await addonExec`, as short-named bound version of
 *   "executeAsyncScriptInExtensionPageForTests",
 *   which runs in exentension and promises values we can use in
 *   tests in this file.
 *
 *
 *  ## Creating a new test
 *
 *  1.  Goal, call back from the webExtension with the data you need to test
 *  2.  Do the test in the script using npm asset
 *
 *  ## Tips for `addonExec`
 *
 *  1. If something breaks / test fails, fx will stay open (`--bail`).
 *     Look in the BrowserConsole
 *  2. Callback with an object if you need a lot of return values
 *  3. Recall that `studyBackdoor` exists
 */

const assert = require("assert");
const utils = require("./utils");

const DAYS = 86400 * 1000;

// node's util
const { inspect } = require("util");
// for printing a deeply nested object to node console
// eslint-disable-next-line no-unused-vars
function full(myObject) {
  return inspect(myObject, { showHidden: false, depth: null });
}

// alternative shortcut
// TODO create new profile per test?
// then we can test with a clean profile every time

function merge(...sources) {
  return Object.assign({}, ...sources);
}

/** return a studySetup, shallow merged from sources
 *
 * @return {object} mergedStudySetup
 */
function studySetupForTests(...sources) {
  // Minimal configuration to pass schema validation
  const studySetup = {
    activeExperimentName: "shield-utils-test-addon@shield.mozilla.org",
    studyType: "shield",
    endings: {
      ineligible: {
        baseUrls: ["http://www.example.com/?reason=ineligible"],
      },
      BrowserStudyApiEnding: {
        baseUrls: ["http://www.example.com/?reason=BrowserStudyApiEnding"],
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
  };

  // Set dynamic study configuration flags
  studySetup.allowEnroll = true;

  return merge(studySetup, ...sources);
}

describe("PUBLIC API `browser.study` (not specific to any add-on background logic)", function() {
  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(15000);

  let driver;
  // run in the extension page
  let addonExec;

  before(async() => {
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

  describe("internals,studyInfo under several browser.setup() scenarios", function() {
    async function resetStudy() {
      console.debug("resetting");
      const reset = await addonExec(async function(cb) {
        await browser.studyTest.reset();
        const internals = await browser.studyTest.getInternals();
        return cb(internals);
      });
      assert(reset.isSetup === false);
      console.debug("reset done");
      return reset;
    }
    beforeEach(resetStudy);
    // afterEach(resetStudy);

    it("1.  firstRun, expire.days, allowEnroll, !testing.expired", async function() {
      const thisSetup = studySetupForTests();
      const data = await addonExec(async(setup, cb) => {
        // this is what runs in the webExtension scope.
        const info = await browser.study.setup(setup);
        const internals = await browser.studyTest.getInternals();
        // call back with all the data we care about to Mocha / node
        cb({ info, internals });
      }, thisSetup);
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
      assert(now - info.firstRunTimestamp < 5000, "less than 5 seconds old");
      assert(info.timeUntilExpire < 14 * DAYS, "should expire within 14 days");
      assert.deepStrictEqual(
        seenTelemetryStates,
        ["enter", "installed"],
        "incorrect study state telemetry",
      );
    });

    it("2.  secondRun, expire.days, allowEnroll, !testing.expired", async function() {
      const now = Number(Date.now());
      const thisSetup = studySetupForTests({});
      const data = await addonExec(
        async(setup, nowTs, cb) => {
          // this is what runs in the webExtension scope.
          await browser.studyTest.setFirstRunTimestamp(nowTs);
          const info = await browser.study.setup(setup);
          const internals = await browser.studyTest.getInternals();
          // call back with all the data we care about to Mocha / node
          cb({ info, internals });
        },
        thisSetup,
        now,
      );
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
      assert.equal(
        info.firstRunTimestamp,
        now,
        "firstRunTimestamp should be what we set",
      );
      assert(now - info.firstRunTimestamp < 5000, "less than 5 seconds old");
      assert(info.timeUntilExpire < 14 * DAYS, "should expire within 14 days");
      assert.deepStrictEqual(
        seenTelemetryStates,
        [],
        "incorrect study state telemetry",
      );
    });

    it("3.  firstRun, expire.days, !allowEnroll, !testing.expired should end ineligible", async function() {
      console.log("doing test 3");
      const now = Number(Date.now());
      const thisSetup = studySetupForTests({
        allowEnroll: false,
      });
      const data = await addonExec(async(setup, cb) => {
        // this is what runs in the webExtension scope.
        const info = await browser.study.setup(setup);
        const internals = await browser.studyTest.getInternals();
        // call back with all the data we care about to Mocha / node
        cb({ info, internals });
      }, thisSetup);
      const { info, internals } = data;
      console.log(full(data));
      // tests
      const seenTelemetryStates = internals.seenTelemetry["shield-study"].map(
        x => x.data.study_state,
      );

      assert(internals.isSetup, "should be isSetup");
      assert(internals.isEnded, "should be ended");
      assert(internals.isEnding, "should be ending");
      assert(info.isFirstRun, "should NOT be isFirstRun");
      assert(info.variation, "should be a variation");
      assert(now - info.firstRunTimestamp < 5000, "less than 5 seconds old");
      assert(info.timeUntilExpire < 14 * DAYS, "should expire within 14 days");
      assert.deepStrictEqual(
        seenTelemetryStates,
        ["enter", "ineligible", "exit"],
        "incorrect study state telemetry",
      );
    });
  });

  describe.skip("test the browser.study.setup() side effects", function() {
    it("should fire the onReady event upon successful setup", async() => {
      const studyInfo = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
        driver,
        async(_studySetupForTests, callback) => {
          // Ensure we have a configured study and are supposed to run our feature
          browser.study.onReady.addListener(async _studyInfo => {
            callback(_studyInfo);
          });
          browser.study.setup(_studySetupForTests);
        },
        studySetupForTests(),
      );
      assert(studyInfo);
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

  describe("studySetup, overlaps a lot with getStudyInfo", function() {
    describe("isFirstRun:", function() {
      it("sets pref is none given");
      it("if pref is given, sets pref to that?");
    });
    describe("variation:", function() {
      it("if none given, chooses from weightedVariations");
      it(
        "if variation name isn't in weightedVariations, throw (basically, is it aliases or not?)",
      );
    });
    describe("everyRun (see above)", function() {
      it("all the every run tests");
    });
  });
  describe("endStudy", function() {
    describe("needs setup", function() {
      it("throws StudyNotsSetupError  if not setup");
    });
    describe("first time called", function() {
      it("returns an endingInstructions");
      it("fires an onEndStudy with those instructions");
      it("removes all listeners?");
      it(
        "unsets firstRun pref?  // this might be a bad idea, will break getStudyinfo ",
      );
      it("(see more above)");
    });
    describe("second time", function() {
      it("no op, study is shut down.");
      it("no signal fired");
    });
  });
  describe("getStudyInfo", function() {
    describe("needs setup", function() {
      it("throws StudyNotsSetupError  if not setup");
    });
    describe("correctness", function() {
      // helper functions
      function assertValidStudyInfo(studyInfo) {
        const schema = utils.studySchema[0].types.filter(
          x => x.id === "studyInfoObject",
        )[0];
        console.log(schema);
        // const v = utils.validateJSON(studyInfo, schema);
        // assert(v.isValid, JSON.stringify(v.errors), null, 2);
      }

      // tests
      it("during first run, isFirstRun is true", function() {});
      it("during second run, isFirstRun is false", function() {});
      it("if duration.days in studySetup(), have a timeUntilExpire in studyInfo", async function() {
        const data = await addonExec(async callback => {
          // await browser.study.studySetup();
          callback(await browser.study.getStudyInfo());
        });
        console.log("DATA", data);
        assert(data.timeUntilExpire, "missing timeUntilExpire");
        assertValidStudyInfo(data);
      });
    });
    describe("afterEnding", function() {
      it("cannot call after endStudy, because study is shutdown");
    });
    describe("first run of addon / second run of addon", function() {
      it("during firstRun, return isFirstRun key is true");
      it("during second run, return isFirstRun key is false");
    });
    describe("correctness", function() {
      it("has correct keys and complete list of values");
    });
  });
  describe("getDataPermissions", function() {
    it("returns correct and current list of permissions");
  });
  describe("sendTelemetry", function() {
    describe("needs setup", function() {
      it("throws StudyNotsSetupError  if not setup");
    });
  });
  describe("searchSentTelemetry (light testing)", function() {
    it("attempt a search, get some results");
  });
  describe("surveyUrl", function() {
    describe("needs setup", function() {
      it("throws StudyNotsSetupError  if not setup");
    });
    describe("correctly constructs urls queryArgs from profile info", function() {
      it("an example url is correct");
    });
  });
  describe("validateJSON", function() {
    it("validates json.  demonstrate");
  });
  describe("log  (maybe not tested)", function() {
    it("log level works?");
  });
});
