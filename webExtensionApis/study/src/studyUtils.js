/* eslint-env commonjs */

"use strict";

import { utilsLogger } from "./logger";
import ShieldStudyType from "./studyTypes/shield";
import PioneerStudyType from "./studyTypes/pioneer";

const UTILS_VERSION = require("../../../package.json").version;
const PACKET_VERSION = 3;

const { Services } = ChromeUtils.import(
  "resource://gre/modules/Services.jsm",
  {},
);

Cu.importGlobalProperties(["URL", "crypto", "URLSearchParams"]);

/**
 * Telemetry Probe JSON schema validation (via AJV at runtime)
 *
 * Schemas here are used for:
 *  - Telemetry (Ensure correct Parquet format for different types of
 *    outbound packets):
 *    - "shield-study": shield study state and outcome data common to all
 *      shield studies.
 *    - "shield-study-addon": addon-specific probe data, with `attributes`
 *      (used to capture feature-specific state) sent as Map(string,string).
 *    - "shield-study-error": data used to notify, group and count some kinds
 *      of errors from shield studies
 */
const schemas = {
  // Telemetry PingType schemas
  "shield-study": require("shield-study-schemas/schemas-client/shield-study.schema.json"), // eslint-disable-line max-len
  "shield-study-addon": require("shield-study-schemas/schemas-client/shield-study-addon.schema.json"), // eslint-disable-line max-len
  "shield-study-error": require("shield-study-schemas/schemas-client/shield-study-error.schema.json"), // eslint-disable-line max-len
};
import jsonschema from "./jsonschema";

/**  Simple spread/rest based merge, using Object.assign.
 *
 * Right-most overrides, top level only, by full value replacement.
 *
 * Note: Unlike deep merges might not handle symbols and other things.
 *
 * @param {...Object} sources - 1 or more sources
 * @returns {Object} - the resulting merged object
 */
function merge(...sources) {
  return Object.assign({}, ...sources);
}

/**
 * Appends a query string to a url.
 * @param {string} url - a base url to append; must be static (data) or external
 * @param {Object} args - query arguments, one or more object literal used to
 * build a query string
 *
 * @returns {string} - an absolute url appended with a query string
 */
function mergeQueryArgs(url, ...args) {
  const U = new URL(url);
  // get the query string already attached to url, if it exists
  let q = U.search || "?";
  // create an interface to interact with the query string
  q = new URLSearchParams(q);
  const merged = merge({}, ...args);
  // Set each search parameter in "merged" to its value in the query string,
  // building up the query string one search parameter at a time.
  Object.keys(merged).forEach(k => {
    q.set(k, merged[k]);
  });
  // append our new query string to the URL object made with "url"
  U.search = q.toString();
  // return the full url, with the appended query string
  return U.toString();
}

/**
 * Class representing utilities singleton for shield studies.
 */
class StudyUtils {
  /**
   * Create a StudyUtils instance to power the `browser.study` API
   *
   * - `this._extensionManifest`: mirrors the extensionManifest at the time of api creation
   * - `this.seenTelemetry`: array of seen telemetry. Fully populated only if studySetup.telemetry.internalTelemetryArchive is true
   */
  constructor() {
    // expose schemas
    this.schemas = schemas;

    // expose jsonschema validation methods
    this.jsonschema = jsonschema;

    this._extensionManifest = {};
    this.studyTypeHandler = null;
    this.seenTelemetry = [];
  }

  setExtensionManifest(extensionManifest) {
    this._extensionManifest = extensionManifest;
  }

  /**
   * Gets the telemetry client ID for the user.
   * @returns {string} - the telemetry client ID
   */
  async getTelemetryId() {
    return this.studyTypeHandler.getTelemetryId();
  }

  /**
   * Gets the Shield recipe client ID.
   * @returns {string} - the Shield recipe client ID.
   */
  getShieldId() {
    const key = "extensions.shield-recipe-client.user_id";
    return Services.prefs.getStringPref(key, "");
  }

  async fullSurveyUrl(surveyBaseUrl, reason) {
    const queryArgs = await this.endingQueryArgs();
    queryArgs.reason = reason;
    queryArgs.fullreason = reason;
    return mergeQueryArgs(surveyBaseUrl, queryArgs);
  }

  /**
   * Builds an object whose properties are query arguments that can be
   * appended to a study ending url
   * @returns {Object} - the query arguments for the study
   */
  async endingQueryArgs() {
    const who = await this.getTelemetryId();
    const queryArgs = {
      shield: PACKET_VERSION,
      study,
      variation,
      updateChannel: Services.appinfo.defaultUpdateChannel,
      fxVersion: Services.appinfo.version,
      addon: this._extensionManifest.version, // addon version
      who, // telemetry clientId
    };
    queryArgs.testing = false;
    return queryArgs;
  }

  /**
   * Validates and submits telemetry pings from StudyUtils.
   * @param {Object} data - the data to send as part of the telemetry packet
   * @param {string} bucket - the type of telemetry packet to be sent
   * @returns {Promise|boolean} - A promise that resolves with the ping id
   * once the ping is stored or sent, or false if
   *   - there is a validation error,
   *   - the packet is of type "shield-study-error"
   *   - the study's telemetryConfig.send is set to false
   */
  async _telemetry(
    data,
    bucket = "shield-study-addon",
    /*
    studyType,
    study_name,
    branch,
    testing,
     */
  ) {
    utilsLogger.debug(`telemetry in:  ${bucket} ${JSON.stringify(data)}`);

    const payload = {
      version: PACKET_VERSION,
      study_name,
      branch,
      addon_version: this._extensionManifest.version,
      shield_version: UTILS_VERSION,
      type: bucket,
      data,
      testing,
    };

    let validation;
    try {
      validation = jsonschema.validate(payload, schemas[bucket]);
    } catch (err) {
      // Catch failures of unknown origin (could be library, add-on, system...)
      // if validation broke, GIVE UP.
      utilsLogger.error(err);
      return false;
    }
    /*
    * Handle validation errors by sending a "shield-study-error"
    * telemetry ping with the error report.
    * If the invalid payload is itself of type "shield-study-error",
    * throw an error (to avoid a possible infinite loop).
    */
    if (validation.errors.length) {
      const errorReport = {
        error_id: "jsonschema-validation",
        error_source: "addon",
        severity: "fatal",
        message: JSON.stringify(validation.errors),
      };
      if (bucket === "shield-study-error") {
        utilsLogger.warn("cannot validate shield-study-error", data, bucket);
        return false; // just die, maybe should have a super escape hatch?
      }
      return this.telemetryError(errorReport);
    }
    utilsLogger.debug(`telemetry: ${JSON.stringify(payload)}`);

    // Different study types treat data and configuration differently
    if (studyType === "shield") {
      this.studyTypeHandler = new ShieldStudyType(this);
    }
    if (studyType === "pioneer") {
      this.studyTypeHandler = new PioneerStudyType(this);
    }

    let pingId;
    pingId = await this.studyTypeHandler.sendTelemetry(bucket, payload);

    // Store a copy of the ping if it's a shield-study or error ping, which are few in number, or if we have activated the internal telemetry archive configuration
    if (
      bucket === "shield-study" ||
      bucket === "shield-study-error" ||
      this.telemetryConfig.internalTelemetryArchive
    ) {
      this.seenTelemetry.push({ id: pingId, payload });
    }

    return pingId;
  }

  /**
   * Validates and submits telemetry pings from the add-on; mostly from
   * webExtension messages.
   * @param {Object} payload - the data to send as part of the telemetry packet
   * @returns {Promise|boolean} - see StudyUtils._telemetry
   */
  async telemetry(payload) {
    utilsLogger.debug(`telemetry ${JSON.stringify(payload)}`);
    const toSubmit = {
      attributes: payload,
    };
    return this._telemetry(toSubmit, "shield-study-addon");
  }

  /**
   * Submits error report telemetry pings.
   * @param {Object} errorReport - the error report, see StudyUtils._telemetry
   * @returns {Promise|boolean} - see StudyUtils._telemetry
   */
  telemetryError(errorReport) {
    return this._telemetry(errorReport, "shield-study-error");
  }

  /**
   * Calculate Telemetry using appropriate shield or pioneer methods.
   *
   *  shield:
   *   - Calculate the size of a ping
   *
   *   pioneer:
   *   - Calculate the size of a ping that has Pioneer encrypted data
   *
   * @param {Object} payload Non-nested object with key strings, and key values
   * @returns {Promise<Number>} The total size of the ping.
   */
  async calculateTelemetryPingSize(payload) {
    const toSubmit = {
      attributes: payload,
    };
    return this.studyTypeHandler.getPingSize(toSubmit, "shield-study-addon");
  }
}

// TODO, use the usual es6 exports
// Actually create the singleton.
const studyUtils = new StudyUtils();
this.studyUtils = studyUtils;
