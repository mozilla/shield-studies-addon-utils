/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "STUDYSETUP|isEligible" }]*/

// put the config in the scope so that background can see it.
const STUDYSETUP = (this.STUDYSETUP = {
  // activeExperimentsTag
  activeExperimentName: "demoStudy",

  // uses shield|pioneer pipeline, watches those permissions
  pattern: "shield",

  // telemetry
  telemetry: {
    send: true, // assumed false. Actually send pings?
    removeTestingFlag: false, // Marks pings as testing, set true for actual release
  },

  // endings with urls
  endings: {
    /** standard endings */
    "user-disable": {
      baseUrl: "http://www.example.com/?reason=user-disable",
    },
    ineligible: {
      baseUrl: "http://www.example.com/?reason=ineligible",
    },
    expired: {
      baseUrl: "http://www.example.com/?reason=expired",
    },
    dataPermissionsRevoked: {
      baseUrl: null,
      study_state: "ended-neutral",
    },

    /** User defined endings */
    "some-study-defined-ending": {
      study_state: "ended-neutral",
      baseUrl: null,
    },
  },

  // logging
  logLevel: 10,

  /* Study branches and sample weights, overweighing feature branches */
  weightedVariations: [
    {
      name: "feature-active",
      weight: 1.5,
    },
    {
      name: "feature-passive",
      weight: 1.5,
    },
    {
      name: "control",
      weight: 1,
    },
  ],

  // Optional: variation override.
  // variationOverride: "feature-active",
  // firstrunTimestampOverride:  // from a pref, for testing sidecases
});

async function isEligible() {
  const dataPermissions = await browser.study.dataPermissions();
  // could have other reasons to be eligible, such as addons or whatever
  return dataPermissions.shield;
}
