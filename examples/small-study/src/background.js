/* global getStudySetup */

class FeatureToInstrument {
  /**
   * listen to onEndStudy, onReady
   * `browser.study.setup` fires onReady OR onEndStudy
   *
   * call 'enableFeature' to actually do the ui.
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
