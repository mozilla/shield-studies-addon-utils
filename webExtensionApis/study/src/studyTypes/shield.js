/* eslint-env commonjs */

import { getPingSize } from "../getPingSize";

const { TelemetryController } = ChromeUtils.import(
  "resource://gre/modules/TelemetryController.jsm",
  null,
);
const CID = ChromeUtils.import("resource://gre/modules/ClientID.jsm", {});
// ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");

// eslint-disable-next-line no-undef
// const { ExtensionError } = ExtensionUtils;

class ShieldStudyType {
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
    const id = TelemetryController.clientID;
    /* istanbul ignore next */
    if (id === undefined) {
      return CID.ClientIDImpl._doLoadClientID();
    }
    return id;
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

export default ShieldStudyType;
