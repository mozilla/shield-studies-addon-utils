"use strict";

const self = require("sdk/self");
const { when: unload } = require("sdk/system/unload");

/* 1. the modules needed to turn this into a STUDY */
const shield = require("shield-studies-addon-utils");

/* 2. configuration / setup constants for the study.
 *  These are only ones needed, or supported
 */
const studyInfo = require("./studyInfo");

// 3. Study Object (module singleton);
const thisStudy = new shield.Study(studyInfo);

// 3a (DEBUG optional). Watch for changes and reporting
shield.Reporter.on("report",(d)=>console.info("telemetry", d));
thisStudy.on("change",(newState)=>console.info("newState:", newState));

/* 4. inlined main function */

// (optional) orientation example function, with a probe
function orientation () {
  require("sdk/panel").Panel({
    width: 400, height: 400,
    contentURL: "https://mozilla.github.io/shield-studies-docs/"
  }).show()
  // (optional) extra probe
  shield.report({action: "orientation"})
}

thisStudy.once("installed", orientation)

thisStudy.startup(self.loadReason);


/* 5. unload */
unload((reason) => {
  console.debug(`special addon unloading code: ${reason}`)
  thisStudy.shutdown(reason);
})
