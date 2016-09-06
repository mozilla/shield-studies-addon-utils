/** study.js **/
const self = require("sdk/self");
const prefSrc = require("sdk/preferences/service");
const { when: unload } = require("sdk/system/unload");

const shield = require("shield-studies-addon-utils");

const feature = require("./feature");

// 1. EDIT THIS TO TASTE
const studyConfig = {
    name: self.addonId,
    days: 14,
    surveyUrls:  {
        'end-of-study': 'some/url'
        'user-ended-study': 'some/url',
        'ineligible':  'some/url'
    },
    variations: {
      'observe': ()=>{},
      'v1':      feature.which('a-value');
    }
}

// 2. Override any useful methods
class OurStudy extends shield.Study {
  constructor (config) {
    super(config);
  }
  isIneligible () {
    return super().isIneligible() || feature.ineligible();
  }
  // whenIneligible () {
  //   super().whenIneligible();
  // }
  // whenInstalled () {
  //   super().whenInstalled();
  // }
  cleanup (reason) {
    super().cleanup();  // cleanup simple-prefs, simple-storage
    feature.cleanup();
  }
  // whenComplete () {
  //   // when the study is naturally complete after this.days
  //   super().whenComplete();  // calls survey, uninstalls
  // }
  // whenUninstalled () {
  //   // user uninstall
  //   super().whenUninstalled();
  // }
  // decideVariation () {
  //   return super().decideVariation(); // chooses at random
  // }
}

// 3. Make the study singleton
const thisStudy = new OurStudy(studyConfig);

// for testing / linting
exports.OurStudy = OurStudy;
exports.studyConfig = studyConfig;

// for use by index.js
exports.study = thisStudy;

unload((reason) => thisStudy.shutdown(reason))
