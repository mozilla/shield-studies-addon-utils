/** feature.js **/
const prefSvc = require("sdk/preferences/service");

const ourpref = 'some.pref.somewhere';

exports.which = function (val) {
  prefSvc.set(ourpref, val);
  return val;
}

exports.ineligible = function () {
  return prefSvc.isset(ourpref);
}

exports.reset = function () {
  return prefSvc.reset(ourpref);
}
