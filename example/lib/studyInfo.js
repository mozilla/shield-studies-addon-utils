/** # About this (particular) example study:
  *
  * - 2 'arms', `strong` and `ut`
  * - isEligible for study IFF the preference is not already user set
  * - cleanup plan:  reset the pref.
  *
  */

let prefSvc = require("sdk/preferences/service");
const OURPREF = 'some.experimental.pref';

const variations = {
  'strong':  function () {
    prefSvc.set(OURPREF,10);
  },
  // "usual treatment" => "control" with a less obvious name
  'ut':  () => {}
}

/** is the User Eligible?  Called during INSTALL startups */
function isEligible () {
  // boolean : specific to this study:  returns whether or not the application preference name both exists and has been set to a non-default value by the user (or a program acting on the user's behalf).
  return !prefSvc.isSet(OURPREF);
}

/** Cleanup to run during uninstall / removal.
  * Should attempt to reset the user to original state
  */
function cleanup () {
  // this study had only 1 effect, the pref.
  prefSvc.reset(OURPREF);
}

module.exports = {
  name: require("sdk/self").id, // unique for Telemetry
  duration: 7,   // in days,
  /* Get surveyUrl from Strategy + Insights */
  surveyUrl: "https://qsurvey.mozilla.com/s3/Shield-Study-Example-Survey",
  isEligible: isEligible,
  cleanup: cleanup,
  variations: variations,
};
