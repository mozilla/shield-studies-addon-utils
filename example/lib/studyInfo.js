/** # About this (particular) example study:
  *
  * - 4 variations: strong, subtle, observe-only, ut
  * - isEligible for study IFF the preference is not already user set
  * - cleanup plan:  reset the pref.
  *
  */

const prefSvc = require("sdk/preferences/service");
const OURPREF = 'some.newfeature.design';

/** name: function pairs to DO THE ACTION
  *
  *  - called at each startup.
  *  - function should be multi-callable safely
  */
const variations = {
  'strong':       () => {prefSvc.set(OURPREF, 'strong')},
  'subtle':       () => {prefSvc.set(OURPREF, 'subtle')},
  'observe-only': () => {prefSvc.set(OURPREF, 'observe-only')},
  'ut': () => {}  // "usual treatment" => "control", less obvious name
}

/** is the User Eligible to participate ?
  *
  * Called during INSTALL startups only.
  *
  * Could be any function of user state, history, addons, etc.
  */
function isEligible () {
  // boolean : specific to this study

  return !prefSvc.isSet('some.pref.that.if.set.excludes.user');
}


/** Cleanup to run during uninstall, disable, and end-of-study-period.
  *
  * Should attempt to reset the user to original state.
  */
function cleanup () {
  prefSvc.reset(OURPREF);  // only effect
}


/* study modules must have these 6 keys and types */
module.exports = {
  name: require("sdk/self").id, // affect Telemetry packets
  duration: 7,                  // in days,
  /* Get surveyUrl from Strategy + Insights */
  surveyUrl: "https://qsurvey.mozilla.com/s3/Shield-Study-Example-Survey",
  isEligible: isEligible,
  cleanup: cleanup,
  variations: variations,
};
