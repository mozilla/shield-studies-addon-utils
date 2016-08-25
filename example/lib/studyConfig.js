/**!
  *## `studyConfig`
  *
  *### About this (particular) example study:
  *
  * - will expire after 7 days
  * - what will change:
  *
  *    - 4 variations: strong, subtle, observe-only, ut
  *    - (note: this pref is fake and does nothing)
  *
  * - isEligible for study IFF the preference is not already user set
  * - cleanup plan:  reset the pref.
  * - survey on SurveyGizmo
  *
  *### General Study Configuration
  *
  *  Study configuration requires an object with these 6 keys (explained below):
  *
  *  - `name`:  **string** telemetry probe name
  *  - `duration`: **number** in days, time before study 'finishes' and uninstalls
  *  - `surveyUrl`: **string** (optional) a url for post-expiry and post-study survey
  *  - `isEligible`: **function** should study install?
  *  - `cleanup`: **functiion** repair/reset on uninstall / finish
  *  - `variations`: **object** of 'implemntation' functions
  *
  *  In this example file, we export an object for use by `index.js`
  */

"use strict";

const prefSvc = require("sdk/preferences/service");
const OURPREF = 'some.newfeature.design';

/* `name`: a string for use by Telemetry to track the study. */
const name = require("sdk/self").id;

/* `duration`:  length of study in days (on user local clock) */
const duration = 7;

/* `surveyUrl`:  Get surveyUrl from Firefox Strategy + Insights */
const surveyUrl = "https://qsurvey.mozilla.com/s3/Shield-Study-Example-Survey";

/** `variations`:  Object to implement feature
  *
  * `name`: `function` pairs to DO THE ACTION
  *
  *  - specific user variation will be randomly chosen from the NAMES
  *    in this object, with equal probability
  *  - specific function will be called for user to implement variation
  *  - called at each startup.
  *  - functions must be multi-callable safely
  */
const variations = {
  'strong':       () => {prefSvc.set(OURPREF, 'strong')},
  'subtle':       () => {prefSvc.set(OURPREF, 'subtle')},
  'observe-only': () => {prefSvc.set(OURPREF, 'observe-only')},
  'ut': () => {}  // "usual treatment" => "control", less obvious name
}

/** `isEligible`: is the User Eligible to participate at all ?
  *
  * Called during INSTALL startups only.
  *
  * Could be any function of user state, history, addons, etc.
  *
  * Useful to exclude users with known incompatible or irrelevant
  * configurations, such as:
  *
  * - users with a password manager from a pw study
  * - users with some incompatible pref settings
  * - users with telemetry disabled
  */
function isEligible () {
  return !prefSvc.isSet('some.pref.that.if.set.excludes.user');
}

/** `cleanup`: Cleanup to run during uninstall, disable, and end-of-study-period.
  *
  * Should attempt to reset the user to original state.
  *
  * If these `throw`, uninstall will continue.
  */
function cleanup () {
  prefSvc.reset(OURPREF);
}

/* create the config (verbose) */
const aStudyConfig = {
  name: name,
  duration: duration,
  surveyUrl: surveyUrl,
  isEligible: isEligible,
  cleanup: cleanup,
  variations: variations,
};

/* use it elsewhere:

  ```js
  var shield = require("shield-study-addon-utils");
  var aStudyConfig = require("./studyInfo");
  var ourStudy = shield.Study(aStudyConfig)
  ```
*/
module.exports = aStudyConfig;
