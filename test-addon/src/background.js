/* eslint no-console:off */

"use strict";

async function runOnce() {
  // Ensure we have configured shieldUtils and are supposed to run our feature
  await browser.shieldUtils.bootstrapStudy(studyConfig);
  // Get study variation
  const { variation } = await browser.shieldUtils.info();
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
