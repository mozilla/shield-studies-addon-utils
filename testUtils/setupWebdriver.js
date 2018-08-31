/* eslint-env node */

/** Create usefully configured Firefox webdriver instance.
 *
 *
 * Enviroment variables used:
 * - FIREFOX_BINARY:firefox
 *   (can use alias or path)
 * - ADDON_ZIP  (relative to script)
 *
 */

const cmd = require("selenium-webdriver/lib/command");
const firefox = require("selenium-webdriver/firefox");
const webdriver = require("selenium-webdriver");
const FxRunnerUtils = require("fx-runner/lib/utils");
const Fs = require("fs-extra");
const path = require("path");
const Context = firefox.Context;

// useful if we need to test on a specific version of Firefox
async function promiseActualBinary(binary) {
  try {
    let normalizedBinary = await FxRunnerUtils.normalizeBinary(binary);
    normalizedBinary = path.resolve(normalizedBinary);
    await Fs.stat(normalizedBinary);
    return normalizedBinary;
  } catch (ex) {
    if (ex.code === "ENOENT") {
      throw new Error(`Could not find ${binary}`);
    }
    throw ex;
  }
}

module.exports.setupWebdriver = {
  /**
   * Uses process.env.FIREFOX_BINARY
   *
   * @param {object} FIREFOX_PREFERENCES key-value of prefname value.
   * @returns {Promise<*>} driver A configured Firefox webdriver object
   */
  promiseSetupDriver: async FIREFOX_PREFERENCES => {
    const profile = new firefox.Profile();

    // TODO, allow 'actually send telemetry' here.
    Object.keys(FIREFOX_PREFERENCES).forEach(key => {
      profile.setPreference(key, FIREFOX_PREFERENCES[key]);
    });

    // TODO glind, allow config to re-use profile
    const options = new firefox.Options();
    options.setProfile(profile);

    const builder = new webdriver.Builder()
      .forBrowser("firefox")
      .setFirefoxOptions(options);

    // Use standalone geckodriver server, launched by `npm-run-all -p test:func:*`
    if (process.env.GECKODRIVER_URL) {
      builder.usingServer(process.env.GECKODRIVER_URL);
    }

    const binaryLocation = await promiseActualBinary(
      process.env.FIREFOX_BINARY || "firefox",
    );
    await options.setBinary(new firefox.Binary(binaryLocation));
    const driver = await builder.build();
    // Firefox will be started up by now
    driver.setContext(Context.CHROME);
    return driver;
  },

  /** Install add-on from (guessed or explicit) path
   *
   * ADDON_ZIP
   *
   * @param {object} driver Configured Firefox webdriver
   * @param {string} fileLocation location for add-on xpi/zip
   * @returns {Promise<void>} returns add-on id)
   */
  installAddon: async (driver, fileLocation) => {
    // references:
    //    https://bugzilla.mozilla.org/show_bug.cgi?id=1298025
    //    https://github.com/mozilla/geckodriver/releases/tag/v0.17.0
    fileLocation =
      fileLocation || path.join(process.cwd(), process.env.ADDON_ZIP);

    const executor = driver.getExecutor();
    executor.defineCommand(
      "installAddon",
      "POST",
      "/session/:sessionId/moz/addon/install",
    );
    const installCmd = new cmd.Command("installAddon");

    const session = await driver.getSession();
    installCmd.setParameters({
      sessionId: session.getId(),
      path: fileLocation,
      temporary: true,
    });
    const addonId = await executor.execute(installCmd);
    console.log(
      `Add-on at ${fileLocation} installed with (addonId: ${addonId})`,
    );
    return addonId;
  },

  /** Install pioneer opt-in add-on from where it is expected to be if its
   * repo is cloned in the current working directory and the xpi then built within
   *
   * @param {object} driver Configured Firefox webdriver
   * @param {string} fileLocation location for add-on xpi/zip
   * @returns {Promise<void>} returns add-on id)
   */
  installPioneerOptInAddon: async (driver, fileLocation) => {
    fileLocation =
      fileLocation ||
      path.join(process.cwd(), "pioneer-opt-in/pioneer-opt-in.xpi");
    return module.exports.setupWebdriver.installAddon(driver, fileLocation);
  },

  uninstallAddon: async (driver, addonId) => {
    const executor = driver.getExecutor();
    executor.defineCommand(
      "uninstallAddon",
      "POST",
      "/session/:sessionId/moz/addon/uninstall",
    );
    const uninstallCmd = new cmd.Command("uninstallAddon");

    const session = await driver.getSession();
    uninstallCmd.setParameters({ sessionId: session.getId(), id: addonId });
    await executor.execute(uninstallCmd);
    console.log(`Add-on with id ${addonId} uninstalled`);
  },
};
