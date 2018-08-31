const { Services } = ChromeUtils.import(
  "resource://gre/modules/Services.jsm",
  {},
);
const { AddonManager } = ChromeUtils.import(
  "resource://gre/modules/AddonManager.jsm",
  {},
);

/**
 * Checks to see if SHIELD is enabled for a user.
 *
 * @returns {Boolean}
 *   A boolean to indicate SHIELD opt-in status.
 */
export function isShieldEnabled() {
  return Services.prefs.getBoolPref("app.shield.optoutstudies.enabled", true);
}

/**
 * Checks to see if the user has opted in to Pioneer. This is
 * done by checking that the opt-in addon is installed and active.
 *
 * @returns {Boolean}
 *   A boolean to indicate opt-in status.
 */
export async function isUserOptedInToPioneer() {
  const addon = await AddonManager.getAddonByID("pioneer-opt-in@mozilla.org");
  return isShieldEnabled() && addon !== null && addon.isActive;
}

export async function getDataPermissions() {
  const shield = isShieldEnabled();
  const pioneer = await isUserOptedInToPioneer();
  return {
    shield,
    pioneer,
  };
}
