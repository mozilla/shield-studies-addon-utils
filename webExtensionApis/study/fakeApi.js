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

      /* Configure the study.  Most things can't work without this */
      async configure ( studySetup ) {
        console.log(called, "configure", studySetup);
        return undefined;
      }

      /* all for side effects (sending 'install', 'enter') pings */
      async install (  ) {
        console.log(called, "install", );
        return undefined;
      }

      /* all for side effects (setActiveExperiment) */
      async startup (  ) {
        console.log(called, "startup", );
        return undefined;
      }

      /* Optionally opens url, then ends study with pings ending, exit.  Study can only have one ending.  Uninstalls addon? */
      async endStudy ( anEnding ) {
        console.log(called, "endStudy", anEnding);
        return "endingName";
      }

      /* @TODO no description given */
      async info (  ) {
        console.log(called, "info", );
        return {"variation":"styleA"};
      }

      /* @TODO no description given */
      async permissions (  ) {
        console.log(called, "permissions", );
        return {"shield":true,"pioneer":false};
      }

      /* @TODO no description given */
      async sendTelemetry ( payload, type ) {
        console.log(called, "sendTelemetry", payload, type);
        return "undefined";
      }

      /* @TODO no description given */
      async getTelemetry ( telemetrySelectionOptions ) {
        console.log(called, "getTelemetry", telemetrySelectionOptions);
        return [{"pingType":"main"}];
      }

      /* @TODO no description given */
      async deterministicVariation ( weightedVariations, algorithm, fraction ) {
        console.log(called, "deterministicVariation", weightedVariations, algorithm, fraction);
        return "styleA";
      }

      /* @TODO no description given */
      async surveyUrl ( baseUrl ) {
        console.log(called, "surveyUrl", baseUrl);
        return "https://example.com?version=59.0&branch=studyA";
      }

      /* @TODO no description given */
      async validateJSON ( anObject, schema ) {
        console.log(called, "validateJSON", anObject, schema);
        return {"valid":true,"errors":[]};
      }


      // https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/events.html
      /* Fires whenever any 'permission' changes, with the new permissions object */
      onPermissionsChange: new EventManager(
        context,
        "study.onPermissionsChange", fire => {
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
