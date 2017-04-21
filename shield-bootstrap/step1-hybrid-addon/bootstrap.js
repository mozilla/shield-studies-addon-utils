"use strict";

const {utils: Cu} = Components;
Cu.import("resource://gre/modules/Log.jsm");
let log = Log.repository.getLogger("bootstrap");
log.level = Log.Level.Debug;

log.info(`hello! ${Date.now()}`);
const jsms = [
  "chrome://shield-example-addon/content/ShieldStudy.jsm"
];

class Jsm {
  static import (modulesArray) {
    for (const module of modulesArray) {
      log.debug(`loading ${module}`);
      Cu.import(module);
    }
  }
  static unload (modulesArray) {
    for (const module of modulesArray) {
      log.debug(`Unloading ${module}`);
      Cu.unload(module);
    }
  }
}

debugger;
//Jsm.import(jsms);

// Set up shield
const studyConfig = {
  name: 'aName',
  days: 1,
  surveyUrls: {}
}

const study = new ShieldStudy.ShieldStudy(studyConfig);
study.load();

this.install = function ({webExtension}, reason) {
  if (study.isEligible()) {
    let variation = study.chooseVariation();
    study.setVariation(variation);  // choose and save
  } else {
    study.die("ineligible"); //
    // and probably you should uninstall the whole addon
  }
}

this.startup = function({webExtension}, reason) {
  // Start the embedded webextension.
  webExtension.startup().then(api => {
    const {browser} = api;
    browser.runtime.onMessage.addListener((msg, sender, sendReply) => {
      if (msg.type == "telemetry") {
        study.telemetry(msg.data)
      }
    });
  });
};

this.shutdown = function (data, reason) {
  study.shutdown(reason);
  Jsm.unload(jsms);
}

this.uninstall = function (reason) {
  study.uninstall(reason);
}
