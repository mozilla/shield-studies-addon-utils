/* eslint-env commonjs */
/* eslint no-unused-vars: off */
/* eslint no-console: ["warn", { allow: ["info", "warn", "error"] }] */
/* global ExtensionAPI */

"use strict";

import { utilsLogger } from "./logger";
import { studyUtils } from "./studyUtils";
import { getDataPermissions } from "./dataPermissions";

/** Implements the study/getApi for `browser.study` API */
this.study = class extends ExtensionAPI {
  /**
   * We don't need to override the constructor for other
   * reasons than to clarify the class member "extension"
   * being of type Extension
   *
   * @param {object} extension Extension
   */
  constructor(extension) {
    super(extension);
    /**
     * @type Extension
     */
    this.extension = extension;
    utilsLogger.debug("constructed!");
  }

  /**
   * @param {object} context the add-on context
   * @returns {object} api with study, studyDebug keys
   */
  getAPI(context) {
    const { extension } = this;

    const { ExtensionUtils } = ChromeUtils.import(
      "resource://gre/modules/ExtensionUtils.jsm",
      {},
    );

    utilsLogger.debug("loading web extension experiment study/api.js");

    /* eslint-disable no-undef */
    const { ExtensionError } = ExtensionUtils;

    // Used for pref naming, telemetry
    studyUtils.setExtensionManifest(extension.manifest);

    return {
      study: {
        /* Object of current dataPermissions (shield enabled true/false, pioneer enabled true/false) */
        getDataPermissions,

        /** Send Telemetry using appropriate shield or pioneer methods.
         *
         *  shield:
         *  - `shield-study-addon` ping, requires object string keys and string values
         *
         *  pioneer:
         *  - TBD
         *
         *  Note:
         *  - no conversions / coercion of data happens.
         *
         *  Note:
         *  - undefined what happens if validation fails
         *  - undefined what happens when you try to send 'shield' from 'pioneer'
         *
         *  TBD fix the parameters here.
         *
         * @param {Object} payload Non-nested object with key strings, and key values
         * @param {Object} telemetryPipeline - the telemetry pipeline
         * @returns {undefined}
         */
        sendTelemetry: async function sendTelemetry(
          payload,
          telemetryPipeline,
        ) {
          utilsLogger.debug("called sendTelemetry payload");

          function throwIfInvalid(obj) {
            // Check: all keys and values must be strings,
            for (const k in obj) {
              if (typeof k !== "string")
                throw new ExtensionError(`key ${k} not a string`);
              if (typeof obj[k] !== "string")
                throw new ExtensionError(`value ${k} ${obj[k]} not a string`);
            }
            return true;
          }

          throwIfInvalid(payload);
          utilsLogger.debug("valid telemetry payload");

          try {
            return studyUtils.telemetry(payload, telemetryPipeline);
          } catch (error) {
            // Surface otherwise silent or obscurely reported errors
            console.error(error.message, error.stack);
            throw new ExtensionError(error.message);
          }
        },

        /** Calculate Telemetry using appropriate shield or pioneer methods.
         *
         *  shield:
         *   - Calculate the size of a ping
         *
         *   pioneer:
         *   - Calculate the size of a ping that has Pioneer encrypted data
         *
         * @param {Object} payload Non-nested object with key strings, and key values
         * @param {Object} telemetryPipeline - the telemetry pipeline
         * @returns {Promise<Number>} The total size of the ping.
         */
        calculateTelemetryPingSize: async function calculateTelemetryPingSize(
          payload,
          telemetryPipeline,
        ) {
          try {
            return studyUtils.calculateTelemetryPingSize(
              payload,
              telemetryPipeline,
            );
          } catch (error) {
            // Surface otherwise silent or obscurely reported errors
            console.error(error.message, error.stack);
            throw new ExtensionError(error.message);
          }
        },

        /** Search locally stored telemetry pings using these fields (if set)
         *
         *  n:
         *    if set, no more than `n` pings.
         *  type:
         *    Array of 'ping types' (e.g., main, crash, shield-study-addon) to filter
         *  mininumTimestamp:
         *    only pings after this timestamp.
         *  headersOnly:
         *    boolean.  If true, only the 'headers' will be returned.
         *
         *  Pings will be returned sorted by timestamp with most recent first.
         *
         *  Usage scenarios:
         *  - enrollment / eligiblity using recent Telemetry behaviours or client environment
         *  - add-on testing scenarios
         *
         * @param {Object<query>} searchTelemetryQuery see above
         * @returns {Array<sendTelemetry>} matchingPings
         */
        async searchSentTelemetry(searchTelemetryQuery) {
          try {
            const { TelemetryArchive } = ChromeUtils.import(
              "resource://gre/modules/TelemetryArchive.jsm",
              {},
            );
            const { searchTelemetryArchive } = require("./telemetry.js");
            return searchTelemetryArchive(
              TelemetryArchive,
              searchTelemetryQuery,
            );
          } catch (error) {
            // Surface otherwise silent or obscurely reported errors
            console.error(error.message, error.stack);
            throw new ExtensionError(error.message);
          }
        },

        /* Using AJV, do jsonschema validation of an object.  Can be used to validate your arguments, packets at client. */
        validateJSON: async function validateJSON(someJson, jsonschema) {
          try {
            utilsLogger.debug("called validateJSON someJson, jsonschema");
            return studyUtils.jsonschema.validate(someJson, jsonschema);
          } catch (error) {
            // Surface otherwise silent or obscurely reported errors
            console.error(error.message, error.stack);
            throw new ExtensionError(error.message);
          }
        },

        /* Annotates the supplied survey base url with common survey parameters (study name, variation, updateChannel, fxVersion, add-on version and client id) */
        fullSurveyUrl: async function fullSurveyUrl(
          surveyBaseUrl,
          reason,
          telemetryPipeline,
        ) {
          try {
            utilsLogger.debug(
              "Called fullSurveyUrl(surveyBaseUrl, reason)",
              surveyBaseUrl,
              reason,
            );
            return studyUtils.fullSurveyUrl({
              surveyBaseUrl,
              reason,
              telemetryPipeline,
            });
          } catch (error) {
            // Surface otherwise silent or obscurely reported errors
            console.error(error.message, error.stack);
            throw new ExtensionError(error.message);
          }
        },
      },

      studyDebug: {
        throwAnException(message) {
          utilsLogger.debug(
            `Throwing an ExtensionError with message "${message}"`,
          );
          throw new ExtensionError(message);
        },

        async throwAnExceptionAsync(message) {
          utilsLogger.debug(
            `Throwing an ExtensionError async with message "${message}"`,
          );
          throw new ExtensionError(message);
        },

        async recordSeenTelemetry() {
          studyUtils.recordSeenTelemetry = true;
        },

        async resetSeenTelemetry() {
          studyUtils.seenTelemetry = [];
        },

        async getSeenTelemetry() {
          return studyUtils.seenTelemetry;
        },
      },
    };
  }
};
