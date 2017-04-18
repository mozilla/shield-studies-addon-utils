/** study.js **/
const self = require("sdk/self");
const prefSvc = require("sdk/preferences/service");
const tabs = require('sdk/tabs');
const { when: unload } = require("sdk/system/unload");

// shield, 3rd party
const shield = require("shield-studies-addon-utils");

// feature code for this study
const feature = require("./src/feature/");

// these could also come from package.json
const studyConfig = {
  name: self.id,
  days: 14,
  surveyUrls:  {
    'end-of-study': 'http://example.com/some/url',
    'user-ended-study': 'http://example.com/some/url',
    'ineligible':  null
  },
  variations: {
    "puppies": () => feature.which("puppies"),
    "kittens": () => feature.which("kittens")
  }
}

class ComplexStudy extends shield.Study {
  constructor (config) {
    console.log(config);
    super(config);
  }

  isEligible () {
    // bool should they be excluded? Stops install if true
    return feature.isEligible() && super.isEligible()
  }

  whenIneligible () {
    tabs.open(`data:text/html,Uninstalling, you are not eligible for this study`);
    super.whenIneligible();
  }

  whenInstalled () {
    feature.orientation(this.variation);
    super.whenInstalled();
  }

  cleanup (reason) {
    feature.cleanup(this.variation);
    super.cleanup();  // cleanup simple-prefs, simple-storage
  }

  whenExpired () {
    // when the study is naturally complete after this.days
    super.whenExpired();  // calls survey, uninstalls
  }

  whenUninstalled () {
    // user uninstall
    super.whenUninstalled();
  }

  decideVariation () {
    // UNLESS THE VARIATION PREF IS SET!

    // by default, choose at random
    // return super.decideVariation() // chooses at random

    // Example of Deterministic allocation
    let possibles = Object.keys(this.config.variations).sort();
    let id = prefSvc.get("toolkit.telemetry.cachedClientID", '1');
    let which = parseInt(id[id.length-1],'16') % possibles.length;
    let choice = possibles[which];
    console.log(id, which, choice);
    return choice;
  }
}


// Exports
const instantiated = new ComplexStudy(studyConfig);
feature.telemetry.sender = instantiated; // set up telemetry
console.log("is Sender?", feature.telemetry.sender);

exports.instantiated = instantiated;

// for testing / linting
exports.ComplexStudy = ComplexStudy;
exports.studyConfig = studyConfig;



unload((reason) => thisStudy.shutdown(reason))
