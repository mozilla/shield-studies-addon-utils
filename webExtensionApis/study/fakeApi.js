/* eslint-disable */

ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");

// eslint-disable-next-line no-undef
const { EventManager } = ExtensionCommon;
// eslint-disable-next-line no-undef
const { EventEmitter } = ExtensionUtils;

this.study = class extends ExtensionAPI {
  getAPI(context) {
    return {
      study: {
        /* Attempt an setup/enrollment, with these effects:

- sets 'studyType' as Shield or Pioneer
  - affects telemetry
  - watches for dataPermission changes that should *always*
    stop that kind of study

- Use or choose variation
  - `testing.variation` if present
  - OR deterministicVariation
    for the studyType using `weightedVariations`

- During firstRun[1] only:
  - set firstRunTimestamp pref value
  - send 'enter' ping
  - if `allowEnroll`, send 'install' ping
  - else endStudy("ineligible") and return

- Every Run
  - setActiveExperiment(studySetup)
  - monitor shield | pioneer permission endings
  - suggests alarming if `expire` is set.

Returns:
- info object (see `info`)

Telemetry Sent

Fires Events

(At most one of)
- study:ready  OR
- study:endStudy

Prefs set
- first run

Note:
1. first run is evaluated based on a pref  `shield.${id}.firstRunTimestamp`
2. allowEnroll is ONLY used during first run (install)
 */
        setup: async function setup(studySetup) {
          console.log("called setup studySetup");
          return undefined;
        },

        /* Optionally opens url, then ends study with pings ending, exit.  Study can only have one ending.  Uninstalls addon? */
        endStudy: async function endStudy(anEndingName, anEndingObject) {
          console.log("called endStudy anEndingName, anEndingObject");
          return { urls: ["url1", "url2"], endingName: "some-reason" };
        },

        /* current study configuration, including
- variation
- activeExperimentName
- timeUntilExpire
- firstRunTimestamp

But not:
- telemetry clientId

Throws Error if called before `browser.study.setup`
 */
        info: async function info() {
          console.log("called info ");
          return { variation: "styleA" };
        },

        /* object of current dataPermissions with keys shield, pioneer, telemetry, 'ok' */
        getDataPermissions: async function getDataPermissions() {
          console.log("called getDataPermissions ");
          return { shield: true, pioneer: false, telemetry: true };
        },

        /* @TODO no description given */
        sendTelemetry: async function sendTelemetry(payload, pingType) {
          console.log("called sendTelemetry payload, pingType");
          return "undefined";
        },

        /* for isEligible, testing, and other uses, get recent stored Telemetry pings */
        getSentTelemetry: async function getSentTelemetry(
          telemetrySelectionOptions,
        ) {
          console.log("called getSentTelemetry telemetrySelectionOptions");
          return [{ pingType: "main" }];
        },

        /* @TODO no description given */
        deterministicVariation: async function deterministicVariation(
          weightedVariations,
          algorithm,
          fraction,
        ) {
          console.log(
            "called deterministicVariation weightedVariations, algorithm, fraction",
          );
          return "styleA";
        },

        /* Format url with study covariate queryArgs appended / mixed in.

Use this for constructing midpoint surveys.
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

        // https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/events.html
        /* Fires whenever any 'dataPermission' changes, with the new dataPermission object.  Allows watching for shield or pioneer revocation. */
        onDataPermissionsChange: new EventManager(
          context,
          "study.onDataPermissionsChange",
          fire => {
            const callback = value => {
              fire.async(value);
            };
            // RegisterSomeInternalCallback(callback);
            return () => {
              // UnregisterInternalCallback(callback);
            };
          },
        ).api(),

        // https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/events.html
        /* Fires when the study is 'ready' for the feature to startup. */
        onReady: new EventManager(context, "study.onReady", fire => {
          const callback = value => {
            fire.async(value);
          };
          // RegisterSomeInternalCallback(callback);
          return () => {
            // UnregisterInternalCallback(callback);
          };
        }).api(),

        // https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/events.html
        /* Listen for when the study wants to end */
        onEndStudy: new EventManager(context, "study.onEndStudy", fire => {
          const callback = value => {
            fire.async(value);
          };
          // RegisterSomeInternalCallback(callback);
          return () => {
            // UnregisterInternalCallback(callback);
          };
        }).api(),
      },
    };
  }
};
