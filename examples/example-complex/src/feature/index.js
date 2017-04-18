/** feature.js **/

const tabs = require('sdk/tabs');
const prefSvc = require("sdk/preferences/service");

const button = require("./button");

let _ourButton;

exports.which = function whichFeature (choice) {
  // do feature work
  // use a var to make this safe to multicall
  if (!_ourButton) _ourButton = new button.FeatureButton(choice);
  console.log("feature is", choice);
}

exports.orientation = function orientation (choice) {
  return tabs.open(`data:text/html,You are on choice ${choice}. See the button?  Do that! Stop by, use by etc`)
}

exports.isEligible = function () {
  return !prefSvc.isSet('some.pref.somewhere');
}

exports.cleanup = function (variation) {
  tabs.open(`data:text/html,We cleaned up from ${variation}`);
}

exports.telemetry = require("./telemetry");
