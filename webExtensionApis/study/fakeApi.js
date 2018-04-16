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
      
      /* Configure the study.

- Validate the study configuation, so that all fields needed for study lifecycle telemetry are present.
 */
      setup: async function setup  ( studySetup ) {
        console.log(called, "setup", studySetup);
        return undefined;
      },

      /* all for side effects (sending 'install', 'enter') pings */
      install: async function install  (  ) {
        console.log(called, "install", );
        return undefined;
      },

      /* all for side effects (setActiveExperiment) */
      startup: async function startup  (  ) {
        console.log(called, "startup", );
        return undefined;
      },

      /* Optionally opens url, then ends study with pings ending, exit.  Study can only have one ending.  Uninstalls addon? */
      endStudy: async function endStudy  ( anEndingName, anEndingObject ) {
        console.log(called, "endStudy", anEndingName, anEndingObject);
        return "endingName";
      },

      /* current study configuration, including set variation, activeExperimentName */
      info: async function info  (  ) {
        console.log(called, "info", );
        return {"variation":"styleA"};
      },

      /* object of current dataPermissions with keys shield, pioneer, telemetry, 'ok' */
      dataPermissions: async function dataPermissions  (  ) {
        console.log(called, "dataPermissions", );
        return {"shield":true,"pioneer":false};
      },

      /* @TODO no description given */
      sendTelemetry: async function sendTelemetry  ( payload, type ) {
        console.log(called, "sendTelemetry", payload, type);
        return "undefined";
      },

      /* for isEligible, testing, and other uses, get recent stored Telemetry pings */
      getTelemetry: async function getTelemetry  ( telemetrySelectionOptions ) {
        console.log(called, "getTelemetry", telemetrySelectionOptions);
        return [{"pingType":"main"}];
      },

      /* @TODO no description given */
      deterministicVariation: async function deterministicVariation  ( weightedVariations, algorithm, fraction ) {
        console.log(called, "deterministicVariation", weightedVariations, algorithm, fraction);
        return "styleA";
      },

      /* Format url with study covariate queryArgs appended / mixed in.

Use this for constructing midpoint surveys.
 */
      surveyUrl: async function surveyUrl  ( baseUrl ) {
        console.log(called, "surveyUrl", baseUrl);
        return "https://example.com?version=59.0&branch=studyA";
      },

      /* Using AJV, do jsonschema validation of an object.  Can be used to validate your arguments, packets at client. */
      validateJSON: async function validateJSON  ( someJson, jsonschema ) {
        console.log(called, "validateJSON", someJson, jsonschema);
        return {"valid":true,"errors":[]};
      },

      
      // https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/events.html
      /* Fires whenever any 'dataPermission' changes, with the new dataPermission object.  Allows watching for shield or pioneer revocation. */
      onDataPermissionsChange: new EventManager(
        context,
        "study.onDataPermissionsChange", fire => {
        const callback = value => {
          fire.async(value);
        };
        // RegisterSomeInternalCallback(callback);
        return () => {
          // UnregisterInternalCallback(callback);
        };
      }).api()
      
    }
  }
}