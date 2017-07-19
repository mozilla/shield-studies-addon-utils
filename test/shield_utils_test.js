/* eslint-env node, mocha */

const assert = require("assert");
const utils = require("./utils");
// const firefox = require("selenium-webdriver/firefox");

// const Context = firefox.Context;

// TODO create new profile per test?
// then we can test with a clean profile every time

describe("Shield Study Utils Functional Tests", function() {
  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(15000);

  let driver;

  before(async() => {
    driver = await utils.promiseSetupDriver();
    // install the addon (note: returns addon id)
    await utils.installAddon(driver);
  });

  after(() => driver.quit());

  it("should return the correct variation", async() => {
    const variation = await driver.executeAsyncScript(async(callback) => {
      const { studyUtils } = Components.utils.import("resource://test-addon/StudyUtils.jsm", {});
      // TODO move this to a Config.jsm file
      const studyConfig = {
        studyName: "shieldStudyUtilsTest",
        "weightedVariations": [
          {"name": "control",
            "weight": 1},
          {"name": "kittens",
            "weight": 1.5},
          {"name": "puppers",
            "weight": 2},  // we want more puppers in our sample
        ],
      };

      const sample = studyUtils.sample;
      const clientId = await studyUtils.getTelemetryId();
      const hashFraction = await sample.hashFraction(studyConfig.studyName + clientId);
      const chosenVariation = await sample.chooseWeighted(studyConfig.weightedVariations, hashFraction);
      callback(chosenVariation);
    });
    console.log(variation);
    assert(variation !== null);
  });
});
