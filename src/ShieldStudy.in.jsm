"use strict";

/*
TODO glind packet validation
TODO glind survey / urls & query args
TODO glind endings validation
TODO glind fix all return value warts
TODO glind 'testing' flag
TODO glind publish as v4
TODO glind rename repo and re-organize.  /Dist?
TODO glind see if you can merge the construtor and setup and export the class, rather than a singleton
TODO glind handle all ENTER and EXIT cases
*/

const {utils: Cu} = Components;

Cu.import("resource://gre/modules/Log.jsm");
const log = Log.repository.getLogger("shield-study-utils");
log.addAppender(new Log.ConsoleAppender(new Log.BasicFormatter()));
log.level = Log.Level.Debug;

const UTILS_VERSION = require("../package.json").version;
const PACKET_VERSION = 3;

Cu.importGlobalProperties(["URL", "crypto"]);
const EXPORTED_SYMBOLS = ["studyUtils"];

Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

// telemetry utils
const CID = Cu.import("resource://gre/modules/ClientID.jsm", null);
const { TelemetryController } = Cu.import("resource://gre/modules/TelemetryController.jsm", null);
const { TelemetryEnvironment } = Cu.import("resource://gre/modules/TelemetryEnvironment.jsm", null);

async function getTelemetryId() {
  const id = TelemetryController.clientID;
  /* istanbul ignore next */
  if (id === undefined) {
    return await CID.ClientIDImpl._doLoadClientID();
  }
  return id;
}

// const DIRECTORY = new URL(this.__URI__ + "/../").href;
const schemas = require("./schemas.js");
const Ajv = require("ajv/dist/ajv.min.js");
const ajv = new Ajv();

// I don't LOVE this interface
var jsonschema = {
  validate(data, schema) {

    var valid = ajv.validate(schema, data);
    return {valid, errors:  ajv.errors || []};
  },
};

// survey utils
function mergeQueryArgs(url, queryArgs = {}) {
  if (!url) return ;

  const U = new URL(url);
  let q = U.search || "?";
  q = new URLSearchParams(q);

  // get user info.
  Object.keys(queryArgs).forEach((k) => {
    q.set(k, queryArgs[k]);
  });

  const searchstring = q.toString();
  U.search = searchstring;
  return U.toString();
}

// sampling utils
async function sha256(message) {
  const msgBuffer = new TextEncoder("utf-8").encode(message); // encode as UTF-8
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer); // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert ArrayBuffer to Array
  const hashHex = hashArray.map(b => ("00" + b.toString(16)).slice(-2)).join(""); // convert bytes to hex string
  return hashHex;
}
function cumsum(arr) {
  return arr.reduce(function(r, c, i) { r.push((r[i - 1] || 0) + c); return r; }, [] );
}

function chooseFrom(weightedVariations, rng = Math.random()) {
  /*
   weightedVaiations, list of:
   {
    name: string of any length
    weight: float > 0
   }
  */
  // no checking that weights and choices are unequal in size.
  var weights = weightedVariations.map(x => x.weight || 1);
  var choices = weightedVariations.map(x => x.name);
  const partial = cumsum(weights);
  const total = weights.reduce((a, b) => a + b);
  for (let ii = 0; ii < choices.length; ii++) {
    if (rng <= partial[ii] / total) {
      return choices[ii];
    }
  }
  return null;
}

async function hashFraction(saltedString, bits = 12) {
  const hash = await sha256(saltedString);
  return parseInt(hash.substr(0, bits), 16) / Math.pow(16, bits);
}

class StudyUtils {
  constructor(config) {
    // es6-ish way of binding up `this`.
    this.respondToWebExtensionMessage = async function({shield, msg, data}, sender, sendResponse) {
      // shield: boolean, if present, request is for shield
      if (!shield) return;
      const allowedMethods = ["endStudy", "telemetry", "info"];
      if (!allowedMethods.includes(msg)) return;
      sendResponse(this[msg](data));
    }.bind(this);
  }
  throwIfNotSetup() {
    if (!this._isSetup) throw new Error("this method can't be used until `setup` is called");
  }
  setup(config) {
    log.debug("setting up!");
    const v = jsonschema.validate(config, schemas.studySetup);
    if (!v.valid) { throw new Error(v.errors); }

    // studyUtils.setup({studyName: studyConfig.studyName, endings: studyConfig.endings, addonId: addonData.id, testing: studyConfig.testing});

    this.config = config;
    this._isSetup = true;
    return this;
  }
  async openTab(url, params = {}) {
    this.throwIfNotSetup();
    log.debug("opening this formatted tab", url, params);
    Services.wm.getMostRecentWindow("navigator:browser").gBrowser.addTab(url, params);
  }
  async getTelemetryId() {
    return await getTelemetryId();
  }
  setVariation(variation) {
    this.throwIfNotSetup();
    this._variation = variation;
    return this;
  }
  getVariation() {
    return this._variation;
  }
  chooseFrom(...args) {
    return chooseFrom(...args);
  }
  hashFraction(...args) {
    return hashFraction(...args);
  }
  info() {
    this.throwIfNotSetup();
    return {
      studyName: this.config.studyName,
      variation: this.getVariation(),
    };
  }
  firstSeen() {
    this.throwIfNotSetup();
    log.debug(`firstSeen}`);
    this._telemetry({study_state: "enter"}, "shield-study");
  }
  setActive(which) {
    this.throwIfNotSetup();
    log.debug("marking", this.config.name, this.variation);
    TelemetryEnvironment.setExperimentActive(this.config.name, this.variation);
  }
  unsetActive(which) {
    this.throwIfNotSetup();
    log.debug("unmarking", this.config.name, this.variation);
    TelemetryEnvironment.setExperimentInactive(this.config.name);
  }
  surveyUrl(urlTemplate) {
    this.throwIfNotSetup();
    log.debug(`survey: ${urlTemplate} filled with args`);
  }
  uninstall(id) {
    this.throwIfNotSetup();
    if (!id) id = this.config.addonId;
    log.debug(`about to uninstall ${id}`);
    AddonManager.getAddonByID(id, addon => addon.uninstall());
  }
  // watchExpire()??? timer?  expireAfter?
  // pingDaily()
  async startup({reason, variation}) {
    variation && this.setVariation(variation);
    this.throwIfNotSetup();
    log.debug(`magicStartup ${reason}`);
    if (reason === REASONS.ADDON_INSTALL) {
      this._telemetry({study_state: "installed"}, "shield-study");
    }
    this.setActive(this.config.studyName, this.getVariation());
    // set timers
  }
  async shutdown(reason) {
    this.throwIfNotSetup();
    log.debug(`shutdown ${reason}`);
  }

  async endStudy({reason, fullname}) {
    this.throwIfNotSetup();
    log.debug(`endStudy ${reason}`);
    this.unsetActive(this.config.studyName, this.variation);
    // TODO glind, think about reason vs fullname
    // TODO glind, think about race conditions for endings, ensure only one exit
    const ending = this.config.endings[reason];
    ending && this.openTab(ending.url);
    switch (reason) {
      case "ineligible":
      case "expired":
      case "user-disable":
      case "ended-positive":
      case "ended-neutral":
      case "ended-negative":
        this._telemetry({study_state: reason, fullname});
        break;
      default:
        this._telemetry({study_state: "ended-neutral", study_state_fullname: reason});
        // unless we know better TODO grl
    }
    // these are all exits
    this._telemetry({study_state: "exit"}, "shield-study");
    this.uninstall(); // TODO glind. should be controllable by arg?
  }

  async surveyQueryArgs() {
    this.throwIfNotSetup();
    const who = await getTelemetryId();
    const queryArgs = {
      shield: PACKET_VERSION,
      study: this.config.name,
      variation: this.variation,
      updateChannel: Services.appinfo.defaultUpdateChannel,
      fxVersion: Services.appinfo.version,
      addon: self.version, // addon version
      who, // telemetry clientId
    };
    // TODO grl, decide how to handle this
    queryArgs.testing = 1;
    // if (prefSvc.get("shield.testing")) queryArgs.testing = 1;
    return queryArgs;
  }

  async showSurvey(reason) {
    this.throwIfNotSetup();
    // should there be an appendArgs boolean?
    const partial = this.config.endings[reason];

    const queryArgs = await this.surveyQueryArgs();

    queryArgs.reason = reason;
    if (partial) {
      const url = survey(partial, queryArgs);
      // emit(SurveyWatcher, 'survey', [reason, url]);
      this.openTab(url);
      return url;
    }
    // emit(SurveyWatcher, 'survey', [reason, null]);


  }
  _telemetry(data, bucket = "shield-study-addon") {
    log.debug(`telemetry in:  ${bucket} ${JSON.stringify(data)}`);
    this.throwIfNotSetup();
    const payload = {
      version:        PACKET_VERSION,
      study_name:     this.config.name,
      branch:         this.variation,
      // addon_version:  self.version,
      shield_version: UTILS_VERSION,
      type:           bucket,
      data,
    };
    // if (prefSvc.get('shield.testing')) payload.testing = true;
    payload.testing = this.config.testing;

    let validation;

    /* istanbul ignore next */
    try {
      validation = jsonschema.validate(payload, schemas[bucket]);
    } catch (err) {
      // if validation broke, GIVE UP.
      log.error(err);
      return;
    }

    if (validation.errors.length) {
      const errorReport = {
        "error_id": "jsonschema-validation",
        "error_source": "addon",
        "severity": "fatal",
        "message": JSON.stringify(validation.errors),
      };
      if (bucket === "shield-study-error") {
        // log: if it's a warn or error, it breaks jpm test
        log.warn("cannot validate shield-study-error", data, bucket);
        return; // just die, maybe should have a super escape hatch?
      }
      return this.telemetryError(errorReport);
    }
    // emit(TelemetryWatcher, 'telemetry', [bucket, payload]);
    log.debug(`telemetry: ${JSON.stringify(payload)}`);
    const telOptions = {addClientId: true, addEnvironment: true};
    return TelemetryController.submitExternalPing(bucket, payload, telOptions);
  }

  // telemetry from addon
  telemetry(data) {
    log.debug(`telemetry ${JSON.stringify(data)}`);
    const toSubmit = {
      attributes: data,
    };
    this._telemetry(toSubmit, "shield-study-addon");
  }

  telemetryError(errorReport) {
    return this._telemetry(errorReport, "shield-study-error");
  }
  validateJSON(json, schema) {

    return jsonschema.validate(json, schema);
  }
}

var studyUtils = new StudyUtils();

/** addon state change reasons */
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

// to make this work with webpack!
this.EXPORTED_SYMBOLS = EXPORTED_SYMBOLS;
this.studyUtils = studyUtils;
