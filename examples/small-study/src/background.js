/* global studyConfig, isEligible */

async function enableFeature({ variation }) {
  console.log(`making the feature, style: ${variation}`);
}

async function handleStudyEnding(ending) {
  console.log(`study wants to end:`, ending);
  // open the urls.
  // uninstall the addon
  // do some work for cleaning up.
}

async function startup() {
  browser.study.onEndStudy.addListener(handleStudyEnding);
  browser.study.onEnroll.addListener(enableFeature);
  browser.study.enroll(await isEligible(), studyConfig);
}
startup();
