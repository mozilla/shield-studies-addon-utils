/* eslint-env node */

/** Functions and helpers to create/get UI elements in Firefox
 *
 */

const webdriver = require("selenium-webdriver");
const firefox = require("selenium-webdriver/firefox");
const Fs = require("fs-extra");
const path = require("path");
const Context = firefox.Context;
const By = webdriver.By;
const until = webdriver.until;
const Key = webdriver.Key;

const modifierKey =
  process.platform === "darwin" ? webdriver.Key.COMMAND : webdriver.Key.CONTROL;

/* Firefox UI testing helper functions */
module.exports.ui = {
  promiseManifest: async () => {
    const manifestJson = await Fs.readFile(
      path.resolve("src/manifest.json"),
      "utf8",
    );
    return JSON.parse(manifestJson);
  },

  /**
   * From firefox/browser/components/extensions/ExtensionPopups.jsm
   *
   * @param {string} id Id to modify
   * @returns {string} widgetId canonical widget id with replaced bits.
   */
  makeWidgetId: id => {
    id = id.toLowerCase();
    // FIXME: This allows for collisions.
    return id.replace(/[^a-z0-9_-]/g, "_");
  },

  /**
   * The widget id is used to identify add-on specific chrome elements. Examples:
   *  - Browser action - {addonWidgetId}-browser-action
   *  - Page action - {addonWidgetId}-page-action
   * Search for makeWidgetId(extension.id) in the Firefox source code for more examples.
   * @returns {Promise<string>} name of the made widget
   */
  addonWidgetId: async () => {
    const manifest = await module.exports.ui.promiseManifest();
    return module.exports.ui.makeWidgetId(manifest.applications.gecko.id);
  },

  openBrowserConsole: async driver => {
    driver.setContext(Context.CHROME);
    const urlBar = await module.exports.ui.promiseUrlBar(driver);
    const openBrowserConsoleKeys = Key.chord(
      module.exports.ui.MODIFIER_KEY,
      Key.SHIFT,
      "j",
    );
    await urlBar.sendKeys(openBrowserConsoleKeys);
  },

  waitForPopupToOpen: async driver => {
    await driver.wait(
      async function() {
        const handles = await driver.getAllWindowHandles();
        return handles.length === 2;
      },
      9000,
      "Should have opened a popup",
    );
  },

  switchToNextAvailableWindowHandle: async driver => {
    const handles = await driver.getAllWindowHandles();

    try {
      const currentHandle = await driver.getWindowHandle();

      // Find the new window handle.
      let newWindowHandle = null;
      for (const handle of handles) {
        if (handle !== currentHandle) {
          newWindowHandle = handle;
        }
      }

      // Switch to the next available window handle
      await driver.switchTo().window(newWindowHandle);
    } catch (e) {
      // This happens when the current window is closed
      // The driver will not automatically switch it's window handle to the
      // next available, thus driver.getWindowHandle() will throw a NoSuchWindowError
      if (e.name === "NoSuchWindowError") {
        // Switch to first available
        await driver.switchTo().window(handles[0]);
      } else {
        throw e;
      }
    }
  },

  takeScreenshot: async (driver, filepath = "./screenshot.png") => {
    try {
      const data = await driver.takeScreenshot();
      return await Fs.outputFile(filepath, data, "base64");
    } catch (screenshotError) {
      throw screenshotError;
    }
  },

  MODIFIER_KEY: modifierKey,

  // TODO glind, this interface feels janky
  // this feels like it wants to be $ like.
  // not obvious right now, moving on!
  getChromeElementBy: class {
    static async _get1(driver, method, selector) {
      driver.setContext(Context.CHROME);
      try {
        return await driver.wait(
          until.elementLocated(By[method](selector)),
          1000,
        );
      } catch (e) {
        // if there an error, the button was not found
        console.error(e);
        return null;
      }
    }

    static async id(driver, id) {
      return this._get1(driver, "id", id);
    }

    static async className(driver, className) {
      return this._get1(driver, "className", className);
    }

    static async tagName(driver, tagName) {
      return this._get1(driver, "tagName", tagName);
    }
  },

  promiseUrlBar: driver => {
    driver.setContext(Context.CHROME);
    return driver.wait(until.elementLocated(By.id("urlbar")), 1000);
  },

  // such as:  "social-share-button"
  addButtonFromCustomizePanel: async (driver, buttonId) =>
    driver.executeAsyncScript(callback => {
      // see https://dxr.mozilla.org/mozilla-central/rev/211d4dd61025c0a40caea7a54c9066e051bdde8c/browser/base/content/browser-social.js#193
      ChromeUtils.import("resource:///modules/CustomizableUI.jsm");
      CustomizableUI.addWidgetToArea(buttonId, CustomizableUI.AREA_NAVBAR);
      callback();
    }),

  removeButtonFromNavbar: async (driver, buttonId) => {
    driver.setContext(Context.CONTENT);
    try {
      await driver.executeAsyncScript(callback => {
        ChromeUtils.import("resource:///modules/CustomizableUI.jsm");
        CustomizableUI.removeWidgetFromArea(buttonId);
        callback();
      });

      // TODO glind fix this, I think this is supposed to prove it's dead.
      const button = await this.promiseAddonButton(driver);
      return button === null;
    } catch (e) {
      if (e.name === "TimeoutError") {
        return false;
      }
      throw e;
    }
  },
};
