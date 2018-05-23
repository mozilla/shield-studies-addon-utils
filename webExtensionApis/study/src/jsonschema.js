/* eslint-env commonjs */

ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");

// eslint-disable-next-line no-undef
const { ExtensionError } = ExtensionUtils;

const Ajv = require("ajv/dist/ajv.min.js");
const ajv = new Ajv({ schemaId: "auto" });
ajv.addMetaSchema(require("ajv/lib/refs/json-schema-draft-04.json"));

const jsonschema = {
  /**
   * Validates input data based on a specified schema
   * @param {Object} data - The data to be validated
   * @param {Object} schema - The schema to validate against
   * @returns {boolean} - Will return true if the data is valid
   */
  validate(data, schema) {
    const valid = ajv.validate(schema, data);
    return { valid, errors: ajv.errors || [] };
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
    if (!valid) {
      throw new ExtensionError(JSON.stringify(ajv.errors));
    }
    return true;
  },
};

export default jsonschema;
