/* eslint-env commonjs */

"use strict";

import sampling from "./sampling";

/*
* For an overview of what this module does, see ABOUT.md at
* github.com/mozilla/shield-studies-addon-template
*
* Note: There are a number of methods that won't work if the 
* setup method has not executed (they perform a check with the 
* `throwIfNotSetup` method). The setup method ensures that the
* studySetup data passed in is valid per the studySetup schema.
*/

/*
* TODO glind survey / urls & query args
*/
const EXPORTED_SYMBOLS = ["studyUtils"];

const UTILS_VERSION = require("../../../package.json").version;
const PACKET_VERSION = 3;

const { utils: Cu } = Components;
Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.importGlobalProperties(["URL", "crypto", "URLSearchParams"]);

let log;
const studyUtilsLoggingLevel = "Trace"; // Fatal: 70, Error: 60, Warn: 50, Info: 40, Config: 30, Debug: 20, Trace: 10, All: -1,

// telemetry utils
const CID = Cu.import("resource://gre/modules/ClientID.jsm", null);
const { TelemetryController } = Cu.import(
  "resource://gre/modules/TelemetryController.jsm",
  null,
);
const { TelemetryEnvironment } = Cu.import(
  "resource://gre/modules/TelemetryEnvironment.jsm",
  null,
);

/*
* Set-up JSON schema validation
* Schemas are used to validate an input (here, via AJV at runtime)
* Schemas here are used for:
*  - Telemetry (Ensure correct Parquet format for different types of
*    outbound packets):
*    - "shield-study": shield study state and outcome data common to all
*      shield studies.
*    - "shield-study-addon": addon-specific probe data, with `attributes`
*      (used to capture feature-specific state) sent as Map(string,string).
*    - "shield-study-error": data used to notify, group and count some kinds
*      of errors from shield studies
*/
const schemas = {
  "shield-study": require("shield-study-schemas/schemas-client/shield-study.schema.json"), // eslint-disable-line max-len
  "shield-study-addon": require("shield-study-schemas/schemas-client/shield-study-addon.schema.json"), // eslint-disable-line max-len
  "shield-study-error": require("shield-study-schemas/schemas-client/shield-study-error.schema.json"), // eslint-disable-line max-len
};
import jsonschema from "./jsonschema";

/**
 * Note: This is the deep merge from the addon-sdk (sdk/util/object.js).
 * Probably deeper than we need. Unlike the shallow merge with the
 * spread operator (const c = {...a, ...b}), this function can be configured
 * to copy non-enumerable properties, symbols, and property descriptors.
 *
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
 * @param {...Object} source - two or more object arguments
 * @returns {Object} - the resulting merged object
 */
function merge(source) {
  const optionsDefault = {
    names: true,
    symbols: true,
    nonEnumerables: true,
  };
  /**
   * Gets object's own property symbols and/or names, including non-enumerables
   * by default
   * @param {Object} object - the object for which to get own property symbols
   * and names
   * @param {Object} options - object indicating what kinds of properties to
   * merge
   * @param {boolean} options.name - True if function should return object's own
   * property names
   * @param {boolean} options.symbols - True if function should return
   * object's own property symbols
   * @param {boolean} options.nonEnumerables - True if function should return
   * object's non-enumerable own property names
   * @returns {string[]|symbol[]} - An array of own property names and/or
   * symbols for object
   */
  function getOwnPropertyIdentifiers(object, options = optionsDefault) {
    const symbols = !options.symbols
      ? []
      : Object.getOwnPropertySymbols(object);

    // eslint-disable-next-line
    const names = !options.names
      ? []
      : options.nonEnumerables
        ? Object.getOwnPropertyNames(object)
        : Object.keys(object);
    return [...names, ...symbols];
  }
  /*
  * descriptor: an object whose own enumerable properties constitute descriptors
  * for the properties from arguments[1]+ to be defined or modified in
  * arguments[0]
  */
  const descriptor = {};
  /*
  * `Boolean` converts the first parameter to a boolean value. Any object is
  * converted to `true` where `null` and `undefined` becames `false`. Therefore
  * the `filter` method will keep only objects that are defined and not null.
  */
  Array.slice(arguments, 1)
    .filter(Boolean)
    .forEach(properties => {
      getOwnPropertyIdentifiers(properties).forEach(name => {
        descriptor[name] = Object.getOwnPropertyDescriptor(properties, name);
      });
    });
  return Object.defineProperties(source, descriptor);
}

/**
 * Appends a query string to a url.
 * @param {string} url - a base url to append; must be static (data) or external
 * @param {Object} args - query arguments, one or more object literal used to
 * build a query string
 * @returns {string} - an absolute url appended with a query string
 */
function mergeQueryArgs(url, ...args) {
  // currently left to right
  // TODO, glind, decide order of merge here
  // TODO, use Object.assign, or ES7 spread
  const U = new URL(url);
  // get the query string already attached to url, if it exists
  let q = U.search || "?";
  // create an interface to interact with the query string
  q = new URLSearchParams(q);
  const merged = merge({}, ...args);
  // Set each search parameter in "merged" to its value in the query string,
  // building up the query string one search parameter at a time.
  Object.keys(merged).forEach(k => {
    // k, the search parameter (ex: fxVersion)
    // q.get(k), returns the value of k, in query string, q (ex: 57.0.1a)
    log.debug(q.get(k), k, merged[k]);
    q.set(k, merged[k]);
  });
  // append our new query string to the URL object made with "url"
  U.search = q.toString();
  // return the full url, with the appended query string
  return U.toString();
}

/**
 * Class representing utilities for shield studies.
 */
class StudyUtils {
  /**
   * Create a StudyUtils instance.
   */
  constructor() {
    /*
    * TODO glind Answer: no.  see if you can merge the construtor and setup
    * and export the class, rather than a singleton
    */
    /**
     * Handles a message received by the webExtension, sending a response back.
     * @param {Object} webExtensionMsg object, see its schema
     * @param {boolean} webExtensionMsg.shield - Whether or not the message
     * is a shield message (intended for StudyUtils)
     * @param {string} webExtensionMsg.msg - StudyUtils method to be called
     *from the webExtension
     * @param {*} webExtensionMsg.data - Data sent from webExtension
     * @param {Object} sender - Details about the message sender, see
     * runtime.onMessage MDN docs
     * @param {responseCallback} sendResponse - The callback to send a response
     * back to the webExtension
     * @returns {boolean|undefined} - true if the message has been processed
     * (shield message) or ignored (non-shield message)
     */
    this.respondToWebExtensionMessage = function(
      { shield, msg, data },
      sender,
      sendResponse,
    ) {
      // @TODO glind: make sure we're using the webExtensionMsg schema
      if (!shield) return true;
      const allowedMethods = ["endStudy", "telemetry", "info"];
      if (!allowedMethods.includes(msg)) {
        const errStr1 = "respondToWebExtensionMessage:";
        const errStr2 = "is not in allowed studyUtils methods:";
        throw new Error(`${errStr1} "${msg}" ${errStr2} ${allowedMethods}`);
      }
      /*
        * handle async
        * Execute the StudyUtils method requested by the webExtension
        * then send the webExtension a response with their return value
        */
      Promise.resolve(this[msg](data)).then(
        function(ans) {
          log.debug("respondingTo", msg, ans);
          sendResponse(ans);
        },
        // function error eventually
      );
      return true;
      /* Ensure this method is bound to the instance of studyUtils, see
        * callsite in bootstrap.js
        * TODO glind: bdanforth's claim: making this function a StudyUtils
        * method would also do this.
        */
    }.bind(this);

    /*
    * Expose sampling methods onto the exported studyUtils singleton, for use
    * by any Components.utils-importing module
    */
    this.sampling = sampling;

    // expose schemas
    this.schemas = schemas;

    // expose validation methods
    this.jsonschema = jsonschema;

    this.REASONS = REASONS;
  }

  /**
   * Checks if the StudyUtils.setup method has been called
   * @param {string} name - the name of a StudyUtils method
   * @returns {void}
   */
  throwIfNotSetup(name = "unknown") {
    if (!this._isSetup)
      throw new Error(
        name + ": this method can't be used until `setup` is called",
      );
  }

  /**
   * Validates the studySetup object passed in from the addon.
   * @param {Object} studySetup - the studySetup object, see schema.studySetup.json
   * @returns {StudyUtils} - the StudyUtils class instance
   */
  setup(studySetup) {
    log = createLog("shield-study-utils", studyUtilsLoggingLevel);
    log.debug("setting up!");
    this.studySetup = studySetup;
    this._isSetup = true;
    return this;
  }

  /**
   * Resets the state of the study. Suggested use is for testing.
   * @returns {void}
   */
  reset() {
    this.studySetup = {};
    delete this._variation;
    this._isSetup = false;
  }

  /**
   * @async
   * Opens a new tab that loads a page with the specified URL.
   * @param {string} url - the url of a page
   * @param {Object} params - optional, see
   * https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/Method/addTab
   * @returns {void}
   */
  async openTab(url, params = {}) {
    this.throwIfNotSetup("openTab");
    log.debug(url, params);
    log.debug("opening this formatted tab", url, params);
    if (!Services.wm.getMostRecentWindow("navigator:browser").gBrowser) {
      /*
      * Automated tests run faster than Firefox opens windows.
      * TODO: Find less gross way to do this
      * Wait for the window to be opened
      */
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
    Services.wm
      .getMostRecentWindow("navigator:browser")
      .gBrowser.addTab(url, params);
  }

  /**
   * @async
   * Gets the telemetry client ID for the user.
   * @returns {string} - the telemetry client ID
   */
  async getTelemetryId() {
    const id = TelemetryController.clientID;
    /* istanbul ignore next */
    if (id === undefined) {
      return await CID.ClientIDImpl._doLoadClientID();
    }
    return id;
  }

  /**
   * Sets the variation for the StudyUtils instance.
   * @param {Object} variation - the study variation for this user
   * @returns {StudyUtils} - the StudyUtils class instance
   */
  setVariation(variation) {
    this.throwIfNotSetup("setVariation");
    this._variation = variation;
    return this;
  }

  /**
   * Gets the variation for the StudyUtils instance.
   * @returns {Object} - the study variation for this user
   */
  getVariation() {
    this.throwIfNotSetup("getvariation");
    return this._variation;
  }

  /**
   * @async
   * Deterministically selects and returns the study variation for the user.
   * @param {Object[]} weightedVariations - see schema.weightedVariations.json
   * @param {Number} fraction - a number (0 <= fraction < 1); can be set explicitly for testing
   * @returns {Object} - the study variation for this user
   */
  async deterministicVariation(weightedVariations, fraction = null) {
    // this is the standard arm choosing method
    if (fraction === null) {
      // hash the studyName and telemetryId to get the same branch every time.
      this.throwIfNotSetup("deterministicVariation needs studyName");
      const clientId = await this.getTelemetryId();
      const studyName = this.studySetup.activeExperimentName;
      fraction = await this.sampling.hashFraction(studyName + clientId, 12);
    }
    return this.sampling.chooseWeighted(weightedVariations, fraction);
  }

  /**
   * Gets the Shield recipe client ID.
   * @returns {string} - the Shield recipe client ID.
   */
  getShieldId() {
    const key = "extensions.shield-recipe-client.user_id";
    return Services.prefs.getCharPref(key, "");
  }

  /**
   * Packages information about the study into an object.
   * @returns {Object} - study information, see schema.studySetup.json
   */
  info() {
    log.debug("getting info");
    this.throwIfNotSetup("info");
    return {
      studyName: this.studySetup.activeExperimentName,
      addon: this.studySetup.addon,
      variation: this.getVariation(),
      shieldId: this.getShieldId(),
    };
  }

  /**
   * Get the telemetry configuration for the study.
   * @returns {Object} - the telemetry cofiguration, see schema.studySetup.json
   */
  // TODO glind, maybe this is getter / setter?
  get telemetryConfig() {
    this.throwIfNotSetup("telemetryConfig");
    return this.studySetup.telemetry;
  }

  /**
   * Sends an 'enter' telemetry ping for the study; should be called on addon
   * startup for the reason ADDON_INSTALL. For more on study states like 'enter'
   * see ABOUT.md at github.com/mozilla/shield-studies-addon-template
   * @returns {void}
   */
  firstSeen() {
    log.debug(`firstSeen`);
    this.throwIfNotSetup("firstSeen uses telemetry.");
    this._telemetry({ study_state: "enter" }, "shield-study");
  }

  /**
   * Marks the study's telemetry pings as being part of this experimental
   * cohort in a way that downstream data pipeline tools
   * (like ExperimentsViewer) can use it.
   * @returns {void}
   */
  setActive() {
    this.throwIfNotSetup("setActive uses telemetry.");
    const info = this.info();
    log.debug(
      "marking TelemetryEnvironment",
      info.studyName,
      info.variation.name,
    );
    TelemetryEnvironment.setExperimentActive(
      info.studyName,
      info.variation.name,
    );
  }

  /**
   * Removes the study from the active list of telemetry experiments
   * @returns {void}
   */
  unsetActive() {
    this.throwIfNotSetup("unsetActive uses telemetry.");
    const info = this.info();
    log.debug(
      "unmarking TelemetryEnvironment",
      info.studyName,
      info.variation.name,
    );
    TelemetryEnvironment.setExperimentInactive(info.studyName);
  }

  /**
   * Uninstalls the shield study addon, given its addon id.
   * @param {string} id - the addon id
   * @returns {void}
   */
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
   * Adds the study to the active list of telemetry experiments and sends the
   * "installed" telemetry ping if applicable
   * @param {string} reason - The reason the addon has started up
   * @returns {void}
   */
  async startup({ reason }) {
    this.throwIfNotSetup("startup");
    log.debug(`startup ${reason}`);
    this.setActive();
    if (reason === REASONS.ADDON_INSTALL) {
      this._telemetry({ study_state: "installed" }, "shield-study");
    }
  }

  /**
   * @async
   * Ends the study:
   *  - Removes the study from the active list of telemetry experiments
   *  - Opens a new tab at a specified URL, if present (e.g. for a survey)
   *  - Sends a telemetry ping about the nature of the ending
   *    (positive, neutral, negative)
   *  - Sends an exit telemetry ping
   * @param {Object} param - A details object describing why the study is ending
   * @param {string} param.reason - The reason the study is ending, see
   * schema.studySetup.json
   * @param {string} param.fullname -  optional, the full name of the study
   * state, see schema.studySetup.json
   * @returns {void}
   */
  async endStudy({ reason, fullname }) {
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
    /*
    * Check if the study ending shows the user a page in a new tab
    * (ex: survey, explanation, etc.)
    */
    const ending = this.studySetup.endings[reason];
    if (ending) {
      // baseUrl: needs to be appended with query arguments before use,
      // exactUrl: used as is
      const { baseUrl, exactUrl } = ending;
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
        this._telemetry({ study_state: reason, fullname }, "shield-study");
        break;
      default:
        this._telemetry(
          {
            study_state: "ended-neutral",
            study_state_fullname: reason,
          },
          "shield-study",
        );
      // unless we know better TODO grl
    }
    // these are all exits
    this._telemetry({ study_state: "exit" }, "shield-study");
    this.uninstall(); // TODO glind. should be controllable by arg?
  }

  /**
   * @async
   * Builds an object whose properties are query arguments that can be
   * appended to a study ending url
   * @returns {Object} - the query arguments for the study
   */
  async endingQueryArgs() {
    // TODO glind, make this back breaking!
    this.throwIfNotSetup("endingQueryArgs");
    const info = this.info();
    const who = await this.getTelemetryId();
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
   * Validates and submits telemetry pings from StudyUtils.
   * @param {Object} data - the data to send as part of the telemetry packet
   * @param {string} bucket - the type of telemetry packet to be sent
   * @returns {Promise|boolean} - A promise that resolves with the ping id
   * once the ping is stored or sent, or false if
   *   - there is a validation error,
   *   - the packet is of type "shield-study-error"
   *   - the study's telemetryConfig.send is set to false
   */
  async _telemetry(data, bucket = "shield-study-addon") {
    this.throwIfNotSetup("_telemetry");
    log.debug(`telemetry in:  ${bucket} ${JSON.stringify(data)}`);
    const info = this.info();
    const payload = {
      version: PACKET_VERSION,
      study_name: info.studyName,
      branch: info.variation.name,
      addon_version: info.addon.version,
      shield_version: UTILS_VERSION,
      type: bucket,
      data,
      testing: !this.telemetryConfig.removeTestingFlag,
    };

    let validation;
    /* istanbul ignore next */
    try {
      validation = jsonschema.validate(payload, schemas[bucket]);
    } catch (err) {
      // Catch failures of unknown origin (could be library, addon, system...)
      // if validation broke, GIVE UP.
      log.error(err);
      return false;
    }
    /*
    * Handle validation errors by sending a "shield-study-error"
    * telemetry ping with the error report.
    * If the invalid payload is itself of type "shield-study-error",
    * throw an error (to avoid a possible infinite loop).
    */
    if (validation.errors.length) {
      const errorReport = {
        error_id: "jsonschema-validation",
        error_source: "addon",
        severity: "fatal",
        message: JSON.stringify(validation.errors),
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
    const telOptions = { addClientId: true, addEnvironment: true };
    if (!this.telemetryConfig.send) {
      log.debug("NOT sending.  `telemetryConfig.send` is false");
      return false;
    }
    return TelemetryController.submitExternalPing(bucket, payload, telOptions);
  }

  /**
   * @async
   * Validates and submits telemetry pings from the addon; mostly from
   * webExtension messages.
   * @param {Object} data - the data to send as part of the telemetry packet
   * @returns {Promise|boolean} - see StudyUtils._telemetry
   */
  async telemetry(data) {
    this.throwIfNotSetup("telemetry");
    log.debug(`telemetry ${JSON.stringify(data)}`);
    const toSubmit = {
      attributes: data,
    };
    // lets check early, and respond with something useful?
    return this._telemetry(toSubmit, "shield-study-addon");
  }

  /**
   * Submits error report telemetry pings.
   * @param {Object} errorReport - the error report, see StudyUtils._telemetry
   * @returns {Promise|boolean} - see StudyUtils._telemetry
   */
  telemetryError(errorReport) {
    return this._telemetry(errorReport, "shield-study-error");
  }

  /**
   * Sets the logging level. This is can be called from the addon, even
   * after the log has been created.
   * @param {string} descriptor - the Log level (e.g. "trace", "error", ...)
   * @returns {void}
   */
  setLoggingLevel(descriptor) {
    log.level = Log.Level[descriptor];
  }
}

/**
 * Creates a log for debugging.
 * Note: Log.jsm is used over Console.log/warn/error because:
 *   - Console has limited log levels
 *   - Console is not pref-controllable. Log can be turned on and off using
 *     studySetup.log (see ./addon/Config.jsm in
 *     github.com/mozilla/shield-study-addon-template)
 *   - Console can create linting errors and warnings.
 * @param {string} name - the name of the Logger instance
 * @param {string} levelWord - the Log level (e.g. "trace", "error", ...)
 * @returns {Object} - the Logger instance, see gre/modules/Log.jsm
 */
function createLog(name, levelWord) {
  Cu.import("resource://gre/modules/Log.jsm");
  const L = Log.repository.getLogger(name);
  L.addAppender(new Log.ConsoleAppender(new Log.BasicFormatter()));
  // should be a config / pref
  L.level = Log.Level[levelWord] || Log.Level.Debug;
  L.debug("log made", name, levelWord, Log.Level[levelWord]);
  return L;
}

// addon state change reasons
const REASONS = {
  APP_STARTUP: 1, // The application is starting up.
  APP_SHUTDOWN: 2, // The application is shutting down.
  ADDON_ENABLE: 3, // The add-on is being enabled.
  ADDON_DISABLE: 4, // The add-on is being disabled. (Also sent at uninstall)
  ADDON_INSTALL: 5, // The add-on is being installed.
  ADDON_UNINSTALL: 6, // The add-on is being uninstalled.
  ADDON_UPGRADE: 7, // The add-on is being upgraded.
  ADDON_DOWNGRADE: 8, // The add-on is being downgraded.
};
for (const r in REASONS) {
  REASONS[REASONS[r]] = r;
}

// Actually create the singleton.
const studyUtils = new StudyUtils();

// to make this work with webpack!
this.EXPORTED_SYMBOLS = EXPORTED_SYMBOLS;
this.studyUtils = studyUtils;
