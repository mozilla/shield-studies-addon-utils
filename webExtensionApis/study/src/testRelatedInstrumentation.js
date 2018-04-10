const { utils: Cu } = Components;
Cu.import("resource://gre/modules/TelemetryEnvironment.jsm");

export async function studySetupForTests() {
  // Minimal configuration to pass schema validation
  const studySetup = {
    study: {
      studyName: "shield-utils-test",
      endings: {
        ineligible: {
          baseUrl: "http://www.example.com/?reason=ineligible",
        },
      },
      telemetry: {
        send: true, // assumed false. Actually send pings?
        removeTestingFlag: false, // Marks pings to be discarded, set true for to have the pings processed in the pipeline
        // TODO "onInvalid": "throw"  // invalid packet for schema?  throw||log
      },
    },
    weightedVariations: [
      {
        name: "control",
        weight: 1,
      },
    ],
  };

  // Set dynamic study configuration flags
  studySetup.eligible = true;
  studySetup.expired = false;

  return studySetup;
}

export async function getActiveExperiments() {
  return TelemetryEnvironment.getActiveExperiments();
}

export default {
  studySetupForTests,
  getActiveExperiments,
};
