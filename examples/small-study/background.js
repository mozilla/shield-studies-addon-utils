
const STUDYCONFIG = {
  // the study
  name: "ourStudy",
  weightedVariations: [

  ],
  endings: [
  ]
};

// This is a Shield Study template.
class BaseStudy {
  constructor(variation) {
    // makes telmemetry possible
    await browser.study.configure(variation, ...STUDYCONFIG);
  }

  async isEligible() {
    let permissions = await browser.study.permissions();
    // could have other reasons to be eligible, such as addons or whatever
    return permissions.shield
  }

  // TODO gets reasons
  // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/runtime/onInstalled
  async installDieOrStartup () {
    // is first run?
    let installed = await browser.storage.local.get("installed");
    if (installed) {
      return true;
    } else {
      let eligible = await this.isEligible();
       if (!eligible) {
        await browser.study.endStudy(...STUDYCONFIG.endings.ineligible) ;
      } else {
        await browser.storage.local.set({"installed": true});
      }
    }
  }
}


// 1. variation, it all needs the variation
const userVariation = await browser.shield.simpleDeterministicVariation(STUDYCONFIG.weightedVariations);

// 2. configure.  Now we can send telemetry, because we have a variation
const study = new BaseStudy(userVariation);

// 3.  eligible for install?  if not, die.
await study.installDieOrStartup(userVariation);

// 4. send a ping
await browser.shield.telemetry(aPing);

// 5. force quit the study
await browser.shield.endStudy(...anEnding, uninstall)
// endSTudy, ps has scary side effects, describe them.
