/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "studyConfig|allowEnroll" }]*/

// put the config in the scope so that background can see it.
const studyConfig = {
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

  expire: {
    days: 14,
  },

  // // Optional: testing overrides.
  // testing: {
  //  variation: "feature-active",
  //  firstrunTimestamp: 500,
  // }
};

async function allowEnroll() {
  // cached answer for 2nd run
  let allowed = await browser.storage.local.get("allowedToEnroll");
  if (allowed) return true;

  /* First run, we must calculate the answer.
     If false, the study will endStudy with 'ineligible' during `setup`
  */

  // could have other reasons to be eligible, such addons, prefs
  const dataPermissions = await browser.study.dataPermissions();
  allowed = dataPermissions.shield;

  // cache the answer
  await browser.storage.local.set({ allowedToEnroll: allowed });
  return allowed;
}
