/* eslint-env node */
/* eslint no-console:off */

// The geckodriver package downloads and installs geckodriver for us.
// We use it by requiring it.
require("geckodriver");
const cmd = require("selenium-webdriver/lib/command");
const firefox = require("selenium-webdriver/firefox");
const webdriver = require("selenium-webdriver");
const FxRunnerUtils = require("fx-runner/lib/utils");
const Fs = require("fs-extra");
const path = require("path");

// const By = webdriver.By;
const Context = firefox.Context;
// const until = webdriver.until;

// Note: Geckodriver already has quite a good set of default preferences
// for disabling various items.
// https://github.com/mozilla/geckodriver/blob/master/src/marionette.rs
const FIREFOX_PREFERENCES = {
  // Ensure e10s is turned on.
  "browser.tabs.remote.autostart": true,
  "browser.tabs.remote.autostart.1": true,
  "browser.tabs.remote.autostart.2": true,

  // Improve debugging using `browser toolbox`.
  "devtools.chrome.enabled": true,
  "devtools.debugger.remote-enabled": true,
  "devtools.debugger.prompt-connection": false,

  // Removing warning for `about:config`
  "general.warnOnAboutConfig": false,

  // Force variation for testing
  "extensions.button_icon_preference.variation": "puppers",

  /** WARNING: gecko webdriver sets many additional prefs at:
   * https://dxr.mozilla.org/mozilla-central/source/testing/geckodriver/src/prefs.rs
   *
   * In, particular, this DISABLES actual telemetry uploading
   * ("toolkit.telemetry.server", Pref::new("https://%(server)s/dummy/telemetry/")),
   *
   */
};

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

/**
 * Uses process.env.FIREFOX_BINARY
 */
module.exports.promiseSetupDriver = async () => {
  const profile = new firefox.Profile();

  Object.keys(FIREFOX_PREFERENCES).forEach(key => {
    profile.setPreference(key, FIREFOX_PREFERENCES[key]);
  });

  const options = new firefox.Options();
  options.setProfile(profile);

  const builder = new webdriver.Builder()
    .forBrowser("firefox")
    .setFirefoxOptions(options);

  const binaryLocation = await promiseActualBinary(
    process.env.FIREFOX_BINARY || "firefox",
  );
  await options.setBinary(new firefox.Binary(binaryLocation));
  const driver = await builder.build();
  // Firefox will be started up by now
  driver.setContext(Context.CHROME);
  return driver;
};

module.exports.installAddon = async driver => {
  // references:
  //    https://bugzilla.mozilla.org/show_bug.cgi?id=1298025
  //    https://github.com/mozilla/geckodriver/releases/tag/v0.17.0
  const fileLocation = path.join(process.cwd(), process.env.XPI_NAME);
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
  await executor.execute(installCmd);
  console.log(`Add-on at ${fileLocation} installed`);
};

module.exports.uninstallAddon = async (driver, id) => {
  const executor = driver.getExecutor();
  executor.defineCommand(
    "uninstallAddon",
    "POST",
    "/session/:sessionId/moz/addon/uninstall",
  );
  const uninstallCmd = new cmd.Command("uninstallAddon");

  const session = await driver.getSession();
  uninstallCmd.setParameters({ sessionId: session.getId(), id });
  await executor.execute(uninstallCmd);
};
