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

  it("should have a URL bar", async() => {
    const urlBar = await utils.promiseUrlBar(driver);
    const text = await urlBar.getAttribute("placeholder");
    assert.equal(text, "Search or enter address");
  });
});
