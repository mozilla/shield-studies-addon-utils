/* global studyConfig, allowEnroll */

async function enableFeature(study) {
  if (study.expiration.alarm) {
    browser.alarm.create(study.expiration.alarm, () =>
      browser.study.endStudy("expired"),
    );
  }
  console.log(`making the feature, style: ${study.variation}`);
}

async function handleStudyEnding(ending) {
  console.log(`study wants to end:`, ending);
  // open the urls from `ending.urls`;
  // clean up your own addon / feature mess
  // uninstall the addon
}

async function startup() {
  browser.study.onEndStudy.addListener(handleStudyEnding);
  browser.study.onReady.addListener(enableFeature);

  studyConfig.allowEnroll = await allowEnroll();
  browser.study.setup(studyConfig);
}
startup();
