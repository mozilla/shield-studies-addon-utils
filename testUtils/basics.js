/* eslint-env node */

const firefox = require("selenium-webdriver/firefox");
const Context = firefox.Context;

/**
 * The tests rely on the add-on's background script opening up
 * an extension page in a new window/tab.
 *
 * Extension pages get access to all the same privileged
 * WebExtension APIs as the background scripts, allowing us
 * to run tests directly against those APIs.
 *
 * This sets the expected path of this extension page so that
 * we can check if we are in the right context to run tests.
 *
 * TODO: Find a cleaner way to accomplish this
 * @type {string}
 */
const extensionPagePath = "/extension-page-for-tests/index.html";

module.exports.executeAsyncScriptInExtensionPageForTests = async(driver,
                                                                 callable,) => {

  driver.setContext(Context.CONTENT);

  const checkIfCurrentlyInExtensionPageWindow = async() => {
    let currentUrl = await driver.getCurrentUrl();
    return currentUrl.indexOf(extensionPagePath) > 0;
  };

  const isCurrentlyInExtensionPageWindow = await checkIfCurrentlyInExtensionPageWindow();

  // We may still be loading firefox / the add-on
  // wait for the extension page window to be available
  if (!isCurrentlyInExtensionPageWindow) {

    await driver.wait(
      async function() {
        const handles = await driver.getAllWindowHandles();
        return handles.length === 2;
      },
      9000,
      "Should have opened a popup",
    );

    const handles = await driver.getAllWindowHandles();
    const currentHandle = await driver.getWindowHandle();

    // Find the new window handle.
    let newWindowHandle = null;
    for (const handle of handles) {
      if (handle !== currentHandle) {
        newWindowHandle = handle;
      }
    }

    // Switch to the extension page popup
    await driver.switchTo().window(newWindowHandle);

    // Check the tab has loaded the right page.
    // We use driver.wait to wait for the page to be loaded, since we
    // are not able to easily use the load listeners built into selenium.
    await driver.wait(
      checkIfCurrentlyInExtensionPageWindow,
      10000,
      "Should have loaded the extension page for tests",
    );

  }

  return await driver.executeAsyncScript(callable);
};
