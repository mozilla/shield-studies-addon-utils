/* eslint-env commonjs */

import { getPingSize } from "../getPingSize";

const { TelemetryController } = ChromeUtils.import(
  "resource://gre/modules/TelemetryController.jsm",
  null,
);
const { ClientID } = ChromeUtils.import(
  "resource://gre/modules/ClientID.jsm",
  {},
);
// ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");

// eslint-disable-next-line no-undef
// const { ExtensionError } = ExtensionUtils;

class ShieldTelemetryPipeline {
  /**
   * @param {object} studyUtils The studyUtils instance from where this class was instantiated
   */
  constructor(studyUtils) {
    // console.log("studyUtils", studyUtils);
  }

  /**
   * @returns {Promise<String>} The telemetry client id
   */
  async getTelemetryId() {
    return ClientID.getClientID();
  }

  /**
   * @param {String} bucket The type of telemetry payload
   * @param {Object} payload The telemetry payload
   * @returns {Promise<String>} The ID of the ping that was submitted
   */
  async sendTelemetry(bucket, payload) {
    const telOptions = { addClientId: true, addEnvironment: true };
    return TelemetryController.submitExternalPing(bucket, payload, telOptions);
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
    return getPingSize(payload);
  }
}

export default ShieldTelemetryPipeline;
