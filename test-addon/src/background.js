/* global getStudySetup */

class StudyLifeCycleHandler {
  /**
   * Listen to onEndStudy, onReady
   * `browser.study.setup` fires onReady OR onEndStudy
   *
   * call `this.enableFeature` to actually do the feature/experience/ui.
   */
  constructor() {
    /*
     * IMPORTANT:  Listen for `onEndStudy` before calling `browser.study.setup`
     * because:
     * - `setup` can end with 'ineligible' due to 'allowEnroll' key in first session.
     *
     */
    browser.study.onEndStudy.addListener(this.handleStudyEnding.bind(this));
    browser.study.onReady.addListener(this.enableFeature.bind(this));
  }

  /**
   * Cleanup
   *
   * (If you have privileged code, you might need to clean
   *  that up as well.
   * See:  https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/lifecycle.html
   *
   * @returns {undefined}
   */
  async cleanup() {
    // do whatever work your addon needs to clean up
  }

  /**
   *
   * side effects
   * - set up expiration alarms
   * - make feature/experience/ui with the particular variation for this user.
   *
   * @param {object} studyInfo browser.study.studyInfo object
   *
   * @returns {undefined}
   */
  async enableFeature(studyInfo) {
    console.log("enabling feature", studyInfo);
    if (studyInfo.timeUntilExpire) {
      const alarmName = `${browser.runtime.id}:studyExpiration`;
      const alarmListener = async alarm => {
        if (alarm.name === alarmName) {
          console.log("study will expire now!");
          browser.alarms.onAlarm.removeListener(alarmListener);
          await browser.study.endStudy("expired");
        }
      };
      browser.alarms.onAlarm.addListener(alarmListener);
      browser.alarms.create(alarmName, {
        when: Date.now() + studyInfo.timeUntilExpire,
      });
    }
    feature.configure(studyInfo);
  }

  /** handles `study:end` signals
   *
   * - opens 'ending' urls (surveys, for example)
   * - calls cleanup
   *
   * @param {object} ending An ending result
   *
   * @returns {undefined}
   */
  async handleStudyEnding(ending) {
    console.log(`study wants to end:`, ending);
    for (const url of ending.urls) {
      await browser.tabs.create({ url });
    }
    switch (ending.endingName) {
      // could have different actions depending on positive / ending names
      default:
        console.log(`the ending: ${ending.endingName}`);
        await this.cleanup();
        break;
    }
    // actually remove the addon.
    console.log("about to actually uninstall");
    return browser.management.uninstallSelf();
  }
}

/* An example feature singleton, demonstrating Telemetry and some endings */
class ButtonFeature {
  constructor() {}

  async configure(studyInfo) {
    console.log(
      `Setting the browser action title to the variation name: '${
        studyInfo.variation.name
      }'`,
    );
    await browser.browserAction.setTitle({ title: studyInfo.variation.name });
    console.log(
      "Feature is now enabled, sending 'test:onFeatureEnabled' event (for the tests)",
    );
    browser.runtime.sendMessage("test:onFeatureEnabled").catch(console.error);
  }
}

// construct. will be configured after setup.
const feature = new ButtonFeature();

/**
 * Run every startup to get config and instantiate the feature
 *
 * @returns {undefined}
 */
async function onEveryExtensionLoad() {
  new StudyLifeCycleHandler();

  const studySetup = await getStudySetup();
  console.log(`studySetup: ${JSON.stringify(studySetup)}`);
  await browser.study.setup(studySetup);
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
 *
 * See:  https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/runtime/onInstalled
 *
 * @param {object} details webExtension details object
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
