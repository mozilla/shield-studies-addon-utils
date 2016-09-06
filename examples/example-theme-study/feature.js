/** feature.js **/

const tabs = require('sdk/tabs');

exports.which = function whichFeature (choice) {
  // do feature work
  console.log("feature is", choice);
}

exports.orientation = function orientation (choice) {
  return tabs.open(`data:text/html,You are on choice {choice}.  Stop by, use by etc`)
}

