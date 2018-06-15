/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "getStudySetup" }]*/

/**
 *  Overview:
 *
 *  - constructs a well-formatted `studySetup` for use by `browser.study.setup`
 *  - mostly declarative, except that some fields are set at runtime
 *    asynchronously.
 *
 *  Advanced features:
 *  - testing overrides from preferences
 *  - expiration time
 *  - some user defined endings.
 *  - study defined 'shouldAllowEnroll' logic.
 */

/** Base for studySetup, as used by `browser.study.setup`.
 *
 * Will be augmented by 'getStudySetup'
 */
const studySetup = {
  // used for activeExperiments tagging (telemetryEnvironment.setActiveExperiment)
  activeExperimentName: browser.runtime.id,

  // uses shield|pioneer pipeline, watches those permissions
  studyType: "shield",

  // telemetry
  telemetry: {
    send: true, // assumed false. Actually send pings?
    removeTestingFlag: false, // Marks pings as testing, set true for actual release
  },

  // endings with urls
  endings: {
    /** standard endings */
    "user-disable": {
      baseUrls: ["http://www.example.com/?reason=user-disable"],
    },
    ineligible: {
      baseUrls: ["http://www.example.com/?reason=ineligible"],
    },
    expired: {
      baseUrls: ["http://www.example.com/?reason=expired"],
    },

    /** User defined endings */
    "some-study-defined-ending": {
      baseUrls: [],
      category: "ended-neutral",
    },
    "some-study-defined-ending-with-survey-url": {
      baseUrls: [
        "http://www.example.com/?reason=some-study-defined-ending-with-survey-url",
      ],
      category: "ended-negative",
    },
  },

  // Study branches and sample weights, overweighing feature branches
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

  // maximum time that the study should run, from the first run
  expire: {
    days: 14,
  },

  // Optional: testing overrides.
  // TODO: Set from prefs in getStudySetup
  testing: {
    variationName: null,
  },
};

/**
 * Determine, based on common and study-specific criteria, if enroll (first run)
 * should proceed.
 *
 * False values imply that during first run, we should endStudy(`ineligible`)
 *
 * Add your own enrollment criteria as you see fit.
 *
 * (Guards against Normandy or other deployment mistakes or inadequacies)
 *
 * This implementation caches in local storage to speed up second run.
 *
 * @returns {Promise<boolean>} answer An boolean answer about whether the user should be
 *       allowed to enroll in the study
 */
async function shouldAllowEnroll() {
  // Cached answer.  Used on 2nd run
  let allowed = await browser.storage.local.get("allowedToEnroll");
  if (allowed) return true;

  /*
  First run, we must calculate the answer.
  If false, the study will endStudy with 'ineligible' during `setup`
  */
  // could have other reasons to be eligible, such add-ons, prefs

  allowed = true;

  // cache the answer
  await browser.storage.local.set({ allowedToEnroll: allowed });
  return allowed;
}

/**
 * Augment declarative studySetup with any necessary async values
 *
 * @return {object} studySetup A complete study setup object
 */
async function getStudySetup() {
  /*
  const id = browser.runtime.id;
  const prefs = {
    variationName: `shield.${id}.variation`,
  };
  */
  studySetup.allowEnroll = await shouldAllowEnroll();
  studySetup.testing = {
    // variationName: await browser.prefs.getStringPref(prefs.variationName);
  };
  return studySetup;
}
