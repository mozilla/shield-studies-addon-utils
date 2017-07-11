"use strict";


/* global  __SCRIPT_URI_SPEC__  */
const {utils: Cu} = Components;
const CONFIGPATH = `${__SCRIPT_URI_SPEC__}/../Config.jsm`;
const { config } = Cu.import(CONFIGPATH, {});
const studyConfig = config.study;
const log = createLog(studyConfig.studyName, config.log.level);  // defined below.

const STUDYUTILSPATH = `${__SCRIPT_URI_SPEC__}/../${studyConfig.studyUtilsPath}`;
const { studyUtils } = Cu.import(STUDYUTILSPATH, {});

this.startup = async function(addonData, reason) {
  // addonData: Array [ "id", "version", "installPath", "resourceURI", "instanceID", "webExtension" ]  bootstrap.js:48
  log.debug("startup", REASONS[reason] || reason);
  studyUtils.setup({
    studyName: studyConfig.studyName,
    endings: studyConfig.endings,
    addon: {id: addonData.id, version: addonData.version},
    telemetry: studyConfig.telemetry
  });
  Jsm.import(config.modules);

  if ((REASONS[reason]) === "ADDON_INSTALL") {
    studyUtils.firstSeen();  // sends telemetry "enter"
    const eligible = await config.isEligible(); // addon-specific
    if (!eligible) {
      // uses config.endings.ineligible.url if any,
      // sends UT for "ineligible"
      // then uninstalls addon
      await studyUtils.endStudy({reason: "ineligible"});
      return;
    }
  }

  // deterministic sampling, then set variation
  const variation = await chooseVariation();
  await studyUtils.startup({reason: reason, variation: variation});

  // if you have code to handle expiration / long-timers, it could go here.
  const webExtension = addonData.webExtension;
  webExtension.startup().then(api => {
    const {browser} = api;
    // messages intended for shield:  {shield:true,msg=[info|endStudy|telemetry],data=data}
    browser.runtime.onMessage.addListener(studyUtils.respondToWebExtensionMessage);
    //  other message handlers from your addon, if any
  });
};

this.shutdown = async function(addonData, reason) {
  log.debug("shutdown", REASONS[reason] || reason);
  studyUtils.shutdown(reason);
  // unloads must come after module work
  Jsm.unload(config.modules);
  Jsm.unload([CONFIGPATH, STUDYUTILSPATH]);
};

this.uninstall = async function(addonData, reason) {
  log.debug("uninstall", REASONS[reason] || reason);
};

this.install = async function(addonData, reason) {
  log.debug("install", REASONS[reason] || reason);
  // handle ADDON_UPGRADE (if needful) here
};


/** CONSTANTS and other bootstrap.js utilities */

// addon state change reasons
const REASONS = {
  APP_STARTUP: 1,      // The application is starting up.
  APP_SHUTDOWN: 2,     // The application is shutting down.
  ADDON_ENABLE: 3,     // The add-on is being enabled.
  ADDON_DISABLE: 4,    // The add-on is being disabled. (Also sent during uninstallation)
  ADDON_INSTALL: 5,    // The add-on is being installed.
  ADDON_UNINSTALL: 6,  // The add-on is being uninstalled.
  ADDON_UPGRADE: 7,    // The add-on is being upgraded.
  ADDON_DOWNGRADE: 8,  // The add-on is being downgraded.
};
for (const r in REASONS) { REASONS[REASONS[r]] = r; }

// logging
function createLog(name, level) {
  Cu.import("resource://gre/modules/Log.jsm");
  var log = Log.repository.getLogger(name);
  log.addAppender(new Log.ConsoleAppender(new Log.BasicFormatter()));
  log.level = level || Log.Level.Debug; // should be a config / pref
  return log;
}

async function chooseVariation() {
  let toSet, source;
  const sample = studyUtils.sample;

  if (studyConfig.variation) {
    source = "startup-config";
    toSet = studyConfig.variation;
  } else {
    source = "weightedVariation";
    // this is the standard arm choosing method
    const clientId = await studyUtils.getTelemetryId();
    const hashFraction = await sample.hashFraction(studyConfig.studyName + clientId, 12);
    toSet = sample.chooseWeighted(studyConfig.weightedVariations, hashFraction);
  }
  log.debug(`variation: ${toSet} source:${source}`);
  return toSet;
}

// jsm loader / unloader
class Jsm {
  static import(modulesArray) {
    for (const module of modulesArray) {
      log.debug(`loading ${module}`);
      Cu.import(module);
    }
  }
  static unload(modulesArray) {
    for (const module of modulesArray) {
      log.debug(`Unloading ${module}`);
      Cu.unload(module);
    }
  }
}
