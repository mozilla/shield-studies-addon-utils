/* eslint-env node, mocha */
/* global browser */

const KEEPOPEN = process.env.KEEPOPEN;

const assert = require("assert");
const utils = require("./utils");

// const MINUTES_PER_DAY = 60 * 24;

// node's util, for printing a deeply nested object to node console
const { inspect } = require("util");

// eslint-disable-next-line no-unused-vars
function full(myObject) {
  return inspect(myObject, { showHidden: false, depth: null });
}

// eslint-disable-next-line no-unused-vars
const delay = ms => new Promise(res => setTimeout(res, ms));

function publicApiTests(studyType) {
  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(30000 + KEEPOPEN * 1000 * 2);

  let driver;
  let addonId;

  // run in the extension page
  let addonExec;

  async function createAddonExec() {
    driver = await utils.setupWebdriver.promiseSetupDriver(
      utils.FIREFOX_PREFERENCES,
    );

    // TODO: Possibly configure Normandy here - replaces study utils setup phase

    await installAddon();
    await utils.ui.openBrowserConsole(driver);

    // make a shorter alias
    addonExec = utils.executeJs.executeAsyncScriptInExtensionPageForTests.bind(
      utils.executeJs,
      driver,
    );
  }

  async function installAddon() {
    // beginTime = Date.now();
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
      assert.equal(
        caughtError,
        "Error: An async exception thrown for test purposes",
      );
    });
  });

  describe.skip("getDataPermissions", function() {
    it("returns correct and current list of permissions", async () => {
      const dataPermissions = await addonExec(async cb => {
        // this is what runs in the webExtension scope.
        const $dataPermissions = await browser.study.getDataPermissions();
        // call back with all the data we care about to Mocha / node
        cb($dataPermissions);
      });
      console.debug(full(dataPermissions));

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

  describe("telemetry tests", function() {
    describe("sendTelemetry, calculateTelemetryPingSize", function() {
      let calculatedPingSize;

      before(async function reinstallSetupDoTelemetryAndWait() {
        await installAddon();
        const _ = await addonExec(async (_studyType, callback) => {
          await browser.studyDebug.resetSeenTelemetry();
          await browser.studyDebug.recordSeenTelemetry();
          const samplePing = { foo: "bar" };
          await browser.study.sendTelemetry(samplePing, _studyType);
          const _calculatedPingSize = await browser.study.calculateTelemetryPingSize(
            samplePing,
            _studyType,
          );
          callback({
            calculatedPingSize: _calculatedPingSize,
          });
        }, studyType);
        calculatedPingSize = _.calculatedPingSize;
        await delay(1000); // wait a second to telemetry to settle on disk.
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
            const seenTelemetry = await browser.studyDebug.getSeenTelemetry();
            callback({
              sent: _studyPings,
              seen: seenTelemetry.seenTelemetry.reverse(),
            }); // Using reverse() to mimic the default sorting of telemetry archive results
          });
          // For debugging tests
          // console.debug("Pings report: ", utils.telemetry.pingsReport(studyPings.seen));
          // console.debug("Pings with id and payload: ", utils.telemetry.pingsDebug(studyPings.seen));
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
          ];
          assert.deepStrictEqual(
            observed,
            expected,
            "telemetry pings as as expected",
          );
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
      assert.deepStrictEqual(answers, expected);
    });
  });

  describe("api: fullSurveyUrl", function() {
    describe("correctly constructs urls queryArgs", function() {
      it("an example url is correct", async function() {
        const actual = await addonExec(async callback => {
          const result = await browser.study.fullSurveyUrl(
            "https://foo.com/survey-foo/",
            "mid-study-survey",
          );
          callback(result);
        });
        const matchesExpectedExceptForVariableArguments =
          actual.indexOf(
            "https://foo.com/survey-foo/?shield=3&study=test%3Abrowser.study.api",
          ) > -1 &&
          actual.indexOf(
            "&testing=1&reason=mid-study-survey&fullreason=mid-study-survey",
          ) > -1;
        assert(matchesExpectedExceptForVariableArguments);
      });
    });
  });
}

describe("PUBLIC API `browser.study` (studyType: shield)", function() {
  publicApiTests.call(this, "shield");
});

describe("PUBLIC API `browser.study` (studyType: pioneer)", function() {
  publicApiTests.call(this, "pioneer");
});
