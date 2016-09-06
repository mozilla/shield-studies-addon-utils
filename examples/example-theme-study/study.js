/** study.js **/
const self = require("sdk/self");
const prefSvc = require("sdk/preferences/service");
const shield = require("shield-studies-addon-utils");
const tabs = require('sdk/tabs');
const { when: unload } = require("sdk/system/unload");

const feature = require("./feature");

const studyConfig = {
    name: self.addonId,
    days: 14,
    surveyUrls:  {
        'end-of-study': 'some/url'
        'user-ended-study': 'some/url',
        'ineligible':  null
    },
   variations: {
      "notheme": () => feature.which("notheme"),
      "puppies": () => feature.which("puppies"),
      "kittens": () => feature.which("kittens")
   }
}

class OurStudy extends shield.Study {
  constructor (config) {
    super(config);
  }
  isIneligible () {
     super ();  // blank by default
     // bool Already Has the feature.  Stops install if true
     return prefSrc.get('user.has.a.competing.feature')
  }
  whenIneligible () {
      super();
     // additional actions for 'user isn't eligible'
     tabs.open(`data:text/html,Uninstalling, you are not eligible for this study`)
  }
  whenInstalled () {
      super ();
     // orientation, unless our branch is 'notheme'
     if (this.variation == 'notheme') {}
     feature.orientation(this.variation);
  }
  cleanup (reason) {
    super();  // cleanup simple-prefs, simple-storage
    // do things, maybe depending on reason, branch
  }
  whenComplete () {
    // when the study is naturally complete after this.days
    super();  // calls survey, uninstalls
  }
  whenUninstalled () {
    // user uninstall
    super();
  }
  decideVariation () {
  return super(); // chooses at random
  // unequal or non random allocation for example
  }
}

const thisStudy = new OurStudy(studyConfig);

// for testing / linting
exports.OurStudy = OurStudy;
exports.studyConfig = studyConfig;

// for use by index.js
exports.study = thisStudy;

unload((reason) => thisStudy.shutdown(reason))
