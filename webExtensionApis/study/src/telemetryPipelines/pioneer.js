/* eslint-env commonjs */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "(Pioneer)" }]*/

import { utilsLogger } from "../logger";
import * as dataPermissions from "../dataPermissions";
import { getPingSize } from "../getPingSize";

const { Services } = ChromeUtils.import(
  "resource://gre/modules/Services.jsm",
  {},
);
const { TelemetryController } = ChromeUtils.import(
  "resource://gre/modules/TelemetryController.jsm",
  {},
);

const { generateUUID } = Cc["@mozilla.org/uuid-generator;1"].getService(
  Ci.nsIUUIDGenerator,
);

import {
  setCrypto as joseSetCrypto,
  Jose,
  JoseJWE,
} from "jose-jwe-jws/dist/jose-commonjs.js";

// The public keys used for encryption
import * as PUBLIC_KEYS from "./pioneer.public_keys.json";

const PIONEER_ID_PREF = "extensions.pioneer.cachedClientID";

const EVENTS = {
  INELIGIBLE: "ineligible",
  EXPIRED: "expired",
  USER_DISABLE: "user-disable",
  ENDED_POSITIVE: "ended-positive",
  ENDED_NEUTRAL: "ended-neutral",
  ENDED_NEGATIVE: "ended-negative",
};

// Make crypto available and make jose use it.
Cu.importGlobalProperties(["crypto"]);
joseSetCrypto(crypto);

/**
 * @typedef {Object} Config
 * @property {String} studyName
 *   Unique name of the study.
 *
 * @property {String?} telemetryEnv
 *   Optional. Which telemetry environment to send data to. Should be
 *   either ``"prod"`` or ``"stage"``. Defaults to ``"prod"``.
 */

/**
 * Utilities for making Pioneer Studies.
 */
class PioneerUtils {
  /**
   * @param {Config} config Object with Pioneer-related configuration as specified above
   */
  constructor(config) {
    this.config = config;
    this.encrypter = null;
    this._logger = null;
  }

  /**
   * @returns {Object} A public key
   */
  getPublicKey() {
    const env = this.config.telemetryEnv || "prod";
    return PUBLIC_KEYS[env];
  }

  /**
   * @returns {void}
   */
  setupEncrypter() {
    if (this.encrypter === null) {
      const pk = this.getPublicKey();
      const rsa_key = Jose.Utils.importRsaPublicKey(pk.key, "RSA-OAEP");
      const cryptographer = new Jose.WebCryptographer();
      this.encrypter = new JoseJWE.Encrypter(cryptographer, rsa_key);
    }
  }

  /**
   * @returns {String} Unique ID for a Pioneer user.
   */
  getPioneerId() {
    let id = Services.prefs.getCharPref(PIONEER_ID_PREF, "");

    if (!id) {
      // generateUUID adds leading and trailing "{" and "}". strip them off.
      id = generateUUID()
        .toString()
        .slice(1, -1);
      Services.prefs.setCharPref(PIONEER_ID_PREF, id);
    }

    return id;
  }

  /**
   * @private
   * @param {String} data The data to encrypt
   * @returns {String} The encrypted data
   */
  async encryptData(data) {
    this.setupEncrypter();
    return this.encrypter.encrypt(data);
  }

  /**
   * Constructs a payload object with encrypted data.
   *
   * @param {String} schemaName
   *   The name of the schema to be used for validation.
   *
   * @param {int} schemaVersion
   *   The version of the schema to be used for validation.
   *
   * @param {Object} data
   *   An object containing data to be encrypted and submitted.
   *
   * @returns {Object}
   *   A Telemetry payload object with the encrypted data.
   */
  async buildEncryptedPayload(schemaName, schemaVersion, data) {
    const pk = this.getPublicKey();

    return {
      encryptedData: await this.encryptData(JSON.stringify(data)),
      encryptionKeyId: pk.id,
      pioneerId: this.getPioneerId(),
      studyName: this.config.studyName,
      schemaName,
      schemaVersion,
    };
  }

  /**
   * Encrypts the given data and submits a properly formatted
   * Pioneer ping to Telemetry.
   *
   * @param {String} schemaName
   *   The name of the schema to be used for validation.
   *
   * @param {int} schemaVersion
   *   The version of the schema to be used for validation.
   *
   * @param {Object} data
   *   A object containing data to be encrypted and submitted.
   *
   * @param {Object} options
   *   An object with additional options for the function.
   *
   * @param {Boolean} options.force
   *   A boolean to indicate whether to force submission of the ping.
   *
   * @returns {String}
   *   The ID of the ping that was submitted
   */
  async submitEncryptedPing(schemaName, schemaVersion, data, options = {}) {
    // If the user is no longer opted in we should not be submitting pings.
    const isUserOptedIn = await dataPermissions.isUserOptedInToPioneer();
    if (!isUserOptedIn && !options.force) {
      return null;
    }

    const payload = await this.buildEncryptedPayload(
      schemaName,
      schemaVersion,
      data,
    );

    const telOptions = {
      addClientId: true,
      addEnvironment: true,
    };

    return TelemetryController.submitExternalPing(
      "pioneer-study",
      payload,
      telOptions,
    );
  }

  /**
   * Gets an object that is a mapping of all the available events.
   *
   * @returns {Object}
   *   An object with all the available events.
   */
  getAvailableEvents() {
    return EVENTS;
  }

  /**
   * Submits an encrypted event ping.
   *
   * @param {String} eventId
   *   The ID of the event that occured.
   *
   * @param {Object} options
   *   An object of options to be passed through to submitEncryptedPing
   *
   * @returns {String}
   *   The ID of the event ping that was submitted.
   */
  async submitEventPing(eventId, options = {}) {
    if (!Object.values(EVENTS).includes(eventId)) {
      throw new Error("Invalid event ID.");
    }
    return this.submitEncryptedPing("event", 1, { eventId }, options);
  }
}

class PioneerTelemetryPipeline {
  /**
   * @param {object} studyUtils The studyUtils instance from where this class was instantiated
   */
  constructor(studyUtils) {
    const Config = {
      studyName: studyUtils._extensionManifest.applications.gecko.id,
      telemetryEnv: "prod", // Currently unconfigurable parameter - defaulting to "prod" rather than "stage"
    };
    this.pioneerUtils = new PioneerUtils(Config);
    this.schemaVersion = 3; // Corresponds to the schema versions used in https://github.com/mozilla-services/mozilla-pipeline-schemas/tree/dev/templates/telemetry/shield-study (and the shield-study-addon, shield-study-error equivalents)
  }

  /**
   * @returns {Promise<String>} The ID of the event ping that was submitted.
   */
  async notifyNotEligible() {
    return this.notifyEndStudy(this.EVENTS.INELIGIBLE);
  }

  /**
   * @param {String?} eventId The ID of the event that occured.
   * @returns {Promise<String>} The ID of the event ping that was submitted.
   */
  async notifyEndStudy(eventId = EVENTS.ENDED_NEUTRAL) {
    return this.pioneerUtils.submitEventPing(eventId, { force: true });
  }

  /**
   * @returns {Promise<String>} Unique ID for a Pioneer user.
   */
  async getTelemetryId() {
    return this.pioneerUtils.getPioneerId();
  }

  /**
   * @param {String} bucket The type of telemetry payload
   * @param {Object} payload The telemetry payload
   * @returns {Promise<String>} The ID of the ping that was submitted
   */
  async sendTelemetry(bucket, payload) {
    const schemaName = bucket;
    return this._telemetry(schemaName, this.schemaVersion, payload);
  }

  /**
   * Encrypts the given data and submits a properly formatted
   * Pioneer ping to Telemetry.
   *
   * @param {String} schemaName
   *   The name of the schema to be used for validation.
   *
   * @param {int} schemaVersion
   *   The version of the schema to be used for validation.
   *
   * @param {Object} payload
   *   A object containing data to be encrypted and submitted.
   *
   * @returns {Promise<String>} The ID of the ping that was submitted
   * @private
   */
  async _telemetry(schemaName, schemaVersion, payload) {
    const pingId = await this.pioneerUtils.submitEncryptedPing(
      schemaName,
      schemaVersion,
      payload,
    );
    if (pingId) {
      utilsLogger.debug(
        "Pioneer Telemetry sent (encrypted)",
        JSON.stringify(payload),
      );
    } else {
      utilsLogger.debug(
        "Pioneer Telemetry not sent due to privacy preferences",
        JSON.stringify(payload),
      );
    }
    return pingId;
  }

  /**
   * Calculate the size of a ping.
   *
   * @param {String} bucket The type of telemetry payload
   *
   * @param {Object} payload
   *   The data payload of the ping.
   *
   * @returns {Promise<Number>}
   *   The total size of the ping.
   */
  async getPingSize(bucket, payload) {
    const schemaName = bucket;
    return this.getEncryptedPingSize(schemaName, this.schemaVersion, payload);
  }

  /**
   * Calculate the size of a ping that has Pioneer encrypted data.
   *
   * @param {String} schemaName
   *   The name of the schema to be used for validation.
   *
   * @param {int} schemaVersion
   *   The version of the schema to be used for validation.
   *
   * @param {Object} data
   *   An object containing data to be encrypted and submitted.
   *
   * @returns {Promise<Number>}
   *   The total size of the ping.
   */
  async getEncryptedPingSize(schemaName, schemaVersion, data) {
    return getPingSize(
      await this.pioneerUtils.buildEncryptedPayload(
        schemaName,
        schemaVersion,
        data,
      ),
    );
  }
}

export default PioneerTelemetryPipeline;
