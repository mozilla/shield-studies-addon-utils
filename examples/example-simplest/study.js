const { when: unload } = require("sdk/system/unload");
const shield = require("shield-studies-addon-utils")

const { prefs } = require("sdk/simple-prefs");

class Ours extends shield.Study {
  constructor (options) {
    super(options);
    this.lint()
  }
  lint () {
    let study = this;
    console.log(study.config);
    console.log('## variations');
    for (let k of Object.keys(study.config.variations)) {
      console.log("variation:", k, "==>", typeof study.config.variations[k])
    }
    console.log("firstrun", study.firstrun);
    console.log("variation:", study.variation);
    console.log("pref says", prefs["shield.variation"]);

  }
  decideVariation () {
    let ans = super.decideVariation();
    console.log("Decide from:", Object.keys(this.config.variations), ans);
    return ans;
  }
}

// no surveyUrl, name as addonId, 1 variation, 7 days
const thisStudy = new Ours({});

exports.study = thisStudy;

unload((reason) => thisStudy.shutdown(reason))
