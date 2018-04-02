/* eslint no-console:off */
/* global studySetup */

"use strict";

class Study {
  constructor(variation) {}

  // Will run only during first install attempt
  // Use web extension experiments to get whatever prefs, add-ons,
  // telemetry, anything necessary for the check
  static async isEligible() {
    //browser.prefs.get('my.favorite.pref');
    return true;
  }

  // Expiration checks should be implemented in a very reliable way by
  // the add-on since Normandy does not handle study expiration in a reliable manner
  static async hasExpired() {
    return false;
  }
}

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

async function initiateStudy() {
  // Set dynamic study configuration flags
  studySetup.eligible = await Study.isEligible();
  studySetup.expired = await Study.hasExpired();
  // Ensure we have configured study and are supposed to run our feature
  await browser.study.bootstrapStudy(studySetup);
  // Get study variation
  const { variation } = await browser.study.info();
  // Initiate the study
  new Study(variation);
}

// Since this is a test-addon, we don't initiate any code directly, but wait
// for events sent by tests. This allows us to control and test the execution
// properly.
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("request", request);
  if (request === "test:initiateStudy") {
    initiateStudy();
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
const creating = browser.windows.create(createData);
