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

describe("Tests verifying that the test add-on works as expected", function() {
  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(15000 + KEEPOPEN * 1000 * 3);

  let driver;

  before(async () => {
    driver = await utils.setupWebdriver.promiseSetupDriver(
      utils.FIREFOX_PREFERENCES,
    );
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

  describe('test the test add-on\'s "onEveryExtensionLoad" process', function() {
    /**
     * Before running the tests in this group, trigger onEveryExtensionLoad and wait for the study to be running
     */
    before(async () => {
      await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
        driver,
        async callback => {
          // Let the test add-on know it is time to load the background logic
          await browser.runtime
            .sendMessage("test:onEveryExtensionLoad")
            .catch(console.error);

          // Wait for the feature to be enabled before continuing with the test assertions
          browser.runtime.onMessage.addListener(request => {
            console.log("test:onFeatureEnabled listener - request:", request);
            if (request === "test:onFeatureEnabled") {
              callback();
            }
          });
        },
      );
    });

    describe.skip("test the library's endStudy() function", function() {
      // before(async() => {
      //   await utils.executeJs.executeAsyncScriptInExtensionPageForTests(
      //     driver,
      //     async callback => {
      //       // TODO add tests for other reasons (?)
      //       await browser.study.endStudy("expired", {
      //         baseUrls: ["some.url"],
      //         endingName: "anEnding",
      //         endingClass: "ended-positive",
      //       });
      //       callback();
      //     },
      //   );
      // });
      // TODO: glind - restore these tests
      /*
      describe("test the opening of an URL at the end of the study", function() {
        it("should open a new tab", async() => {
          const newTabOpened = await driver.wait(async() => {
            const handles = await driver.getAllWindowHandles();
            return handles.length === 2; // opened a new tab
          }, 3000);
          assert(newTabOpened);
        });

        it("should open a new tab to the correct URL", async() => {
          const currentHandle = await driver.getWindowHandle();
          const firefox = require("selenium-webdriver/firefox");
          const Context = firefox.Context;
          driver.setContext(Context.CONTENT);
          // Find the new window handle.
          let newWindowHandle = null;
          const handles = await driver.getAllWindowHandles();
          for (const handle of handles) {
            if (handle !== currentHandle) {
              newWindowHandle = handle;
            }
          }
          const correctURLOpened = await driver.wait(async() => {
            await driver.switchTo().window(newWindowHandle);
            const currentURL = await driver.getCurrentUrl();
            return currentURL.startsWith(
              "http://www.example.com/?reason=expired",
            );
          });
          assert(correctURLOpened);
        });
      });
      */
    });
  });
});
