/* eslint-env commonjs */

"use strict";

/**
 * Creates a logger for debugging.
 *
 * The pref to control this is "shieldStudy.logLevel"
 *
 * @param {string} prefix - a prefix string to be printed before
 *                            the actual logged message
 * @param {string} maxLogLevelPref - String pref name which contains the
 *                            level to use for maxLogLevel
 * @param {string} maxLogLevel - level to use by default, see LOG_LEVELS in gre/modules/Console.jsm
 * @returns {Object} - the Console instance, see gre/modules/Console.jsm
 */
function createLogger(prefix, maxLogLevelPref, maxLogLevel = "warn") {
  const ConsoleAPI = ChromeUtils.import(
    "resource://gre/modules/Console.jsm",
    {},
  ).ConsoleAPI;
  return new ConsoleAPI({
    prefix,
    maxLogLevelPref,
    maxLogLevel,
  });
}

const utilsLogger = createLogger("shield-study-utils", "shieldStudy.logLevel");

export { createLogger, utilsLogger };
