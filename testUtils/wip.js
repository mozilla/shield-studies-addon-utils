/* eslint-env node */
/* eslint no-console:off */

/*
const webdriver = require("selenium-webdriver");
const firefox = require("selenium-webdriver/firefox");
const Context = firefox.Context;
const until = webdriver.until;
*/

// TODO glind general wrapper for 'async with callback'?

/* this is NOT WORKING FOR UNKNOWN HARD TO EXLAIN REASONS
=> Uncaught WebDriverError: InternalError: too much recursion
module.exports.allAddons = async(driver) => {
  // callback is how you get the return back from the script
  return driver.executeAsyncScript(async(callback,) => {
    Components.utils.import("resource://gre/modules/AddonManager.jsm");
    const L = await AddonManager.getAllAddons();
    callback(await L);
  });
};
*/

// TODO glind, specific to share-button-study but useful to demo patterns.
// TODO glind, generalize, document, or destroy

// module.exports.copyUrlBar = async(driver) => {
//   const urlBar = await getChromeElementBy.id(driver,'urlbar');
//   const urlBar = await module.exports.promiseUrlBar(driver);
//   await urlBar.sendKeys(webdriver.Key.chord(MODIFIER_KEY, "A"));
//   await urlBar.sendKeys(webdriver.Key.chord(MODIFIER_KEY, "C"));
// };

// module.exports.testAnimation = async(driver) => {
//   const button = await module.exports.promiseAddonButton(driver);
//   if (button === null) { return { hasClass: false, hasColor: false }; }
//
//   const buttonClassString = await button.getAttribute("class");
//   const buttonColor = await button.getCssValue("background-color");
//
//   const hasClass = buttonClassString.split(" ").includes("social-share-button-on");
//   const hasColor = buttonColor.includes("43, 153, 255");
//   return { hasClass, hasColor };
// };

// module.exports.waitForClassAdded = async(driver) => {
//  try {
//    const animationTest = await driver.wait(async() => {
//      const { hasClass } = await module.exports.testAnimation(driver);
//      return hasClass;
//    }, 1000);
//    return animationTest;
//  } catch (e) {
//    if (e.name === "TimeoutError") { return null; }
//    throw (e);
//  }
// };
//
// module.exports.waitForAnimationEnd = async(driver) => {
//  try {
//    return await driver.wait(async() => {
//      const { hasClass, hasColor } = await module.exports.testAnimation(driver);
//      return !hasClass && !hasColor;
//    }, 1000);
//  } catch (e) {
//    if (e.name === "TimeoutError") { return null; }
//    throw (e);
//  }
// };

// module.exports.testPanel = async(driver, panelId) => {
//   driver.setContext(Context.CHROME);
//   try { // if we can't find the panel, return false
//     return await driver.wait(async() => {
//       // need to execute JS, since state is not an HTML attribute, it's a property
//       const panelState = await driver.executeAsyncScript((panelIdArg, callback) => {
//         const shareButtonPanel = window.document.getElementById(panelIdArg);
//         if (shareButtonPanel === null) {
//           callback(null);
//         } else {
//           const state = shareButtonPanel.state;
//           callback(state);
//         }
//       }, panelId);
//       return panelState === "open";
//     }, 1000);
//   } catch (e) {
//     if (e.name === "TimeoutError") { return null; }
//     throw e;
//   }
// };

// module.exports.closePanel = async(driver, target = null) => {
//   if (target !== null) {
//     target.sendKeys(webdriver.Key.ESCAPE);
//   } else {
//     const urlbar = await module.exports.promiseUrlBar(driver);
//     await urlbar.sendKeys(webdriver.Key.ESCAPE);
//   }
// };
