/* global getStudySetup */

/* eslint no-unused-vars: off */
class StudyLifeCycleHandler {
  /**
   * Listen to onEndStudy, onReady
   * `browser.study.setup` fires onReady OR onEndStudy
   *
   * call `this.enableFeature` to actually do the feature/experience/ui.
   */
  constructor() {
    browser.study.onEndStudy.addListener(this.handleStudyEnding);
    browser.study.onReady.addListener(this.enableFeature);
  }

  /**
   * do some cleanup / 'feature reset'
   *
   * (If you have privileged code, you might need to clean
   *  that up as well.
   * See:  https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/lifecycle.html
   *
   * @returns {Promise<void>} Nothing
   */
  async cleanup() {
    await browser.storage.local.clear();
  }

  /**
   * - set up expiration alarms
   * - make feature/experience/ui with the particular variation for this user.
   *
   * @param {object} studyInfo see Api for studyInfo()
   * @returns {Promise<void>} Nothing
   */
  async enableFeature(studyInfo) {
    console.log("enableFeature - studyInfo", studyInfo);
    console.log("Checking expiration");
    if (studyInfo.timeUntilExpire) {
      console.log("Setting up expiration");
      browser.alarm.create(studyInfo.timeUntilExpire, () =>
        browser.study.endStudy("expired"),
      );
    }
    console.log(
      `Setting the browser action title to the variation name: '${
        studyInfo.variation.name
      }'`,
    );
    browser.browserAction.setTitle({ title: studyInfo.variation.name });
    console.log(
      "Feature is now enabled, sending 'test:onFeatureEnabled' event (for the tests)",
    );
    browser.runtime.sendMessage("test:onFeatureEnabled").catch(console.error);
    console.log("Removing onReady listener this.enableFeature");
    browser.study.onReady.removeListener(this.enableFeature);
  }

  /** handles `study:end` signals
   *
   * - opens 'ending' urls (surveys, for example)
   * - calls cleanup
   *
   * @param {object} ending A study ending instruction set
   * @returns {Promise<void>} Nothing
   */
  async handleStudyEnding(ending) {
    console.log(`study wants to end:`, ending);
    for (const url of ending.urls) {
      await browser.tabs.create({ url });
    }
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
 *
 * @returns {Promise<void>} Nothing
 */
async function onEveryExtensionLoad() {
  // new StudyLifeCycleHandler();
  // const studySetup = await getStudySetup();
  // await browser.study.setup(studySetup);
}

// Since this is a test-addon, we don't initiate any code directly, but wait
// for events sent by tests. This allows us to control and test the execution
// properly.
// Note: Since this is the first onMessage listener, it will be able to send
// a response to the sending party
// onEveryExtensionLoad();
const onEveryExtensionLoadTestListener = request => {
  console.log("onEveryExtensionLoad listener - request", request);
  if (request === "test:onEveryExtensionLoad") {
    console.log("Removing onEveryExtensionLoadTestListener");
    browser.runtime.onMessage.removeListener(onEveryExtensionLoadTestListener);
    console.log("Running onEveryExtensionLoad()");
    onEveryExtensionLoad();
  }
};
browser.runtime.onMessage.addListener(onEveryExtensionLoadTestListener);

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
 * @param {object} details Unclear what a 'details' is TODO
 * @returns {undefined} Nothing
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
 * @returns {undefined} Nothing
 */
async function handleStartup() {
  console.log("The 'handleStartup' event was fired.", arguments);
}

// todo: on shutdown
// Run shutdown-related non-privileged code

browser.runtime.onStartup.addListener(handleStartup);
browser.runtime.onInstalled.addListener(handleInstalled);
