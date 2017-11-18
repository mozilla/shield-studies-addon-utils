"use strict";

/**
* STUDYUTILS OVERVIEW
* This module takes care of the following:
*  - Validates telemetry packets via JSON schema before sending pings
*  - TODO bdanforth: fill in the rest of the stuff it does
* Notes:
*  - There are a number of methods that won't work if the setup method has not executed.
*     - These are methods where the first line is `this.throwIfNotSetup`
*     - The setup method ensures that the config data passed in is valid per its
*       corresponding schema
*/


/*
TODO glind survey / urls & query args
TODO glind publish as v4
*/
const EXPORTED_SYMBOLS = ["studyUtils"];

const UTILS_VERSION = require("../package.json").version;
const PACKET_VERSION = 3;

const {utils: Cu} = Components;
Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.importGlobalProperties(["URL", "crypto", "URLSearchParams"]);

let log;

// telemetry utils
const CID = Cu.import("resource://gre/modules/ClientID.jsm", null);
const { TelemetryController } = Cu.import("resource://gre/modules/TelemetryController.jsm", null);
const { TelemetryEnvironment } = Cu.import("resource://gre/modules/TelemetryEnvironment.jsm", null);

/**
* Gets the telemetry client ID for the user.
* @async
* @returns {string} id - the telemetry client ID
*/
async function getTelemetryId() {
  const id = TelemetryController.clientID;
  /* istanbul ignore next */
  if (id === undefined) {
    return await CID.ClientIDImpl._doLoadClientID();
  }
  return id;
}

/**
* Set-up JSON schema validation
* Schemas are used to validate an input (here, via AJV at runtime)
* Schemas here are used for:
*  - Telemetry:
*  Ensure correct Parquet format for different types of outbound packets:
*    - "shield-study": shield study state and outcome data common to all shield studies.
*    - "shield-study-addon": addon-specific probe data, with `attributes` (used to capture
*      feature-specific state) sent as Map(string,string).
*    - "shield-study-error": data used to notify, group and count some kinds of errors from shield studies
*  - ShieldUtils API ducktypes
*    - "weightedVariations": the array of branch name:weight pairs used to randomly assign the user to a branch
*    - "webExtensionMsg": TODO bdanforth: Add description, see Questions for Gregg above
*      @QUESTION glind: Can you describe the purpose of the `webExtensionMsg` schema;
*.     doesn't look like it is used?
*    - "studySetup": the options object passed into the StudyUtils.setup method
*/
const schemas = require("./schemas.js");
const Ajv = require("ajv/dist/ajv.min.js");
const ajv = new Ajv();

var jsonschema = {
  /**
  * Validates input data based on a specified schema
  * @param {Object} data - The data to be validated
  * @param {Object} schema - The schema to validate against
  * @returns {boolean} - Will return true if the data is valid
  */
  validate(data, schema) {
    var valid = ajv.validate(schema, data);
    return {valid, errors:  ajv.errors || []};
  },
  /**
  * Validates input data based on a specified schema
  * @param {Object} data - The data to be validated
  * @param {Object} schema - The schema to validate against
  * @throws Will throw an error if the data is not valid
  * @returns {boolean} - Will return true if the data is valid
  */
  validateOrThrow(data, schema) {
    const valid = ajv.validate(schema, data);
    if (!valid) { throw new Error(JSON.stringify((ajv.errors))); }
    return true;
  },
};

/**
 * Merges all the properties of all arguments into first argument. If two or
 * more argument objects have own properties with the same name, the property
 * is overridden, with precedence from right to left, implying, that properties
 * of the object on the left are overridden by a same named property of the
 * object on the right.
 *
 * Any argument given with "falsy" value - commonly `null` and `undefined` in
 * case of objects - are skipped.
 *
 * @examples
 *    var a = { bar: 0, a: 'a' }
 *    var b = merge(a, { foo: 'foo', bar: 1 }, { foo: 'bar', name: 'b' });
 *    b === a   // true
 *    b.a       // 'a'
 *    b.foo     // 'bar'
 *    b.bar     // 1
 *    b.name    // 'b'
 *
 * from addon-sdk:sdk/util/object.js
 * @param {...Object} source - two or more object arguments
 * @returns {Object} - the resulting merged object
 */
function merge(source) {
  /*
  * Gets object's own property Symbols and/or Names, including nonEnumerables by default
  * @param {Object} object - the object to get own property symbols and names for
  * @param {Object} options - object indicating what kinds of properties to merge
  * @param {boolean} options.name - True if function should return object's own property names
  * @param {boolean} options.symbols - True if function should return object's own property symbols
  * @param {boolean} options.nonEnumerables - True if non-enumerable object own property names should be included
  * @returns {string[]|symbol[]} - An array of own property names and/or symbols for object
  * TODO bdanforth: confirm data type format for @returns above
  * @QUESTION glind: What is the JSDoc way of identifying the return value for
  * getOwnPropertyIdentifiers? It's an array of symbols and/or strings. Is there a
  * reason for this array having mixed data type elements? Is there a risk? Best I could
  * come up with: @returns {string[]|symbol[]}
  */
  function getOwnPropertyIdentifiers(object, options = { names: true, symbols: true, nonEnumerables: true }) {
    const symbols = !options.symbols ? [] :
      Object.getOwnPropertySymbols(object);

    // eslint-disable-next-line
    const names = !options.names ? [] :
      options.nonEnumerables ? Object.getOwnPropertyNames(object) :
        Object.keys(object);
    return [...names, ...symbols];
  }

  // descriptor: an object whose own enumerable properties constitute descriptors for
  // the properties from arguments[1]+ to be defined or modified in arguments[0]
  const descriptor = {};
  // `Boolean` converts the first parameter to a boolean value. Any object is
  // converted to `true` where `null` and `undefined` becames `false`. Therefore
  // the `filter` method will keep only objects that are defined and not null.
  Array.slice(arguments, 1).filter(Boolean).forEach(function onEach(properties) {
    getOwnPropertyIdentifiers(properties).forEach(function(name) {
      descriptor[name] = Object.getOwnPropertyDescriptor(properties, name);
    });
  });
  return Object.defineProperties(source, descriptor);
}

/**
* Appends a query string to a url.
* @QUESTION glind: What do you mean here by "static (data)"?
* @param {string} url - a base url to append; must be static (data) or external
* @param {Object} ...args - query arguments, one or more object literal used to
* build a query string
* @returns {string} - an absolute url appended with a query string
* @QUESTION glind: The function `mergeQueryArgs` accepts a rest parameter as its
* second argument, but what is ultimately passed in as this parameter is an object
* literal from 'endingQueryArgs'. When I execute `mergeQueryArgs` in a REPL,
* passing in an object literal as the rest parameter, I get an error:
*    "TypeError: objectLiteral is not iterable".
* How does this `mergeQueryArgs` not throw an error for you?
*/
function mergeQueryArgs(url, ...args) {
  /* currently left to right*/
  // TODO, glind, decide order of merge here
  // TODO, use Object.assign, or ES7 spread
  const U = new URL(url);
  // get the query string already attached to url, if it exists
  let q = U.search || "?";

  // create an interface to interact with the query string
  q = new URLSearchParams(q);

  // @QUESTION: `mergeQueryArgs` rest parameter is always one object literal? Why
  // are we merging here?
  const merged = merge({}, ...args);

  // Set each search parameter in "merged" to its value in the query string,
  // building up the query string one search parameter at a time.
  Object.keys(merged).forEach((k) => {
    // k: the search parameter (ex: fxVersion)
    // q.get(k): returns the value of the search parameter, k, in query string, q (ex: 57.0.1a)
    log.debug(q.get(k), k, merged[k]);
    q.set(k, merged[k]);
  });

  // append our new query string to the URL object made with "url"
  U.search = q.toString();
  // return the full url, with the appended query string
  return U.toString();
}

// sampling utils
/**
* @async
*/
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

function chooseWeighted(weightedVariations, fraction = Math.random()) {
  /*
   weightedVaiations, list of:
   {
    name: string of any length
    weight: float >= 0
   }
  */
  jsonschema.validateOrThrow(weightedVariations, schemas.weightedVariations);

  var weights = weightedVariations.map(x => x.weight || 1);
  const partial = cumsum(weights);
  const total = weights.reduce((a, b) => a + b);
  for (let ii = 0; ii < weightedVariations.length; ii++) {
    if (fraction <= partial[ii] / total) {
      return weightedVariations[ii];
    }
  }
  return null;
}

/**
* @async
*/
async function hashFraction(saltedString, bits = 12) {
  const hash = await sha256(saltedString);
  return parseInt(hash.substr(0, bits), 16) / Math.pow(16, bits);
}

class StudyUtils {
  constructor(config) {
    // TODO glind Answer: no.  see if you can merge the construtor and setup and export the class, rather than a singleton
    this.respondToWebExtensionMessage = function({shield, msg, data}, sender, sendResponse) {
      // shield: boolean, if present, request is for shield
      if (!shield) return true;
      const allowedMethods = ["endStudy", "telemetry", "info"];
      if (!allowedMethods.includes(msg)) {
        throw new Error(`respondToWebExtensionMessage: "${msg}" is not in allowed studyUtils methods: ${allowedMethods}`);
      }
      // handle async
      Promise.resolve(this[msg](data)).then(
        function(ans) {
          log.debug("respondingTo", msg, ans);
          sendResponse(ans);
        },
        // function error eventually
      );
      return true;
    }.bind(this);

    // expose the sample utilities
    this.sample = {
      sha256,
      cumsum,
      chooseWeighted,
      hashFraction,
    };
    // expose schemas
    this.schemas = schemas;

    // expose validation methods
    this.jsonschema = jsonschema;

    this.REASONS = REASONS;
  }
  throwIfNotSetup(name = "unknown") {
    if (!this._isSetup) throw new Error(name + ": this method can't be used until `setup` is called");
  }

  setup(config) {
    log = createLog("shield-study-utils", config.log.studyUtils.level);

    log.debug("setting up!");
    jsonschema.validateOrThrow(config, schemas.studySetup);

    this.config = config;
    this._isSetup = true;
    return this;
  }
  reset() {
    this.config = {};
    delete this._variation;
    this._isSetup = false;
  }
  /**
  * @async
  */
  async openTab(url, params = {}) {
    this.throwIfNotSetup("openTab");
    log.debug(url, params);
    log.debug("opening this formatted tab", url, params);
    if (!Services.wm.getMostRecentWindow("navigator:browser").gBrowser) {
      // Wait for the window to be opened
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
    Services.wm.getMostRecentWindow("navigator:browser").gBrowser.addTab(url, params);
  }

  /**
  * @async
  */
  async getTelemetryId() {
    return await getTelemetryId();
  }
  setVariation(variation) {
    this.throwIfNotSetup("setVariation");
    this._variation = variation;
    return this;
  }
  getVariation() {
    this.throwIfNotSetup("getvariation");
    return this._variation;
  }

  /**
  * @async
  */
  async deterministicVariation(weightedVariations, rng = null) {
    // hash the studyName and telemetryId to get the same branch every time.
    this.throwIfNotSetup("deterministicVariation needs studyName");
    // this is the standard arm choosing method
    let fraction = rng;
    if (fraction === null) {
      const clientId = await this.getTelemetryId();
      fraction = await this.sample.hashFraction(this.config.study.studyName + clientId, 12);
    }
    return this.sample.chooseWeighted(weightedVariations, fraction);
  }

  getShieldId() {
    const key = "extensions.shield-recipe-client.user_id";
    return Services.prefs.getCharPref(key, "");
  }
  info() {
    log.debug("getting info");
    this.throwIfNotSetup("info");
    return {
      studyName: this.config.study.studyName,
      addon: this.config.addon,
      variation: this.getVariation(),
      shieldId: this.getShieldId(),
    };
  }
  // TODO glind, maybe this is getter / setter?
  get telemetryConfig() {
    this.throwIfNotSetup("telemetryConfig");
    return this.config.study.telemetry;
  }
  firstSeen() {
    log.debug(`firstSeen`);
    this.throwIfNotSetup("firstSeen uses telemetry.");
    this._telemetry({study_state: "enter"}, "shield-study");
  }
  setActive() {
    this.throwIfNotSetup("setActive uses telemetry.");
    const info = this.info();
    log.debug("marking TelemetryEnvironment", info.studyName, info.variation.name);
    TelemetryEnvironment.setExperimentActive(info.studyName, info.variation.name);
  }
  unsetActive() {
    this.throwIfNotSetup("unsetActive uses telemetry.");
    const info = this.info();
    log.debug("unmarking TelemetryEnvironment", info.studyName, info.variation.name);
    TelemetryEnvironment.setExperimentInactive(info.studyName);
  }
  uninstall(id) {
    if (!id) id = this.info().addon.id;
    if (!id) {
      this.throwIfNotSetup("uninstall needs addon.id as arg or from setup.");
    }
    log.debug(`about to uninstall ${id}`);
    AddonManager.getAddonByID(id, addon => addon.uninstall());
  }

  /**
  * @async
  */
  async startup({reason}) {
    this.throwIfNotSetup("startup");
    log.debug(`startup ${reason}`);
    this.setActive();
    if (reason === REASONS.ADDON_INSTALL) {
      this._telemetry({study_state: "installed"}, "shield-study");
    }
  }

  /**
  * @async
  */
  async endStudy({reason, fullname}) {
    this.throwIfNotSetup("endStudy");
    if (this._isEnding) {
      log.debug("endStudy, already ending!");
      return;
    }
    this._isEnding = true;
    log.debug(`endStudy ${reason}`);
    this.unsetActive();
    // TODO glind, think about reason vs fullname
    // TODO glind, think about race conditions for endings, ensure only one exit
    // Check if the study ending shows the user a page in a new tab
    // (ex: survey, explanation, etc.)
    const ending = this.config.study.endings[reason];
    if (ending) {
      // baseUrl: needs to be appended with query arguments before opening a tab,
      // exactUrl: used as is
      const {baseUrl, exactUrl} = ending;
      if (exactUrl) {
        this.openTab(exactUrl);
      } else if (baseUrl) {
        const qa = await this.endingQueryArgs();
        qa.reason = reason;
        qa.fullreason = fullname;
        const fullUrl = mergeQueryArgs(baseUrl, qa);
        log.debug(baseUrl, fullUrl);
        this.openTab(fullUrl);
      }
    }
    switch (reason) {
      case "ineligible":
      case "expired":
      case "user-disable":
      case "ended-positive":
      case "ended-neutral":
      case "ended-negative":
        this._telemetry({study_state: reason, fullname}, "shield-study");
        break;
      default:
        this._telemetry({study_state: "ended-neutral", study_state_fullname: reason}, "shield-study");
        // unless we know better TODO grl
    }
    // these are all exits
    this._telemetry({study_state: "exit"}, "shield-study");
    this.uninstall(); // TODO glind. should be controllable by arg?
  }

  /**
  * @async
  */
  async endingQueryArgs() {
    // TODO glind, make this back breaking!
    this.throwIfNotSetup("endingQueryArgs");
    const info = this.info();
    const who = await getTelemetryId();
    const queryArgs = {
      shield: PACKET_VERSION,
      study: info.studyName,
      variation: info.variation.name,
      updateChannel: Services.appinfo.defaultUpdateChannel,
      fxVersion: Services.appinfo.version,
      addon: info.addon.version, // addon version
      who, // telemetry clientId
    };
    queryArgs.testing = Number(!this.telemetryConfig.removeTestingFlag);
    return queryArgs;
  }

  /**
  * @async
  */
  async _telemetry(data, bucket = "shield-study-addon") {
    log.debug(`telemetry in:  ${bucket} ${JSON.stringify(data)}`);
    this.throwIfNotSetup("_telemetry");
    const info = this.info();
    const payload = {
      version:        PACKET_VERSION,
      study_name:     info.studyName,
      branch:         info.variation.name,
      addon_version:  info.addon.version,
      shield_version: UTILS_VERSION,
      type:           bucket,
      data,
      testing:        !this.telemetryConfig.removeTestingFlag,
    };

    let validation;
    /* istanbul ignore next */
    try {
      validation = jsonschema.validate(payload, schemas[bucket]);
    } catch (err) {
      // if validation broke, GIVE UP.
      log.error(err);
      return false;
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
        return false; // just die, maybe should have a super escape hatch?
      }
      return this.telemetryError(errorReport);
    }
    // emit(TelemetryWatcher, 'telemetry', [bucket, payload]);
    log.debug(`telemetry: ${JSON.stringify(payload)}`);
    // FIXME marcrowo: addClientId makes the ping not appear in test?
    // seems like a problem with Telemetry, not the shield-study-utils library
    const telOptions = {addClientId: true, addEnvironment: true};
    if (!this.telemetryConfig.send) {
      log.debug("NOT sending.  `telemetryConfig.send` is false");
      return false;
    }
    return TelemetryController.submitExternalPing(bucket, payload, telOptions);
  }

  // telemetry from addon, mostly from webExtension message.
  /**
  * @async
  */
  async telemetry(data) {
    log.debug(`telemetry ${JSON.stringify(data)}`);
    const toSubmit = {
      attributes: data,
    };
    // lets check early, and respond with something useful?
    return this._telemetry(toSubmit, "shield-study-addon");
  }
  telemetryError(errorReport) {
    return this._telemetry(errorReport, "shield-study-error");
  }
  setLoggingLevel(descriptor) {
    log.level = Log.Level[descriptor];
  }

}

function createLog(name, levelWord) {
  Cu.import("resource://gre/modules/Log.jsm");
  var L = Log.repository.getLogger(name);
  L.addAppender(new Log.ConsoleAppender(new Log.BasicFormatter()));
  L.level = Log.Level[levelWord] || Log.Level.Debug; // should be a config / pref
  L.debug("log made", name, levelWord, Log.Level[levelWord]);
  return L;
}
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

// Actually create the singleton.
var studyUtils = new StudyUtils();

// to make this work with webpack!
this.EXPORTED_SYMBOLS = EXPORTED_SYMBOLS;
this.studyUtils = studyUtils;
