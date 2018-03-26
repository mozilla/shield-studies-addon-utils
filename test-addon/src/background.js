/* eslint no-console:off */
/* global studySetup */

"use strict";

class Study {
  constructor(variation) {}

  // Will run only during first install attempt
  static async isEligible() {
    // get whatever prefs, addons, telemetry, anything!
    // Cu.import can see 'firefox things', but not package things.
    return true;
  }

  // Expiration checks should be implemented in a very reliable way by
  // the add-on since Normandy does not handle study expiration in a reliable manner
  static async hasExpired() {
    return false;
  }
}

async function runOnce() {

  //browser.prefs.get('my.favorite.pref');

  // Set dynamic study configuration flags
  // TODO
  studySetup.eligible = await Study.isEligible();
  studySetup.expired = await Study.hasExpired();
  // Ensure we have configured shieldUtils and are supposed to run our feature
  await browser.shieldUtils.bootstrapStudy(studySetup);
  // Get study variation
  const { variation } = await browser.shieldUtils.info();
  // Initiate the study
  new Study(variation);
}

/**
 * Fired when a profile that has this extension installed first starts up.
 * This event is not fired when a private browsing/incognito profile is started.
 */
function handleStartup() {
  console.log("handleStartup", arguments);
}

browser.runtime.onStartup.addListener(handleStartup);

/**
 * Fired when the extension is first installed, when the extension is updated
 * to a new version, and when the browser is updated to a new version.
 * @param details
 */
function handleInstalled(details) {
  console.log("handleInstalled", details.reason, details);
}

browser.runtime.onInstalled.addListener(handleInstalled);

// todo: on shutdown
// Run shutdown-related non-priviliged code

// actually start
runOnce();
