/* eslint-env commonjs */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "(Pioneer)" }]*/

const { PioneerUtils } = require("pioneer-utils/dist/PioneerUtils.jsm");

class PioneerStudyType {
  /**
   * @param {object} studyUtils The studyUtils instance from where this class was instantiated
   */
  constructor(studyUtils) {
    console.log("studyUtils", studyUtils);
    console.log("PioneerUtils", PioneerUtils);
  }

  /**
   * @returns {Promise<*>}
   */
  async getTelemetryId() {
    const id = "foo";
    return id;
  }

  /**
   * @param bucket
   * @param payload
   * @returns {*|Promise}
   */
  sendTelemetry(bucket, payload) {
    console.log("bucket", bucket);
    console.log("payload", payload);
    return true;
  }
}

export default PioneerStudyType;
