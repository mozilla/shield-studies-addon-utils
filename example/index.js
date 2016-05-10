const xutils = require("./shield-studies-addon-utils")
const variationsMod = require("./variations");

// configuration / setup constants.  These are only ones needed.
const forSetup = {
  name: "Example Study 1",
  choices: Object.keys(variationsMod.variations), // names of branches.
  duration: 7,   // in days,
  surveyUrl: "https://qsurvey.mozilla.com/s3/ExampleStudy"
};

function main (options, callback) {
  xutils.generateTelemetryIdIfNeeded().then(function () {
    var xconfig = xutils.xsetup(forSetup);  // call first.
    xutils.handleStartup(options, xconfig, variationsMod);
  })
  // addon specific load code should go here, if there is additional.
  console.log(`special addon loading code ${options}`)

}

// Annoying:  `onUnload` can get called multiple time during unload.
// force it to run only once.
// calling xsetup during teardown (more than once) cause pref setting bugs
var unloading = false;
function onUnload (reason) {
  if (unloading) return;
  unloading = true;
  var xconfig = xutils.xsetup(forSetup);  // call first.
  xutils.handleOnUnload(reason, xconfig, variationsMod);

  // if this addon has special unload code, put it here.
  console.log(`special addon unloading code: ${reason}`)
}

exports.main = main;
exports.onUnload = onUnload
