/* eslint-env node */

console.log("There are many profile makers.  This one is mine.");

// const cmd = require("selenium-webdriver/lib/command");
const firefox = require("selenium-webdriver/firefox");
// const webdriver = require("selenium-webdriver");
// const FxRunnerUtils = require("fx-runner/lib/utils");
const Fs = require("fs-extra");
const path = require("path");
// const Context = firefox.Context;


async function makeProfile({outputPath, prefsObject, addonsPathList, templateProfile, certs}) {
  // copies from initial profile if set

  if (templateProfile) {
    console.log(`Source: Cloning from ${templateProfile}`);
  } else {
    console.log(`Source: new profile`);
  }
  const profile = new firefox.Profile(templateProfile);

  // TODO: allow certs, other stuff
  // see node_modules/selenium-webdriver/firefox/profile.js

  // TODO, allow 'actually send telemetry' here.
  Object.keys(prefsObject).forEach(key => {
    profile.setPreference(key, prefsObject[key]);
  });

  // Extensions... maybe
  for (const extension of addonsPathList) {
    profile.addExtension(extension);
  }

  const tmpProfileDir = await profile.writeToDisk();
  console.log(`Profile created at: ${tmpProfileDir}`);
  if (outputPath) {
    Fs.copySync(tmpProfileDir, outputPath);
    console.log(`Profile copied to: ${outputPath}`);

  }

  // // TODO glind, allow config to re-use profile
  // const options = new firefox.Options();
  // options.setProfile(profile);
  //
  // const builder = new webdriver.Builder()
  //   .forBrowser("firefox")
  //   .setFirefoxOptions(options);
  //
  // const binaryLocation = await promiseActualBinary(
  //   process.env.FIREFOX_BINARY || "firefox",
  // );
  // await options.setBinary(new firefox.Binary(binaryLocation));
  // const driver = await builder.build();
  // // Firefox will be started up by now
  // driver.setContext(Context.CHROME);
  // return driver;
}

makeProfile({
  prefsObject: {
    "a.pref": 1,
    "some.other.pref": "abcd",
  },
  addonsPathList: [
    // TODO, copy and rename to xpi if it's a zip.  This is a silly thing to block.  OR fix upstream
    "/Users/glind/gits/shield-studies-addon-utils/test-addon/dist/shield_utils_test_add-on-1.0.0.xpi",
  ],
  outputPath:  path.join(process.cwd(), 'aProfile'),
});
