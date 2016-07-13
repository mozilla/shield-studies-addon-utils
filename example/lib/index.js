/**/

/*
# An Example (mostly) One-File Shield Study Addon

## GOALS of `shield-studies-addon-utils`

A **SHIELD STUDY**, with these features

1. instrumented (via unified telemetry)
   a. startup, shutdown, install, uninstall, usage by day

2. variations (branches, arms)

   a. assigned once
   b. with equal probabilty
   c. lasts across restarts

3. user experience and housekeeping

    a. disable ALSO uninstalls.
    b. addon self-destructs (uninstalls) after D days
    c. surveygizmo survey at end of study.


## tl;dr PREP WORK

1. decide

    - STUDY NAME
    - length of study

2. facade your feature init code to

   - take variations/config
   - be safely multicallable

3.  Make sure your addon is `addon-sdk`.
    No guarantees are made for other `bootstrap` addons.

4.  let `studytutils.handleStartup` and `studyutils.handleShutdown`
    do all the work of actually starting and stopping the feature code at the
    right times.
*/


/*
  ## 0. module for STUDY
*/
const studyutils = require("shield-studies-addon-utils");


/*
  ## 1a. import your feature.

  You already made a feature.  It does things to firefox.
*/
const feature = require("./feature");

/* Your feature can be called or run in different ways, examples:

  ` feature.init(someConfig);
    feature.start(someConfig);
    feature[variationName]()
  `

  This *particular feature* has `feature.start(config)` as the interface.
*/

/*
  ## 2.`variations` object that the study can use.

  Needs these keys:
    choices
    shouldInstall
    cleanupAfterStudy

  or an externalfile like:

  ```
  const studyVariations = require("./variations")
  ```

*/

/*
  ### 2a. a little helper function, specific to this feature.
*/
let _attemptingFeature = false;
function doFeature (config) {   // must be safe to call more than once.
  if (_attemptingFeature) return;
  _attemptingFeature = true
  return feature.start(config)
}

/*
   ### 2b: an example variations object / module

   Needs these keys:

   - choices
   - shouldInstall
   - cleanupAfterStudy
*/

/* choices:

  Dict of 'name' and function.

  Functions must be safe to call more than once.

  Functions 'do all the work' of the feature.

  Called during INSTALL, UPGRADE, STARTUP.

  Key names aren't special.
*/

let choices = {
  'text 1':  function () { doFeature({text: 'enhance'}) },
  'text 2':  function () { doFeature({text: 'add gravy'}) },
  'button':  function () { doFeature({button: true}) },
  'ut':   function () {}  // ut => 'usual treatment' (control)
},

/*
  ### shouldStartStudy

  boolean about whether the user should even be in the study

  Called during INSTALL startups.

  Process user profile, addons, history, phase of moon whatever

  FALSE if DONT INSTALL.  will send 'ineligible' and auto-destruct the addon.
*/
function shouldStartStudy () {
  let ans = true;
  return ans
},

/*
  ### cleanupAfterStudy

  Called during UNINSTALL, DISABLE or 'END-OF-STUDY'

  Clean up any set prefs, etc.
*/
function cleanupAfterStudy () {
  feature.cleanup();
}

/*
  ### the variations object.
*/
const studyVariations = {
  chioces: choices,
  cleanupAfterStudy: cleanupAfterStudy,
  shouldStartStudy: shouldStartStudy
}


/* ## 3. configuration / setup constants for the study.
 *
 * These are only ones needed, or supported
 */
const forSetup = {
  name: "Example Study 1", // unique for Telemetry
  choices: Object.keys(studyVariations.choices), // names of branches.
  duration: 7,   // in days,
  /* Get surveyUrl from Strategy + Insights */
  surveyUrl: "https://qsurvey.mozilla.com/s3/Shield-Study-Example-Survey"
};

/* ## 4. Study Object (module singleton);

  a. at this point, nothing has yet run.
  b. we will have a CONSISTENT branch across restarts.
  c. puts variation name, study name into reporting
*/
var ourStudyConfig = studyutils.chooseOrUseVariation(forSetup);
let thisStudy = new studyutils.Study(ourStudyConfig, studyVariations);


/* ## 4 (optional). Watch for STATE CHANGES and TELEMETRY REPORTING */
studyutils.TelemetryReporter.on("report",(d)=>console.debug("telemetry", d));
thisStudy.on("change",(newState)=>console.debug("newState:", newState));


/* ## 5. `main` function (addon-sdk style)

  ` handleStartup`

  - calls the 'right' feature variation code.
  - sets watchers for all study state changes
  - sets timers for:

    - self-destruct
    - daily 'alive' ping
*/
function main (options, callback) {
  studyutils.generateTelemetryIdIfNeeded().then(function () {
    studyutils.handleStartup(options, thisStudy);
  })
  // addon specific load code should go here, if there is any.
  console.debug(`special addon loading code: ${options.loadReason}`)
  console.debug(JSON.stringify(addonPrefs, null, 2))
}

/* ## 6. onUnload function (addon-sdk style)

  `handleShutdown`

  - shows survey during 'end-of-study' and 'user-diable'
  - ignores INELIGIBLE
  - ignores normal shutdown
*/
function onUnload (reason) {
  console.debug(`special addon unloading code: ${reason}`)
  studyutils.handleOnUnload(reason, thisStudy);

  // special unload code, specific to addon if any.
  console.debug(`special addon unloading code: ${reason}`)
  console.debug(JSON.stringify(addonPrefs, null, 2))
}


/* ## 7. usual bootstrap addon exports */
exports.main = main;
exports.onUnload = onUnload
