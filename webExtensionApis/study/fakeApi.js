
this.study = class extends ExtensionAPI {
  getAPI(context) {
    return {

        async configure ( studySetup ) {
          return undefined;
        }

        async simpleDeterministicVariation ( weightedVariations, fraction ) {
          return "styleA";
        }

        async endStudy ( anEnding ) {
          return "endingName";
        }

        async permissions (  ) {
          return {"shield":true,"pioneer":false};
        }

        async userInfo (  ) {
          return undefined;
        }

        async sendTelemetry ( payload, type ) {
          return "undefined";
        }

        async getTelemetry ( telemetrySelectionOptions ) {
          return [{"pingType":"main"}];
        }

        async setActiveExperiment (  ) {
          return undefined;
        }

        async unsetActiveExperiment (  ) {
          return undefined;
        }

        async getPref ( prefName ) {
          return "someValue";
        }

        async setPref ( prefName, prefType ) {
          return "someValue";
        }

        async watchPref ( prefName, prefType ) {
          return "[A function]";
        }

        async surveyUrl ( baseUrl ) {
          return "https://example.com?version=59.0";
        }

        async validateJSON ( anObject, schema ) {
          return {"isValid":true};
        }
    }
  }
}
