/* eslint-env commonjs */

"use strict";

/**
 * Creates a logger for debugging.
 *
 * The pref to control this is "shieldStudy.logLevel"
 *
 * @param {string} logPrefix - the name of the Console instance
 * @param {string} level - level to use by default
 * @returns {Object} - the Console instance, see gre/modules/Console.jsm
 */
function createShieldStudyLogger(logPrefix, level = "Warn") {
  const prefName = "shieldStudy.logLevel";
  const ConsoleAPI = ChromeUtils.import(
    "resource://gre/modules/Console.jsm",
    {},
  ).ConsoleAPI;
  return new ConsoleAPI({
    maxLogLevel: level,
    maxLogLevelPref: prefName,
    prefix: logPrefix,
  });
}

const logger = createShieldStudyLogger("shield-study-utils");

export { createShieldStudyLogger, logger };
