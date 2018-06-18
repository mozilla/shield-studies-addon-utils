/* eslint-env node */

/** Execute privileged javascript in firefox */

const firefox = require("selenium-webdriver/firefox");
const Context = firefox.Context;

const { ui } = require("./ui");
const utils = { ui };

/**
 * The tests rely on the add-on's background script opening up
 * an extension page in a new window/tab.
 *
 * In background.js, make it possible for your tests to execute
 * the following at some point:
 *
 *   const createData = {
 *     type: "detached_panel",
 *     url: "extension-page-for-tests/index.html",
 *     width: 500,
 *     height: 500,
 *   };
 *   browser.windows.create(createData);
 *
 * Extension pages get access to all the same privileged
 * WebExtension APIs as the background scripts, allowing us
 * to run tests directly against those APIs.
 *
 * This variable sets the expected path of this extension page so
 * that we can check if we are in the right context to run tests.
 *
 * TODO: Find a cleaner way to accomplish this
 * @type {string}
 */
const extensionPagePath = "/extension-page-for-tests/index.html";

module.exports.executeJs = {
  /**
   * Executes JavaScript with access to all the same privileged
   * WebExtension APIs as the background scripts, allowing us
   * to run tests directly against those APIs.
   *
   * @param {object} driver webDriver instance
   * @param {function} callable asyncScript to run in fx `driver.executeAsyncScript`
   * @param {function} passedArgument If defined, pass to callable
   * @returns {Promise<*>} result of callable(passedArgument)
   */
  executeAsyncScriptInExtensionPageForTests: async (
    driver,
    callable,
    ...passedArguments
  ) => {
    driver.setContext(Context.CONTENT);

    const checkIfCurrentlyInExtensionPageWindow = async () => {
      const currentUrl = await driver.getCurrentUrl();
      return currentUrl.indexOf(extensionPagePath) > 0;
    };

    const isCurrentlyInExtensionPageWindow = await checkIfCurrentlyInExtensionPageWindow();

    if (!isCurrentlyInExtensionPageWindow) {
      // Wait for the extension page window to be available
      // (we may still be loading firefox/the add-on)
      await utils.ui.waitForPopupToOpen(driver);

      // Switch to the extension page popup
      await utils.ui.switchToNextAvailableWindowHandle(driver);

      // Check that the tab has loaded the right page.
      // We use driver.wait to wait for the page to be loaded, since we
      // are not able to easily use the load listeners built into selenium.
      await driver.wait(
        checkIfCurrentlyInExtensionPageWindow,
        10000,
        "Should have loaded the extension page for tests",
      );
    }

    // Execute the JavaScript in the context of the extension page
    // console.debug(passedArguments, passedArguments.length);
    const returnValue =
      passedArguments.length > 0
        ? await driver.executeAsyncScript(callable, ...passedArguments)
        : await driver.executeAsyncScript(callable);

    // Switch back to the main window
    await utils.ui.switchToNextAvailableWindowHandle(driver);

    return returnValue;
  },
};
