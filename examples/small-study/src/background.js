/* global getStudySetup */

/**
 *  Goal:  Implement an instrumented feature using `browser.study` API
 *
 *  Every runtime:
 *  - Prepare
 *
 *    - listen for `onEndStudy` (study endings)
 *    - listen for `study.onReady`
 *
 *  - Startup the feature
 *
 *    - attempt to `browser.study.setup` the study using our studySetup
 *
 *      - will fire EITHER
 *        -  `endStudy` (`expired`, `ineligible`)
 *        - onReady
 *      - (see docs for `browser.study.setup`)
 *
 *    - onReady: configure the feature to match the `variation` study selected
 *    - or, if we got an `onEndStudy` cleanup and uninstall.
 *
 *  During the feature:
 *    - `sendTelemetry` to send pings
 *    - `endStudy` to force an ending (for positive or negative reasons!)
 *
 *  Interesting things to try next:
 *  - `browser.study.validateJSON` your pings before sending
 *  - `endStudy` different endings in response to user action
 *  - force an override of setup.testing to choose branches.
 *
 */

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
    const { delayInMinutes } = studyInfo;
    if (delayInMinutes !== undefined) {
      const alarmName = `${browser.runtime.id}:studyExpiration`;
      const alarmListener = async alarm => {
        if (alarm.name === alarmName) {
          browser.alarms.onAlarm.removeListener(alarmListener);
          await browser.study.endStudy("expired");
        }
      };
      browser.alarms.onAlarm.addListener(alarmListener);
      browser.alarms.create(alarmName, {
        delayInMinutes,
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
    let clicksInSession = 0;
    browser.browserAction.setBadgeText({ text: "" + clicksInSession });

    browser.browserAction.onClicked.addListener(() => {
      clicksInSession++;
      browser.browserAction.setBadgeText({ text: "" + clicksInSession });

      // see the telemetry appear in `about:Telemetry`, as string:string
      browser.study.sendTelemetry({ clicksInSession: "" + clicksInSession });
      if (clicksInSession >= 3) {
        browser.study.endStudy("user-used-the-feature");
      }
    });
    console.log(
      `Setting the browser action title to the variation name: '${
        studyInfo.variation.name
      }'`,
    );
    await browser.browserAction.setTitle({ title: studyInfo.variation.name });
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
onEveryExtensionLoad();
