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
const baseStudySetup = {
  // used for activeExperiments tagging (telemetryEnvironment.setActiveExperiment)
  activeExperimentName: browser.runtime.id,

  // uses shield sampling and telemetry semantics.  Future: will support "pioneer"
  studyType: "shield",

  // telemetry
  telemetry: {
    // default false. Actually send pings.
    send: true,
    // Marks pings with testing=true.  Set flag to `true` before final release
    removeTestingFlag: false,
  },

  // endings with urls
  endings: {
    /** standard endings */
    "user-disable": {
      baseUrls: [
        "https://qsurvey.mozilla.com/s3/Shield-Study-Example-Survey/?reason=user-disable",
      ],
    },
    ineligible: {
      baseUrls: [
        "https://qsurvey.mozilla.com/s3/Shield-Study-Example-Survey/?reason=ineligible",
      ],
    },
    expired: {
      baseUrls: [
        "https://qsurvey.mozilla.com/s3/Shield-Study-Example-Survey/?reason=expired",
      ],
    },

    /** Study specific endings */
    "user-used-the-feature": {
      baseUrls: [
        "https://qsurvey.mozilla.com/s3/Shield-Study-Example-Survey/?reason=user-used-the-feature",
      ],
      category: "ended-positive",
    },
    "hated-the-feature": {
      baseUrls: [
        "https://qsurvey.mozilla.com/s3/Shield-Study-Example-Survey/?reason=hated-the-feature",
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
    variation: null,
    firstRunTimestamp: null,
  },
};

/**
 * Determine, based on common and study-specific criteria, if enroll (first run)
 * should proceed.
 *
 * False values imply that *during first run only*, we should endStudy(`ineligible`)
 *
 * Add your own enrollment criteria as you see fit.
 *
 * (Guards against Normandy or other deployment mistakes or inadequacies).
 *
 * This implementation caches in local storage to speed up second run.
 *
 * @returns {Promise<boolean>} answer An boolean answer about whether the user should be
 *       allowed to enroll in the study
 */
async function cachingFirstRunShouldAllowEnroll() {
  // Cached answer.  Used on 2nd run
  let allowed = await browser.storage.local.get("allowEnroll");
  if (allowed) return true;

  /*
  First run, we must calculate the answer.
  If false, the study will endStudy with 'ineligible' during `setup`
  */

  // could have other reasons to be eligible, such add-ons, prefs
  allowed = true;

  // cache the answer
  await browser.storage.local.set({ allowEnroll: allowed });
  return allowed;
}

/**
 * Augment declarative studySetup with any necessary async values
 *
 * @return {object} studySetup A complete study setup object
 */
async function getStudySetup() {
  /*
   * const id = browser.runtime.id;
   * const prefs = {
   *   variation: `shield.${id}.variation`,
   *   firstRunTimestamp: `shield.${id}.firstRunTimestamp`,
   *   };
   */

  // shallow copy
  const studySetup = Object.assign({}, baseStudySetup);

  studySetup.allowEnroll = await cachingFirstRunShouldAllowEnroll();
  studySetup.testing = {
    /* Example: override testing keys various ways, such as by prefs. (TODO) */
    variation: null, // await browser.prefs.getStringPref(prefs.variation);
    firstRunTimestamp: null, // await browser.prefs.getStringPref(prefs.firstRunTimestamp);
  };
  return studySetup;
}
