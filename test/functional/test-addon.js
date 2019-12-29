/* eslint-env node, mocha */
/* global browser */

const KEEPOPEN = process.env.KEEPOPEN;
/** Tests for
 *
 * - selenium/webdriver
 * - test-addon works as a platform
 *
 */

const assert = require("assert");
const utils = require("./utils");

const testAddonTests = function(studyType) {
  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(15000 + KEEPOPEN * 1000 * 3);

  let driver;

  before(async () => {
    driver = await utils.setupWebdriver.promiseSetupDriver(
      utils.FIREFOX_PREFERENCES,
    );
    if (studyType === "pioneer") {
      await utils.setupWebdriver.installPioneerOptInAddon(driver);
    }
    await utils.setupWebdriver.installAddon(driver);
    await utils.ui.openBrowserConsole(driver);
  });

  // hint: skipping driver.quit() may be useful when debugging failed tests,
  // leaving the browser open allowing inspection of the ui and browser logs
  after(async () => {
    if (KEEPOPEN) {
      await driver.sleep(KEEPOPEN * 1000); // wait for KEEPOPEN seconds
    }
    driver.quit();
  });

  it("should be able to access window.browser from the extension page for tests", async () => {
    const hasAccessToWebExtensionApi = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
      driver,
      async callback => {
        callback(typeof browser === "object");
      },
    );
    assert(hasAccessToWebExtensionApi);
  });

  it("should be able to access study WebExtensions API from the extension page for tests", async () => {
    const hasAccessToShieldUtilsWebExtensionApi = await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
      driver,
      async callback => {
        callback(browser && typeof browser.study === "object");
      },
    );
    assert(hasAccessToShieldUtilsWebExtensionApi);
  });
};

describe("Tests verifying that the test add-on loads (studyType: shield)", function() {
  testAddonTests.bind(this)("shield");
});

describe("Tests verifying that the test add-on loads (studyType: pioneer)", function() {
  testAddonTests.bind(this)("pioneer");
});
