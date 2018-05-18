/* eslint-env commonjs */

/* eslint no-console: off */
// TODO, pref controlled logger

/* global ExtensionAPI */

ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");

// eslint-disable-next-line no-undef
const { EventManager } = ExtensionCommon;
// eslint-disable-next-line no-undef
const { EventEmitter, ExtensionError } = ExtensionUtils;

/** Event emitter to handle Events defined in the API
 *
 * - onReady
 * - onEndStudy
 *
 * onDataPermissionChange is handled more directly
 */
class StudyApiEventEmitter extends EventEmitter {
  emitDataPermissionsChange(updatedPermissions) {
    this.emit("dataPermissionsChange", updatedPermissions);
  }

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
    const { studyUtils } = require("./studyUtils.js");
    this.studyUtils = studyUtils;
    // const { PioneerUtils } = require("pioneer-utils/PioneerUtils.jsm");
    // const pioneerUtilsBootstrap = require("./pioneerUtilsBootstrap.js");
    this.studyApiEventEmitter = new StudyApiEventEmitter();
    console.log("constructed!");
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
   * @returns {undefined} TODO TODO
   */
  async onShutdown(shutdownReason) {
    // let {extension} = this;
    // let {manifest} = extension;
    console.log("possible uninstalling", shutdownReason);
    if (shutdownReason === "ADDON_UNINSTALL") {
      console.log("definitely uninstalling", shutdownReason);
      const anEndingAlias = "user-disable";
      const endingResponse = await this.studyUtils.endStudy(anEndingAlias);
      await this.studyApiEventEmitter.emitEndStudy(endingResponse);
    }
  }

  /**
   * @param {object} context the addon context
   * @returns {object} api with study, studyTest keys
   */
  getAPI(context) {
    const { extension } = this;
    const { studyUtils, studyApiEventEmitter } = this;

    // once.  Used for pref naming, telemetry
    studyUtils.setExtensionManifest(extension.manifest);
    studyUtils.reset();

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

          // 1. addon info for prefs etc.
          studyUtils.setExtensionManifest(extension.manifest);

          // Setup and sets the variation / _internals
          // incldues possible 'firstRun' handling.
          await studyUtils.setup(studySetup);

          // current studyInfo.
          let studyInfo = studyUtils.info();

          // Check if the user is eligible to run this study using the |isEligible|
          // function when the study is initialized
          if (studyInfo.isFirstRun) {
            if (!studySetup.allowEnroll) {
              console.debug("User is ineligible, ending study.");
              // 1. uses studySetup.endings.ineligible.url if any,
              // 2. sends UT for "ineligible"
              // 3. then uninstalls addon
              await studyUtils.endStudy("ineligible");
              return studyUtils.info();
            }
          }

          if (studySetup.testing.expired) {
            await studyUtils.endStudy("expired");
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
          console.debug(`api info: ${JSON.stringify(studyInfo)}`);
          try {
            studyApiEventEmitter.emitReady(studyInfo);
          } catch (e) {
            console.error("browser.study.setup error");
            console.error(e);
          }
          return studyUtils.info();
        },

        /* Signal to browser.study that it should end.
         *
         *  Usage scenarios:
         *  - addons defined
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
         *  - uninstall the addon
         *
         *  Note:
         *  1.  calling this function multiple time is safe.
         *  `browser.study` will choose the first in.
         *  2.  the 'user-disable' case is handled above
         *  3.  throws if the endStudy fails
         **/
        endStudy: async function endStudy(anEndingAlias) {
          console.log("called endStudy anEndingAlias");
          const endingResponse = await studyUtils.endStudy(anEndingAlias);
          studyApiEventEmitter.emitEndStudy(endingResponse);
        },

        /* current study configuration, including
         *  - variation
         *  - activeExperimentName
         *  - timeUntilExpire
         *  - firstRunTimestamp
         *
         *  But not:
         *  - telemetry clientId
         *
         *  Throws ExtensionError if called before `browser.study.setup`
         **/
        getStudyInfo: async function getStudyInfo() {
          console.log("called getStudyInfo ");
          return studyUtils.info();
        },

        /* object of current dataPermissions with keys shield, pioneer, telemetry, 'ok' */
        getDataPermissions: async function getDataPermissions() {
          console.log("called getDataPermissions ");
          return {
            shield: true,
            pioneer: false,
            telemetry: true,
            alwaysPrivateBrowsing: false,
          };
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
          console.log("called sendTelemetry payload");

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
          await studyUtils.telemetry(payload);
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
         *  - addon testing scenarios
         *
         * @param {Object<query>} searchTelemetryQuery see above
         * @returns {Array<sendTelemetry>} matchingPings
         */
        async searchSentTelemetry(searchTelemetryQuery) {
          const { TelemetryArchive } = ChromeUtils.import(
            "resource://gre/modules/TelemetryArchive.jsm",
          );
          const { searchTelemetryArchive } = require("./telemetry.js");
          return await searchTelemetryArchive(
            TelemetryArchive,
            searchTelemetryQuery,
          );
        },

        /* Using AJV, do jsonschema validation of an object.  Can be used to validate your arguments, packets at client. */
        validateJSON: async function validateJSON(someJson, jsonschema) {
          console.log("called validateJSON someJson, jsonschema");
          return studyUtils.jsonschema.validate(someJson, jsonschema);
          // return { valid: true, errors: [] };
        },

        /**
         * Schema.json `events`
         */

        // https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/events.html
        /* Fires whenever any 'dataPermission' changes, with the new dataPermission object.  Allows watching for shield or pioneer revocation. */
        // onDataPermissionsChange: new EventManager(
        //  context,
        //  "study:onDataPermissionsChange",
        //  fire => {
        //    const listener = (eventReference, updatedPermissions) => {
        //      fire.async(updatedPermissions);
        //    };
        //    studyApiEventEmitter.on("dataPermissionsChange", listener);
        //    return () => {
        //      studyApiEventEmitter.off("dataPermissionsChange", listener);
        //    };
        //  },
        // ).api(),

        // https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/events.html
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

        // https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/events.html
        /* Listen for when the study wants to end.
         *
         *  Act on it by
         *  - opening surveyUrls
         *  - tearing down your feature
         *  - uninstalling the addon
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
      },

      studyTest: {
        throwAnException(message) {
          throw new ExtensionError(message);
        },

        async throwAnExceptionAsync(message) {
          throw new ExtensionError(message);
        },

        async setFirstRunTimestamp(timestamp) {
          return studyUtils.setFirstRunTimestamp(timestamp);
        },

        async setActive() {
          return studyUtils.setActive();
        },

        async startup({ reason }) {
          return studyUtils.startup({ reason });
        },

        async reset() {
          return await studyUtils.reset();
        },

        async getInternals() {
          return studyUtils._internals;
        },
      },
    };
  }
};
