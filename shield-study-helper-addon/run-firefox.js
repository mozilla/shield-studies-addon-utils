/* eslint-env node */

/* This file is a helper script that will install the extension from the .xpi
 * file and setup useful preferences for debugging. This is the same setup
 * that the automated Selenium-Webdriver/Mocha tests run, except in this case
 * we can manually interact with the browser.
 * NOTE: If changes are made, they will not be reflected in the browser upon
 * reloading, as the .xpi file has not been recreated.
 */

console.log("Starting up firefox");

require("geckodriver");
const firefox = require("selenium-webdriver/firefox");
const cmd = require("selenium-webdriver/lib/command");
const Fs = require("fs-extra");
const FxRunnerUtils = require("fx-runner/lib/utils");
const path = require("path");
const webdriver = require("selenium-webdriver");

const By = webdriver.By;
const Context = firefox.Context;
const until = webdriver.until;

// Note: Geckodriver already has quite a good set of default preferences
// for disabling various items.
// https://github.com/mozilla/geckodriver/blob/master/src/marionette.rs
const FIREFOX_PREFERENCES = {
  // Ensure e10s is turned on.
  "browser.tabs.remote.autostart": true,
  "browser.tabs.remote.autostart.1": true,
  "browser.tabs.remote.autostart.2": true,
  // These are good to have set up if you're debugging tests with the browser
  // toolbox.
  "devtools.chrome.enabled": true,
  "devtools.debugger.remote-enabled": true,
  "devtools.debugger.prompt-connection": false,
  "general.warnOnAboutConfig": false,

  "extensions.legacy.enabled": true,

  // WARNING:  also of interest, gecko webdriver sets many prefs at:
  // https://dxr.mozilla.org/mozilla-central/source/testing/geckodriver/src/prefs.rs
  // INCLUDING
  // ("toolkit.telemetry.server", Pref::new("https://%(server)s/dummy/telemetry/")),
};

// useful if we need to test on a specific version of Firefox
async function promiseActualBinary(binary) {
  try {
    const normalizedBinary = await FxRunnerUtils.normalizeBinary(binary);
    await Fs.stat(normalizedBinary);
    return normalizedBinary;
  } catch (ex) {
    if (ex.code === "ENOENT") {
      throw new Error(`Could not find ${binary}`);
    }
    throw ex;
  }
}

promiseSetupDriver = async () => {
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

  const binaryLocation = await promiseActualBinary(
    process.env.FIREFOX_BINARY || "nightly"
  );
  await options.setBinary(new firefox.Binary(binaryLocation));
  const driver = await builder.build();
  // Firefox will be started up by now
  driver.setContext(Context.CHROME);

  return driver;
};

installAddon = async (driver, fileLocation) => {
  // references:
  //    https://bugzilla.mozilla.org/show_bug.cgi?id=1298025
  //    https://github.com/mozilla/geckodriver/releases/tag/v0.17.0
  const executor = driver.getExecutor();
  executor.defineCommand(
    "installAddon",
    "POST",
    "/session/:sessionId/moz/addon/install"
  );
  const installCmd = new cmd.Command("installAddon");

  const session = await driver.getSession();
  installCmd.setParameters({
    sessionId: session.getId(),
    path: fileLocation,
    temporary: true,
  });
  return executor.execute(installCmd);
};

(async () => {
  try {
    const driver = await promiseSetupDriver();

    console.log("Starting up firefox");

    // install the addon
    const fileLocation = path.join(process.cwd(), process.env.XPI);

    await installAddon(driver, fileLocation);
    console.log("Load temporary addon.");

    // navigate to a regular page
    driver.setContext(Context.CONTENT);
    driver.get("about:debugging");
  } catch (e) {
    console.error(e); // eslint-disable-line no-console
  }
})();
