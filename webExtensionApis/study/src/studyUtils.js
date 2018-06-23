/* eslint-env commonjs */

"use strict";

import sampling from "./sampling";
import logger from "./logger";

/*
* Supports the `browser.study` webExtensionExperiment api.
*
* - Conversion of v4 "StudyUtils.jsm".
* - Contains the 'dangerous' code.
* - Creates and exports the `studyUtils` singleton
* - does all the actuall privileged work including Telemetry
*
* See API.md at:
* https://github.com/mozilla/shield-studies-addon-utils/blob/develop/docs/api.md
*
* Note: There are a number of methods that won't work if the
* setup method has not executed (they perform a check with the
* `throwIfNotSetup` method). The setup method ensures that the
* studySetup data passed in is valid per the studySetup schema.
*
* Tests for this module are at /test-addon.
*/

const UTILS_VERSION = require("../../../package.json").version;
const PACKET_VERSION = 3;

const Ajv = require("ajv");

const { Services } = ChromeUtils.import(
  "resource://gre/modules/Services.jsm",
  {},
);
const { Preferences } = ChromeUtils.import(
  "resource://gre/modules/Preferences.jsm",
  {},
);

Cu.importGlobalProperties(["URL", "crypto", "URLSearchParams"]);

const { ExtensionUtils } = ChromeUtils.import(
  "resource://gre/modules/ExtensionUtils.jsm",
  {},
);
// eslint-disable-next-line no-undef
const { ExtensionError } = ExtensionUtils;

// telemetry utils
const CID = ChromeUtils.import("resource://gre/modules/ClientID.jsm", {});
const { TelemetryController } = ChromeUtils.import(
  "resource://gre/modules/TelemetryController.jsm",
  null,
);
const { TelemetryEnvironment } = ChromeUtils.import(
  "resource://gre/modules/TelemetryEnvironment.jsm",
  null,
);

/**
 * Telemetry Probe JSON schema validation (via AJV at runtime)
 *
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
  // Telemetry PingType schemas
  "shield-study": require("shield-study-schemas/schemas-client/shield-study.schema.json"), // eslint-disable-line max-len
  "shield-study-addon": require("shield-study-schemas/schemas-client/shield-study-addon.schema.json"), // eslint-disable-line max-len
  "shield-study-error": require("shield-study-schemas/schemas-client/shield-study-error.schema.json"), // eslint-disable-line max-len
};
import jsonschema from "./jsonschema";

/**
 * Schemas for enforcing objects relating to the public `browser.study` api
 */
class Guard {
  /**
   * @param {object} identifiedSchemas a jsonschema with ids
   *
   */
  constructor(identifiedSchemas) {
    logger.debug("wanting guard");
    const ajv = new Ajv({
      // important:  these options make ajv behave like 04, not draft-07
      schemaId: "auto", // id UNLESS $id is defined. (draft 5)
      meta: require("ajv/lib/refs/json-schema-draft-04.json"),
      extendRefs: true, // optional, current default is to 'fail', spec behaviour is to 'ignore'
      unknownFormats: "ignore", // optional, current default is true (fail)
      validateSchema: false, // used by addSchema.

      // schemas used by this *particular guard*
      // schemas: identifiedSchemas,
      /* NOTE:  adding these at constructor isn't validating against 04 */
    });

    for (const s of identifiedSchemas) {
      logger.debug(`adding schemas ${s}`);

      ajv.addSchema(s);
    }
    this.ajv = ajv;
    logger.debug("Ajv schemas", Object.keys(this.ajv._schemas));
  }

  it(schemaId, arg, msg = null) {
    logger.debug("about to guard", schemaId, arg);
    const valid = this.ajv.validate(schemaId, arg);
    if (!valid) {
      throw new ExtensionError(
        `GuardError: ${schemaId} ${JSON.stringify(
          this.ajv.errors,
        )} ${JSON.stringify(arg)} ${msg}`,
      );
    }
  }
}
const guard = new Guard(require("../schema.json")[0].types);

/**  Simple spread/rest based merge, using Object.assign.
 *
 * Right-most overrides, top level only, by full value replacement.
 *
 * Note: Unlike deep merges might not handle symbols and other things.
 *
 * @param {...Object} sources - 1 or more sources
 * @returns {Object} - the resulting merged object
 */
function merge(...sources) {
  return Object.assign({}, ...sources);
}

/**
 * Appends a query string to a url.
 * @param {string} url - a base url to append; must be static (data) or external
 * @param {Object} args - query arguments, one or more object literal used to
 * build a query string
 *
 * @returns {string} - an absolute url appended with a query string
 */
function mergeQueryArgs(url, ...args) {
  const U = new URL(url);
  // get the query string already attached to url, if it exists
  let q = U.search || "?";
  // create an interface to interact with the query string
  q = new URLSearchParams(q);
  const merged = merge({}, ...args);
  // Set each search parameter in "merged" to its value in the query string,
  // building up the query string one search parameter at a time.
  Object.keys(merged).forEach(k => {
    q.set(k, merged[k]);
  });
  // append our new query string to the URL object made with "url"
  U.search = q.toString();
  // return the full url, with the appended query string
  return U.toString();
}

/**
 * Class representing utilities singleton for shield studies.
 */
class StudyUtils {
  /**
   * Create a StudyUtils instance to power the `browser.study` API
   *
   * About `this._internals`:
   * - variation:  (chosen variation, `setup` )
   * - isEnding: bool  `endStudy`
   * - isSetup: bool   `setup`
   * - isFirstRun: bool `setup`, based on pref
   * - studySetup: bool  `setup` the config
   * - seenTelemetry: object of lists of seen telemetry by bucket
   * - prefs: object of all created prefs and their names
   * - endingRequested: string of ending name
   * - endingReturns: object with useful ending instructions
   *
   * Returned by `studyDebug.getInternals()` for testing
   * Reset by `studyDebug.reset`  and `studyUtils.reset`
   *
   * About: `this._extensionManifest`
   * - mirrors the extensionManifest at the time of api creation
   * - used by uninstall, and to name the firstRunTimestamp pref
   *
   */
  constructor() {
    // Expose sampling methods onto the exported studyUtils singleton
    this.sampling = sampling;
    // expose schemas
    this.schemas = schemas;
    // expose jsonschema validation methods
    this.jsonschema = jsonschema;

    this._extensionManifest = {};

    // internals, also used by `studyDebug.getInternals()`
    // either setup() or reset() will create, using extensionManifest
    this._internals = {};
  }

  _createInternals() {
    if (!this._extensionManifest) {
      throw new ExtensionError(
        "_createInternals needs `setExtensionManifest`. This should be done by `getApi`.",
      );
    }
    function makeWidgetId(id) {
      id = id.toLowerCase();
      // FIXME: This allows for collisions.
      // WebExt hasn't ever had a problem.
      return id.replace(/[^a-z0-9_-]/g, "_");
    }

    const widgetId = makeWidgetId(
      this._extensionManifest.applications.gecko.id,
    );

    const internals = {
      widgetId,
      variation: undefined,
      studySetup: undefined,
      isFirstRun: false,
      isSetup: false,
      isEnding: false,
      isEnded: false,
      seenTelemetry: {
        "shield-study": [],
        "shield-study-addon": [],
        "shield-study-error": [],
      },
      prefs: {
        firstRunTimestamp: `shield.${widgetId}.firstRunTimestamp`,
      },
      endingRequested: undefined,
      endingReturned: undefined,
    };
    Object.seal(internals);
    return internals;
  }

  /**
   * Checks if the StudyUtils.setup method has been called
   * @param {string} name - the name of a StudyUtils method
   * @returns {void}
   */
  throwIfNotSetup(name = "unknown") {
    if (!this._internals.isSetup)
      throw new ExtensionError(
        name + ": this method can't be used until `setup` is called",
      );
  }

  /**
   * Validates the studySetup object passed in from the addon.
   * @param {Object} studySetup - the studySetup object, see schema.studySetup.json
   * @returns {StudyUtils} - the StudyUtils class instance
   */
  async setup(studySetup) {
    if (!this._internals) {
      throw new ExtensionError("StudyUtils internals are not initiated");
    }

    logger.debug(`setting up! -- ${JSON.stringify(studySetup)}`);

    if (this._internals.isSetup) {
      throw new ExtensionError("StudyUtils is already setup");
    }
    guard.it("studySetup", studySetup, "(in studySetup)");

    function getVariationByName(name, variations) {
      if (!name) return null;
      const chosen = variations.filter(x => x.name === name)[0];
      if (!chosen) {
        throw new ExtensionError(
          `setup error: testing.variationName "${name}" not in ${JSON.stringify(
            variations,
          )}`,
        );
      }
      return chosen;
    }
    // variation:  decide and set
    const variation =
      getVariationByName(
        studySetup.testing.variationName,
        studySetup.weightedVariations,
      ) ||
      (await this._deterministicVariation(
        studySetup.activeExperimentName,
        studySetup.weightedVariations,
      ));
    logger.debug(`setting up: variation ${variation.name}`);

    this._internals.variation = variation;
    this._internals.studySetup = studySetup;
    this._internals.isSetup = true;

    // isFirstRun?  ever seen before?
    const firstRunTimestamp = this.getFirstRunTimestamp();
    // 'firstSeen' is the first telemetry we attempt to send.  needs 'isSetup'
    if (firstRunTimestamp) {
      this._internals.isFirstRun = false;
    } else {
      // 'enter' telemetry, and firstSeen
      await studyUtils.firstSeen();
    }

    // Note: is allowed  to enroll is handled at API.
    // FIXME: 5.1 maybe do it here?
    return this;
  }

  /**
   * Resets the state of the study. Suggested use is for testing.
   * @returns {Object} internals internals
   */
  reset() {
    this._internals = this._createInternals();
    this.resetFirstRunTimestamp();
  }

  /**
   * Gets the variation for the StudyUtils instance.
   * @returns {Object} - the study variation for this user
   */
  getVariation() {
    this.throwIfNotSetup("getvariation");
    logger.debug(`getVariation: ${JSON.stringify(this._internals.variation)}`);
    return this._internals.variation;
  }

  setExtensionManifest(extensionManifest) {
    this._extensionManifest = extensionManifest;
  }

  getFirstRunTimestamp() {
    return (
      this._internals.studySetup.testing.firstRunTimestamp ||
      Number(
        Services.prefs.getStringPref(
          this._internals.prefs.firstRunTimestamp,
          0,
        ),
      )
    );
  }

  setFirstRunTimestamp(timestamp) {
    const pref = this._internals.prefs.firstRunTimestamp;
    return Services.prefs.setStringPref(pref, "" + timestamp);
  }

  resetFirstRunTimestamp(timestamp) {
    const pref = this._internals.prefs.firstRunTimestamp;
    Preferences.reset(pref);
  }

  /** Calculate time left in study given `studySetup.expire.days` and firstRunTimestamp
   *
   * Safe to use with `browser.alarms.create{ delayInMinutes, }`
   *
   * A value of 0 means "the past / now".
   *
   * @return {Number} delayInMinutes Either the time left or Number.MAX_SAFE_INTEGER
   */
  getDelayInMinutes() {
    if (this._internals.studySetup.testing.expired === true) {
      return 0;
    }
    const toMinutes = 1 / (1000 * 60);
    const days = this._internals.studySetup.expire.days;
    let delayInMs = Number.MAX_SAFE_INTEGER; // approx 286,000 years
    if (days) {
      // days in ms
      const ms = days * 86400 * 1000;
      const firstrun = this.getFirstRunTimestamp();
      delayInMs = Math.max(firstrun + ms - Date.now(), 0);
    }
    return delayInMs * toMinutes;
  }

  /**
   * Gets the telemetry client ID for the user.
   * @returns {string} - the telemetry client ID
   */
  async getTelemetryId() {
    const id = TelemetryController.clientID;
    /* istanbul ignore next */
    if (id === undefined) {
      return CID.ClientIDImpl._doLoadClientID();
    }
    return id;
  }

  /**
   * Gets the Shield recipe client ID.
   * @returns {string} - the Shield recipe client ID.
   */
  getShieldId() {
    const key = "extensions.shield-recipe-client.user_id";
    return Services.prefs.getStringPref(key, "");
  }

  /**
   * Packages information about the study into an object.
   * @returns {Object} - study information, see schema.studySetup.json
   */
  info() {
    logger.debug("getting info");
    this.throwIfNotSetup("info");

    const studyInfo = {
      activeExperimentName: this._internals.studySetup.activeExperimentName,
      isFirstRun: this._internals.isFirstRun,
      firstRunTimestamp: this.getFirstRunTimestamp(),
      variation: this.getVariation(),
      shieldId: this.getShieldId(),
      delayInMinutes: this.getDelayInMinutes(),
    };
    guard.it("studyInfoObject", studyInfo, "(in studyInfo)");
    return studyInfo;
  }

  /**
   * Get the telemetry configuration for the study.
   * @returns {Object} - the telemetry cofiguration, see schema.studySetup.json
   */
  get telemetryConfig() {
    this.throwIfNotSetup("telemetryConfig");
    return this._internals.studySetup.telemetry;
  }

  /**
   * Deterministically selects and returns the study variation for the user.
   * @param {string} activeExperimentName name to use as part of the hash
   * @param {Object[]} weightedVariations - see schema.weightedVariations.json
   * @param {Number} fraction - a number (0 <= fraction < 1); can be set explicitly for testing
   * @returns {Object} - the study variation for this user
   */
  async _deterministicVariation(
    activeExperimentName,
    weightedVariations,
    fraction = null,
  ) {
    // this is the standard arm choosing method
    // TODO, allow 'pioneer' algorithm
    if (fraction === null) {
      // hash the studyName and telemetryId to get the same branch every time.
      const clientId = await this.getTelemetryId();
      fraction = await this.sampling.hashFraction(
        activeExperimentName + clientId,
        12,
      );
    }
    logger.debug(`_deterministicVariation`, weightedVariations);
    return this.sampling.chooseWeighted(weightedVariations, fraction);
  }

  /**
   * Sends an 'enter' telemetry ping for the study; should be called on addon
   * startup for the reason ADDON_INSTALL. For more on study states like 'enter'
   * see ABOUT.md at github.com/mozilla/shield-studies-addon-template
   *
   * Side effects:
   * - sends 'enter'
   * - sets this._internals.prefs.firstRunTimestamp to Date.now()
   *
   * @returns {void}
   */
  async firstSeen() {
    this.throwIfNotSetup("firstSeen uses telemetry.");
    logger.debug(`attempting firstSeen`);
    this._internals.isFirstRun = true;
    await this._telemetry({ study_state: "enter" }, "shield-study");
    this.setFirstRunTimestamp("" + Date.now());
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
    logger.debug(
      "marking TelemetryEnvironment",
      info.activeExperimentName,
      info.variation.name,
    );
    TelemetryEnvironment.setExperimentActive(
      info.activeExperimentName,
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
    logger.debug(
      "unmarking TelemetryEnvironment",
      info.activeExperimentName,
      info.variation.name,
    );
    TelemetryEnvironment.setExperimentInactive(info.activeExperimentName);
  }

  /**
   * Adds the study to the active list of telemetry experiments and sends the
   * "installed" telemetry ping if applicable
   * @param {string} reason - The reason the addon has started up
   * @returns {void}
   */
  async startup() {
    this.throwIfNotSetup("startup");
    const isFirstRun = this._internals.isFirstRun;
    logger.debug(`startup.  setting active. isFirstRun? ${isFirstRun}`);
    this.setActive();
    if (isFirstRun) {
      await this._telemetry({ study_state: "installed" }, "shield-study");
    }
  }

  /**
   * Ends the study:
   *  - Removes the study from the active list of telemetry experiments
   *  - Sends a telemetry ping about the nature of the ending
   *    (positive, neutral, negative)
   *  - Sends an exit telemetry ping
   * @param {string} endingName - The reason the study is ending, see
   *    schema.studySetup.json
   * @returns {Object} endingReturned _internals.endingReturned
   */
  async endStudy(endingName) {
    this.throwIfNotSetup("endStudy");

    // also handle default endings.
    const alwaysHandle = ["ineligible", "expired", "user-disable"];
    let ending = this._internals.studySetup.endings[endingName];
    if (!ending) {
      // a 'no-action' ending is okay for the 'always handle'
      if (alwaysHandle.includes(endingName)) {
        ending = {};
      } else {
        throw new ExtensionError(`${endingName} isn't known ending`);
      }
    }

    // throw if already ending
    if (this._internals.isEnding) {
      logger.debug("endStudy, already ending!");
      throw new ExtensionError(
        `endStudy, requested:  ${endingName}, but already ending ${
          this._internals.endingRequested
        }`,
      );
    }

    // if not already ending, claim it.  We are first!
    this._internals.isEnding = true;
    this._internals.endingRequested = endingName;

    logger.debug(`endStudy ${endingName}`);
    await this.unsetActive();

    // do the work to end the studyUtils involvement

    // 1. Telemetry for ending
    const { fullname } = ending;
    let finalName = endingName;
    switch (endingName) {
      // handle the 'formal' endings (defined in parquet)
      case "ineligible":
      case "expired":
      case "user-disable":
      case "ended-positive":
      case "ended-neutral":
      case "ended-negative":
        await this._telemetry(
          {
            study_state: endingName,
            study_state_fullname: fullname || endingName,
          },
          "shield-study",
        );
        break;
      default:
        (finalName = ending.category || "ended-neutral"),
        // call all 'unknowns' as "ended-neutral"
        await this._telemetry(
          {
            study_state: finalName,
            study_state_fullname: endingName,
          },
          "shield-study",
        );
        break;
    }
    await this._telemetry({ study_state: "exit" }, "shield-study");

    // 2. create ending instructions for the webExt to use
    const out = {
      shouldUninstall: true,
      urls: [],
      endingName,
    };

    // baseUrls: needs to be appended with query arguments before use,
    // exactUrls: used as is
    const { baseUrls, exactUrls } = ending;
    if (exactUrls) {
      out.urls.push(...exactUrls);
    }
    const qa = await this.endingQueryArgs();
    qa.reason = finalName;
    qa.fullreason = endingName;

    if (baseUrls) {
      for (const baseUrl of baseUrls) {
        const fullUrl = mergeQueryArgs(baseUrl, qa);
        out.urls.push(fullUrl);
      }
    }

    out.queryArgs = qa;

    // 3. Tidy up the internals.
    this._internals.endingReturned = out;
    this._internals.isEnded = true; // done!
    return out;
  }

  /**
   * Builds an object whose properties are query arguments that can be
   * appended to a study ending url
   * @returns {Object} - the query arguments for the study
   */
  async endingQueryArgs() {
    this.throwIfNotSetup("endingQueryArgs");
    const info = this.info();
    const who = await this.getTelemetryId();
    const queryArgs = {
      shield: PACKET_VERSION,
      study: info.activeExperimentName,
      variation: info.variation.name,
      updateChannel: Services.appinfo.defaultUpdateChannel,
      fxVersion: Services.appinfo.version,
      addon: this._extensionManifest.version, // addon version
      who, // telemetry clientId
    };
    queryArgs.testing = Number(!this.telemetryConfig.removeTestingFlag);
    return queryArgs;
  }

  /**
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
    logger.debug(`telemetry in:  ${bucket} ${JSON.stringify(data)}`);
    const info = this.info();
    logger.debug(`telemetry INFO: ${JSON.stringify(info)}`);

    const payload = {
      version: PACKET_VERSION,
      study_name: info.activeExperimentName,
      branch: info.variation.name,
      addon_version: this._extensionManifest.version,
      shield_version: UTILS_VERSION,
      type: bucket,
      data,
      testing: !this.telemetryConfig.removeTestingFlag,
    };

    let validation;
    try {
      validation = jsonschema.validate(payload, schemas[bucket]);
    } catch (err) {
      // Catch failures of unknown origin (could be library, addon, system...)
      // if validation broke, GIVE UP.
      logger.error(err);
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
        logger.warn("cannot validate shield-study-error", data, bucket);
        return false; // just die, maybe should have a super escape hatch?
      }
      return this.telemetryError(errorReport);
    }
    logger.debug(`telemetry: ${JSON.stringify(payload)}`);

    // IFF it's a shield-study or error ping, which are few in number
    if (bucket === "shield-study" || bucket === "shield-study-error") {
      this._internals.seenTelemetry[bucket].push(payload);
    }

    // during developement, don't actually send
    if (!this.telemetryConfig.send) {
      logger.debug("NOT sending.  `telemetryConfig.send` is false");
      return false;
    }

    const telOptions = { addClientId: true, addEnvironment: true };
    return TelemetryController.submitExternalPing(bucket, payload, telOptions);
  }

  /**
   * Validates and submits telemetry pings from the addon; mostly from
   * webExtension messages.
   * @param {Object} data - the data to send as part of the telemetry packet
   * @returns {Promise|boolean} - see StudyUtils._telemetry
   */
  async telemetry(data) {
    this.throwIfNotSetup("telemetry");
    logger.debug(`telemetry ${JSON.stringify(data)}`);
    const toSubmit = {
      attributes: data,
    };
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
}

// TODO, use the usual es6 exports
// Actually create the singleton.
const studyUtils = new StudyUtils();
this.studyUtils = studyUtils;
