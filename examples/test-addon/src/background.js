/* global getStudySetup */

class FeatureToInstrument {
  /**
   * Listen to onEndStudy, onReady
   * `browser.study.setup` fires onReady OR onEndStudy
   *
   * call `this.enableFeature` to actually do the feature/experience/ui.
   */
  constructor(studySetup) {
    browser.study.onEndStudy.addListener(this.handleStudyEnding);
    browser.study.onReady.addListener(this.enableFeature);
    browser.study.setup(studySetup);
  }

  /**
   * do some cleanup / 'feature reset'
   *
   * (If you have privileged code, you might need to clean
   *  that up as well.
   * See:  https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/lifecycle.html
   */
  async cleanup() {
    await browser.storage.local.clear();
  }

  /**
   * - set up expiration alarms
   * - make feature/experience/ui with the particular variation for this user.
   */
  async enableFeature(studyInfo) {
    if (studyInfo.timeUntilExpire) {
      browser.alarm.create(studyInfo.timeUntilExpire, () =>
        browser.study.endStudy("expired"),
      );
    }
    browser.browserAction.setTitle({ title: studyInfo.variation });
    console.log(`changed the browser action title: ${studyInfo.variation}`);
  }

  /** handles `study:end` signals
   *
   * - opens 'ending' urls (surveys, for example)
   * - calls cleanup
   */
  async handleStudyEnding(ending) {
    console.log(`study wants to end:`, ending);
    ending.urls.forEach(async url => await browser.tabs.create({ url }));
    switch (ending.reason) {
      default:
        this.cleanup();
        // uninstall the addon?
        break;
    }
  }
}

/**
 * Run every startup to get config and instantiate the feature
 */
async function onEveryExtensionLoad() {
  const studySetup = await getStudySetup();
  await new FeatureToInstrument(studySetup);
}

// Since this is a test-addon, we don't initiate any code directly, but wait
// for events sent by tests. This allows us to control and test the execution
// properly.
// onEveryExtensionLoad();
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("request", request);
  if (request === "test:onEveryExtensionLoad") {
    onEveryExtensionLoad();
  }
});

// The tests that probe the web extensions APIs directly rely on an extension
// page opening up in a new window/tab.
// For more information, see shield-studies-addon-utils/testUtils/executeJs.js
const createData = {
  type: "detached_panel",
  url: "extension-page-for-tests/index.html",
  width: 500,
  height: 500,
};
browser.windows.create(createData);

// Testing that the web extension events works properly with our bundled APIs requires the below code

/**
 * Fired when the extension is first installed, when the extension is updated
 * to a new version, and when the browser is updated to a new version.
 * @param details
 */
function handleInstalled(details) {
  console.log(
    "The 'handleInstalled' event was fired.",
    details.reason,
    details,
  );
}

/**
 * Fired when a profile that has this extension installed first starts up.
 * This event is not fired when a private browsing/incognito profile is started.
 */
async function handleStartup() {
  console.log("The 'handleStartup' event was fired.", arguments);
}

// todo: on shutdown
// Run shutdown-related non-privileged code

browser.runtime.onStartup.addListener(handleStartup);
browser.runtime.onInstalled.addListener(handleInstalled);
