/* eslint-env commonjs */
/* eslint no-logger: off */
/* global ExtensionAPI */

/** 1.  Provides the WebExtension Experiment `getApi`
 * 2.  Handles 'user-disable' telemetry.
 * 3.  Does NOT handle 'user-disable' surveys, see #194
 */

import { utilsLogger, createLogger } from "./logger";
import makeWidgetId from "./makeWidgetId";
import * as testingOverrides from "./testingOverrides";
import * as dataPermissions from "./dataPermissions";

ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");

utilsLogger.debug("loading web extension experiment study/api.js");

/* eslint-disable no-undef */
const { EventManager } = ExtensionCommon;
const { ExtensionError } = ExtensionUtils;
const EventEmitter =
  ExtensionCommon.EventEmitter || ExtensionUtils.EventEmitter;

/** Event emitter to handle Events defined in the API
 *
 * - onReady
 * - onEndStudy
 *
 */
class StudyApiEventEmitter extends EventEmitter {
  emitReady(studyInfo) {
    this.emit("ready", studyInfo);
  }

  emitEndStudy(endingResponse) {
    this.emit("endStudy", endingResponse);
  }
}

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
    this.studyApiEventEmitter = new StudyApiEventEmitter();
    utilsLogger.debug("constructed!");
  }

  /**
   * Extension Uninstall
   * APIs that allocate any resources (e.g., adding elements to the browser’s
   * user interface, setting up internal event listeners, etc.) must free
   * these resources when the extension for which they are allocated is
   * shut down.
   *
   * https://searchfox.org/mozilla-central/source/toolkit/components/extensions/parent/ext-protocolHandlers.js#46
   *
   * @param {string} shutdownReason one of the reasons
   * @returns {undefined}
   */
  async onShutdown(shutdownReason) {
    utilsLogger.debug("possible uninstalling", shutdownReason);
    if (
      shutdownReason === "ADDON_UNINSTALL" ||
      shutdownReason === "ADDON_DISABLE"
    ) {
      utilsLogger.debug("definitely uninstall | disable", shutdownReason);
      const anEndingAlias = "user-disable";
      const endingResponse = await this.studyUtils.endStudy(anEndingAlias);
      // See #194, getApi is already torn down, so cannot hear it.
      await this.studyApiEventEmitter.emitEndStudy(endingResponse);
    }
  }

  /**
   * @param {object} context the add-on context
   * @returns {object} api with study, studyDebug keys
   */
  getAPI(context) {
    const { extension } = this;

    // Load studyUtils
    const { studyUtils } = require("./studyUtils.js");

    // Make studyUtils available for onShutdown handler
    this.studyUtils = studyUtils;

    /* eslint no-shadow: off */
    const { studyApiEventEmitter } = this;

    // once.  Used for pref naming, telemetry
    studyUtils.setExtensionManifest(extension.manifest);
    studyUtils._internals = studyUtils._createInternals();

    // for add-on logging via browser.study.logger.log()
    const widgetId = makeWidgetId(extension.manifest.applications.gecko.id);
    const addonLogger = createLogger(widgetId, `shieldStudy.logLevel`);

    async function endStudy(anEndingAlias) {
      utilsLogger.debug("called endStudy with anEndingAlias:", anEndingAlias);
      const endingResponse = await studyUtils.endStudy(anEndingAlias);
      studyApiEventEmitter.emitEndStudy(endingResponse);
    }

    // Add normandy unenroll listener
    const { AddonStudies } = ChromeUtils.import(
      "resource://normandy/lib/AddonStudies.jsm",
      {},
    );
    AddonStudies.addUnenrollListener(extension.id, async reason => {
      utilsLogger.debug(
        "AddonStudies.addUnenrollListener fired with reason:",
        reason,
      );
      await endStudy(reason);
      // Normandy will wait until this promise resolves before uninstalling the add-on
      // We need to give the add-on a chance to do its clean-up after receiving the endStudy event above
      // Note that the add-on uninstalls by itself upon the endStudy event
      utilsLogger.debug(
        "Stalling for a few seconds before allowing Normandy to uninstall the add-on",
      );
      await new Promise(resolve => {
        const id = setTimeout(() => {
          clearTimeout(id);
          resolve();
        }, 5 * 1000);
      });
    });

    return {
      study: {
        /** Attempt an setup/enrollment, with these effects:
         *
         *  - sets 'studyType' as Shield or Pioneer
         *    - affects telemetry
         *    - watches for dataPermission changes that should *always*
         *      stop that kind of study
         *
         *  - Use or choose variation
         *    - `testing.variation` if present
         *    - OR deterministicVariation
         *      for the studyType using `weightedVariations`
         *
         *  - During firstRun[1] only:
         *    - set firstRunTimestamp pref value
         *    - send 'enter' ping
         *    - if `allowEnroll`, send 'install' ping
         *    - else endStudy("ineligible") and return
         *
         *  - Every Run
         *    - setActiveExperiment(studySetup)
         *    - monitor shield | pioneer permission endings
         *    - suggests alarming if `expire` is set.
         *
         *  Returns:
         *  - studyInfo object (see `getStudyInfo`)
         *
         *  Telemetry Sent (First run only)
         *
         *    - enter
         *    - install
         *
         *  Fires Events
         *
         *  (At most one of)
         *  - study:onReady  OR
         *  - study:onEndStudy
         *
         *  Preferences set
         *  - `shield.${runtime.id}.firstRunTimestamp`
         *
         *  Note:
         *  1. allowEnroll is ONLY used during first run (install)
         *
         * @param {Object<studySetup>} studySetup See API.md
         * @returns {Object<studyInfo>} studyInfo.  See studyInfo
         **/
        setup: async function setup(studySetup) {
          // 0.  testing overrides, if any
          if (!studySetup.testing) {
            studySetup.testing = {};
          }

          // Setup and sets the variation / _internals
          // includes possible 'firstRun' handling.
          await studyUtils.setup(studySetup);

          // current studyInfo.
          let studyInfo = studyUtils.info();

          // Check if the user is eligible to run this study using the |isEligible|
          // function when the study is initialized
          if (studyInfo.isFirstRun) {
            if (!studySetup.allowEnroll) {
              utilsLogger.debug("User is ineligible, ending study.");
              // 1. uses studySetup.endings.ineligible.url if any,
              // 2. sends UT for "ineligible"
              // 3. then uninstalls add-on
              await endStudy("ineligible");
              return studyUtils.info();
            }
          }

          if (studyInfo.delayInMinutes === 0) {
            utilsLogger.debug("encountered already expired study");
            await endStudy("expired");
            return studyUtils.info();
          }

          /*
          * Adds the study to the active list of telemetry experiments,
          * and sends the "installed" telemetry ping if applicable,
          * if it's a firstRun
          */
          await studyUtils.startup();

          // update what the study variation and other info is.
          studyInfo = studyUtils.info();
          utilsLogger.debug(`api info: ${JSON.stringify(studyInfo)}`);
          try {
            studyApiEventEmitter.emitReady(studyInfo);
          } catch (e) {
            utilsLogger.error("browser.study.setup error");
            utilsLogger.error(e);
          }
          return studyUtils.info();
        },

        /* Signal to browser.study that it should end.
         *
         *  Usage scenarios:
         *  - add-ons defined
         *    - postive endings (tried feature)
         *    - negative endings (client clicked 'no thanks')
         *    - expiration / timeout (feature should last for 14 days then uninstall)
         *
         *  Logic:
         *  - If study has already ended, do nothing.
         *  - Else: END
         *
         *  END:
         *  - record internally that study is ended.
         *  - disable all methods that rely on configuration / setup.
         *  - clear all prefs stored by `browser.study`
         *  - fire telemetry pings for:
         *    - 'exit'
         *    - the ending, one of:
         *
         *      "ineligible",
         *      "expired",
         *      "user-disable",
         *      "ended-positive",
         *      "ended-neutral",
         *      "ended-negative",
         *
         *  - augment all ending urls with query urls
         *  - fire 'study:end' event to `browser.study.onEndStudy` handlers.
         *
         *  Addon should then do
         *  - open returned urls
         *  - feature specific cleanup
         *  - uninstall the add-on
         *
         *  Note:
         *  1.  calling this function multiple time is safe.
         *  `browser.study` will choose the first in.
         *  2.  the 'user-disable' case is handled above
         *  3.  throws if the endStudy fails
         **/
        endStudy,

        /* current study configuration, including
         *  - variation
         *  - activeExperimentName
         *  - delayInMinutes
         *  - firstRunTimestamp
         *
         *  But not:
         *  - telemetry clientId
         *
         *  Throws ExtensionError if called before `browser.study.setup`
         **/
        getStudyInfo: async function getStudyInfo() {
          utilsLogger.debug("called getStudyInfo ");
          return studyUtils.info();
        },

        /* Object of current dataPermissions (shield enabled true/false, pioneer enabled true/false) */
        getDataPermissions: async function getDataPermissions() {
          return dataPermissions.getDataPermissions();
        },

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
         * @returns {undefined}
         */
        sendTelemetry: async function sendTelemetry(payload) {
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
          return studyUtils.telemetry(payload);
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
         * @returns {Promise<Number>} The total size of the ping.
         */
        calculateTelemetryPingSize: async function calculateTelemetryPingSize(
          payload,
        ) {
          return studyUtils.calculateTelemetryPingSize(payload);
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
          const { TelemetryArchive } = ChromeUtils.import(
            "resource://gre/modules/TelemetryArchive.jsm",
            {},
          );
          const { searchTelemetryArchive } = require("./telemetry.js");
          return searchTelemetryArchive(TelemetryArchive, searchTelemetryQuery);
        },

        /* Using AJV, do jsonschema validation of an object.  Can be used to validate your arguments, packets at client. */
        validateJSON: async function validateJSON(someJson, jsonschema) {
          utilsLogger.debug("called validateJSON someJson, jsonschema");
          return studyUtils.jsonschema.validate(someJson, jsonschema);
          // return { valid: true, errors: [] };
        },

        /* Annotates the supplied survey base url with common survey parameters (study name, variation, updateChannel, fxVersion, add-on version and client id) */
        fullSurveyUrl: async function fullSurveyUrl(surveyBaseUrl, reason) {
          utilsLogger.debug(
            "Called fullSurveyUrl(surveyBaseUrl, reason)",
            surveyBaseUrl,
            reason,
          );
          return studyUtils.fullSurveyUrl(surveyBaseUrl, reason);
        },

        /* Returns an object with the following keys:
    variationName - to be able to test specific variations
    firstRunTimestamp - to be able to test the expiration event
    expired - to be able to test the behavior of an already expired study
  The values are set by the corresponding preference under the `extensions.${widgetId}.test.*` preference branch. */
        getTestingOverrides: async function getTestingOverrides() {
          utilsLogger.info(
            "The preferences that can be used to override study testing flags: ",
            testingOverrides.listPreferences(widgetId),
          );
          return testingOverrides.getTestingOverrides(widgetId);
        },

        /**
         * Schema.json `events`
         *
         * See https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/events.html
         */

        /* Fires when the study is 'ready' for the feature to startup. */
        onReady: new EventManager(context, "study:onReady", fire => {
          const listener = (eventReference, studyInfo) => {
            fire.async(studyInfo);
          };
          studyApiEventEmitter.once("ready", listener);
          return () => {
            studyApiEventEmitter.off("ready", listener);
          };
        }).api(),

        /* Listen for when the study wants to end.
         *
         *  Act on it by
         *  - opening surveyUrls
         *  - tearing down your feature
         *  - uninstalling the add-on
         */
        onEndStudy: new EventManager(context, "study:onEndStudy", fire => {
          const listener = (eventReference, ending) => {
            fire.async(ending);
          };
          studyApiEventEmitter.on("endStudy", listener);
          return () => {
            studyApiEventEmitter.off("endStudy", listener);
          };
        }).api(),

        logger: {
          /* Corresponds to console.info */
          info: async function info(values) {
            addonLogger.info(values);
          },

          /* Corresponds to console.log */
          log: async function log(values) {
            addonLogger.log(values);
          },

          /* Corresponds to console.debug */
          debug: async function debug(values) {
            addonLogger.debug(values);
          },

          /* Corresponds to console.warn */
          warn: async function warn(values) {
            addonLogger.warn(values);
          },

          /* Corresponds to console.error */
          error: async function error(values) {
            addonLogger.error(values);
          },
        },
      },

      studyDebug: {
        throwAnException(message) {
          throw new ExtensionError(message);
        },

        async throwAnExceptionAsync(message) {
          throw new ExtensionError(message);
        },

        async setActive() {
          return studyUtils.setActive();
        },

        async startup({ reason }) {
          return studyUtils.startup({ reason });
        },

        async setFirstRunTimestamp(timestamp) {
          return studyUtils.setFirstRunTimestamp(timestamp);
        },

        async reset() {
          return studyUtils.reset();
        },

        async getInternals() {
          return studyUtils._internals;
        },

        getInternalTestingOverrides: async function getInternalTestingOverrides() {
          return testingOverrides.getInternalTestingOverrides(widgetId);
        },
      },
    };
  }
};
