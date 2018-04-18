/* global getStudySetup */

/**
 *  Goal:  Implement an instrumented feature using
 *  `browser.study` API
 *
 *  Every runtime:
 *  - instantiate the feature
 *
 *    - listen for `onEndStudy` (study endings)
 *    - listen for `study.onReady`
 *    - attempt to `browser.study.setup` the study using our studySetup
 *
 *      - will fire EITHER endStudy (expired, ineligible)
 *      - onReady
 *      - (see docs for `browser.study.setup`)
 *
 *    - onReady: configure the feature to match the `variation` study selected
 *    - or, if we got an `onEndStudy` cleanup and uninstall.
 *
 *    During the feature:
 *    - `sendTelemetry` to send pings
 *    - `endStudy` to force an ending (for positive or negative reasons!)
 *
 *  Interesting things to try next:
 *  - `browser.study.validateJSON` your pings before sending
 *  - `endStudy` different endings in response to user action
 *  - force an override of timestamp to see an `expired`
 *  - unset the shield or telemetry prefs during runtime to trigger an ending.
 *
 */

class FeatureToInstrument {
  /**
   * Listen to onEndStudy, onReady
   * `browser.study.setup` fires onReady OR onEndStudy
   *
   * call `this.enableFeature` to actually do the ui.
   */
  constructor(studySetup) {
    browser.study.onEndStudy.addListener(this.handleStudyEnding);
    browser.study.onReady.addListener(this.enableFeature);
    browser.study.setup(studySetup);
  }

  /**
   * do some cleanup / 'feature reset'
   */
  async cleanup() {
    await browser.storage.local.clear();
  }

  /**
   * - set up expiration alarms
   * - make ui with the particular variation for this user.
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
   * calls cleanup
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
async function everyStartup() {
  const studySetup = await getStudySetup();
  await new FeatureToInstrument(studySetup);
}
everyStartup();
