let prefSvc = require("sdk/preferences/service");
let prefs = require("sdk/simple-prefs").prefs;

const OURPREF = 'some.experimental.pref';

const variations = {
  'aggressive':  function () {
    prefSvc.set(OURPREF,10);
  },
  // "usual treatment" => "control" with a less obvious name
  'ut':  () => {}  // 250  // ut:: usual treatment
}

function isEligible () {
  //boolean : Returns whether or not the application preference name both exists and has been set to a non-default value by the user (or a program acting on the user's behalf).
  return !prefSvc.isSet(OURPREF);
}

function cleanup () {
  prefSvc.reset(OURPREF); // resets to string!
}

module.exports = {
  isEligible: isEligible,
  cleanup: cleanup,
  variations: variations,
}
