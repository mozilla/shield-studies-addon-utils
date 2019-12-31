/* global getStudySetup */

async function onEveryExtensionLoad() {
  console.log("The 'onEveryExtensionLoad' method has run.");
  // Usually we fire study-specific code here, but this test-add-on is a noop
}

onEveryExtensionLoad();

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

browser.runtime.onStartup.addListener(handleStartup);
browser.runtime.onInstalled.addListener(handleInstalled);
