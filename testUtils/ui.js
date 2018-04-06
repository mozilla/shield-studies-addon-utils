/* eslint-env node */

const webdriver = require("selenium-webdriver");
const firefox = require("selenium-webdriver/firefox");
const Fs = require("fs-extra");
const path = require("path");
const By = webdriver.By;
const Context = firefox.Context;
const until = webdriver.until;

/* Firefox UI testing helper functions */
module.exports.ui = {
  promiseManifest: async() => {
    const manifestJson = await Fs.readFile(
      path.resolve("src/manifest.json"),
      "utf8",
    );
    return JSON.parse(manifestJson);
  },

  /**
   * The widget id is used to identify add-on specific chrome elements. Examples:
   *  - Browser action - {addonWidgetId}-browser-action
   *  - Page action - {addonWidgetId}-page-action
   * Search for makeWidgetId(extension.id) in the Firefox source code for more examples.
   * @returns {Promise<*>}
   */
  addonWidgetId: async() => {
    /**
     * From firefox/browser/components/extensions/ExtensionPopups.jsm
     */
    function makeWidgetId(id) {
      id = id.toLowerCase();
      // FIXME: This allows for collisions.
      return id.replace(/[^a-z0-9_-]/g, "_");
    }

    const manifest = await module.exports.ui.promiseManifest();
    return makeWidgetId(manifest.applications.gecko.id);
  },

  takeScreenshot: async(driver, filepath = "./screenshot.png") => {
    try {
      const data = await driver.takeScreenshot();
      return await Fs.outputFile(filepath, data, "base64");
    } catch (screenshotError) {
      throw screenshotError;
    }
  },

  MODIFIER_KEY: (function getModifierKey() {
    const modifierKey =
      process.platform === "darwin"
        ? webdriver.Key.COMMAND
        : webdriver.Key.CONTROL;
    return modifierKey;
  })(),

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
  addButtonFromCustomizePanel: async(driver, buttonId) =>
    driver.executeAsyncScript(callback => {
      // see https://dxr.mozilla.org/mozilla-central/rev/211d4dd61025c0a40caea7a54c9066e051bdde8c/browser/base/content/browser-social.js#193
      Components.utils.import("resource:///modules/CustomizableUI.jsm");
      CustomizableUI.addWidgetToArea(buttonId, CustomizableUI.AREA_NAVBAR);
      callback();
    }),

  removeButtonFromNavbar: async(driver, buttonId) => {
    driver.setContext(Context.CONTENT);
    try {
      await driver.executeAsyncScript(callback => {
        Components.utils.import("resource:///modules/CustomizableUI.jsm");
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
