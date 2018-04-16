function makeFeature(variationName) {
  console.log(`making the feature, style: ${variationName}`);
}

async function studyReady(message) {
  if (message.name === "study:ready") {
    const variationName = browser.study.info();
    makeFeature(variationName);
  }
}

browser.runtime.onMessage.addListener(studyReady);
