// Allow outside override for debug and testing using prefs
const STUDYPREFS = {
  variationPref: `shield.${addonWidgetId}.testingBranch`,
  firstrunPref: `shield.${addonWidgetId}.firstrun`,
};

const STUDYCONFIG = {
  // the study
  weightedVariations: {},
};

// This is a Shield Study template.
class BaseStudy {
  constructor(variation) {
    // also sets activeExperiment key
    // makes telmemetry possible
    browser.study.configure(variation, ...STUDYCONFIG);
  }

  async isEligible() {
    let permissions = await browser.study.permissions();
    // could have other reasons to be eligible, such as addons or whatever
    return permissions.shield;
  }

  // TODO gets reasons
  // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/runtime/onInstalled
  async installOrDie() {
    let eligible = await this.isEligible();
    if (!eligible) {
      // a full ineligible ending TODO
      browser.study.endStudy("ineligible" /*, ...*/);
    }
  }

  async watchExpire() {
    // TODO, use the firstRun prefs, timers module etc.
    let becameExpired = false;
    if (becameExpired) {
      // full ending
      await browser.study.endStudy("expired" /*, ...*/);
    }
  }

  watchImportantPrefs() {
    // for the important prefs for shield, watch if they change and
    // kill-study if they change
    // for list of prefs
    // if (change) browser.study.endStudy('lost-permissions')
  }
}

(async () => {
  // 1. variation, it all needs the variation
  const userVariation =
    (await browser.study.getPref(variationPref, "string")) ||
    (await browser.shield.simpleDeterministicVariation(
      STUDYCONFIG.weightedVariations,
    ));

  // 2. configure.  Now we can send telemetry, because we have a variation
  const study = new BaseStudy(userVariation);

  // 3.  eligible for install?  if not, die.
  browser.runtime.onInstalled.addListener(study.installOrDie);

  // 4.  handle install vs. regular run.
  await browser.shield.attemptRun();

  // 5. send a ping
  await browser.shield.telemetry(aPing);

  // 6. force quit the study
  await browser.shield.endStudy(...anEnding, uninstall);
  // endSTudy, ps has scary side effects, describe them.
})();
