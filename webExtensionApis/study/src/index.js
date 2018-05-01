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
    studyInfo.isFirstRun = true;
    this.emit("ready", studyInfo);
  }

  emitEndStudy(ending) {
    this.emit("endStudy", ending);
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
  }

  /**
   * Extension Shutdown
   * APIs that allocate any resources (e.g., adding elements to the browser’s
   * user interface, setting up internal event listeners, etc.) must free
   * these resources when the extension for which they are allocated is
   * shut down.
   *
   * @param {string} shutdownReason one of the reasons
   * @returns {undefined} TODO TODO
   */
  onShutdown(shutdownReason) {
    console.log("onShutdown", shutdownReason);
    // TODO: debootstrap study
  }

  /**
   * @param {object} context the addon context
   * @returns {object} api with study, studyTest keys
   */
  getAPI(context) {
    const { studyUtils } = require("./studyUtils.js");
    // const { PioneerUtils } = require("pioneer-utils/PioneerUtils.jsm");
    // const pioneerUtilsBootstrap = require("./pioneerUtilsBootstrap.js");

    const { extension } = this;

    const studyApiEventEmitter = new StudyApiEventEmitter();

    return {
      study: {
        /**
         * Schema.json `functions`
         */

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
         **/
        setup: async function setup(studySetup) {
          // TODO check all return values

          // TODO move more of this into utils.

          // 1. augment setup with addon info
          studySetup.addon = {
            id: extension.manifest.applications.gecko.id,
            version: extension.manifest.version,
          };

          studyUtils.setup(studySetup);

          if (!studySetup.testing) {
            studySetup.testing = {};
          }

          // not set variation
          const variation =
            studySetup.weightedVariations[studySetup.testing.variation] ||
            (await studyUtils.deterministicVariation(
              studySetup.weightedVariations,
            ));

          studyUtils.setVariation(variation);

          // TODO move more of this into studyUtils
          const { startupReason } = extension;
          console.debug("startup", startupReason);

          // make sure the variation name is set

          // Check if the user is eligible to run this study using the |isEligible|
          // function when the study is initialized
          if (
            startupReason === "ADDON_INSTALL" ||
            startupReason === "ADDON_UPGRADE"
          ) {
            //  telemetry "enter" ONCE
            studyUtils.firstSeen();
            if (!studySetup.allowEnroll) {
              console.debug("User is ineligible, ending study.");
              // 1. uses studySetup.endings.ineligible.url if any,
              // 2. sends UT for "ineligible"
              // 3. then uninstalls addon
              await studyUtils.endStudy({ reason: "ineligible" });
              return;
            }
          }

          // TODO, allow this key
          if (studySetup.testing.expired) {
            await studyUtils.endStudy({ reason: "expired" });
            return;
          }

          /*
          * Adds the study to the active list of telemetry experiments,
          * and sends the "installed" telemetry ping if applicable
          */
          await studyUtils.startup({ reason: startupReason });

          // log what the study variation and other info is.
          console.debug(`info ${JSON.stringify(studyUtils.info())}`);

          try {
            const studyInfo = studyUtils.info();
            // TODO: Only set true on first run
            // TODO: glind info should KNOW first run
            const isFirstRun = true;
            studyApiEventEmitter.emitReady(studyInfo, isFirstRun);
            return;
          } catch (e) {
            console.error("browser.study.setup error");
            console.error(e);
          }
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
         *  `browser.study` will choose the
         **/
        endStudy: async function endStudy(anEndingAlias, anEndingObject) {
          // TODO: glind handle 2nd time call
          console.log("called endStudy anEndingAlias");
          return studyUtils.endStudy({
            reason: anEndingAlias,
            fullname: anEndingAlias,
          });
          // return { urls: ["url1", "url2"], endingName: "some-reason" };
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
          /*
          return {
            variation: "styleA",
            firstRunTimestamp: 1523968204184,
            activeExperimentName: "some experiment",
            timeUntilExpire: null,
          };
          */
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
         */
        async searchSentTelemetry(searchTelemetryQuery) {
          Components.utils.import(
            "resource://gre/modules/TelemetryArchive.jsm",
          );
          const { searchTelemetryArchive } = require("./telemetry.js");
          return searchTelemetryArchive(
            ExtensionError,
            TelemetryArchive,
            searchTelemetryQuery,
          );
        },

        /* Choose a element from `weightedVariations` array
         *  based on various hashes of clientId
         *
         *  - shield:  TBD
         *  - pioneer: TBD
         */
        deterministicVariation: async function deterministicVariation(
          weightedVariations,
          algorithm,
          fraction,
        ) {
          console.log(
            "called deterministicVariation weightedVariations, algorithm, fraction",
          );
          return await studyUtils.deterministicVariation(
            weightedVariations,
            fraction,
          );
          // return "styleA";
        },

        /** Format url with study covariate queryArgs appended / mixed in.
         *
         *  Use this for constructing midpoint surveys.
         */
        surveyUrl: async function surveyUrl(baseUrl, additionalFields) {
          console.log("called surveyUrl baseUrl, additionalFields");
          return "https://example.com?version=59.0&branch=studyA";
        },

        /* Using AJV, do jsonschema validation of an object.  Can be used to validate your arguments, packets at client. */
        validateJSON: async function validateJSON(someJson, jsonschema) {
          console.log("called validateJSON someJson, jsonschema");
          return { valid: true, errors: [] };
        },

        /* @TODO no description given */
        log: async function log(thingToLog) {
          console.log("called log thingToLog");
          return undefined;
        },

        /**
         * Schema.json `events`
         */

        // https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/events.html
        /* Fires whenever any 'dataPermission' changes, with the new dataPermission object.  Allows watching for shield or pioneer revocation. */
        onDataPermissionsChange: new EventManager(
          context,
          "study:onDataPermissionsChange",
          fire => {
            const listener = (eventReference, updatedPermissions) => {
              fire.async(updatedPermissions);
            };
            studyApiEventEmitter.on("dataPermissionsChange", listener);
            return () => {
              studyApiEventEmitter.off("dataPermissionsChange", listener);
            };
          },
        ).api(),

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

        async firstSeen() {
          return studyUtils.firstSeen();
        },

        async setActive() {
          return studyUtils.setActive();
        },

        async startup({ reason }) {
          return studyUtils.startup({ reason });
        },

        async reset() {
          // return studyUtils.reset();
        },
      },
    };
  }
};
