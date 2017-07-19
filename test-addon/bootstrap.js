/* global  __SCRIPT_URI_SPEC__  */

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
// TODO investigate this hackiness
const { studyUtils } = Cu.import(`${__SCRIPT_URI_SPEC__}/../StudyUtils.jsm`, {});

// TODO move this to a Config.jsm file
const studyConfig = {
  studyName: "shieldStudyUtilsTest",
  "weightedVariations": [
    {"name": "control",
      "weight": 1},
    {"name": "kittens",
      "weight": 1.5},
    {"name": "puppers",
      "weight": 2},  // we want more puppers in our sample
  ],
};

async function chooseVariation() {
  const sample = studyUtils.sample;
  const clientId = await studyUtils.getTelemetryId();
  const hashFraction = await sample.hashFraction(studyConfig.studyName + clientId);
  return sample.chooseWeighted(studyConfig.weightedVariations, hashFraction);
}

this.install = function(data, reason) {};

this.startup = async function(data, reason) {
  const variation = await chooseVariation();
  console.log(variation);
};

this.shutdown = function(data, reason) {};

this.uninstall = function(data, reason) {};
