/* eslint-env commonjs */

/** Wraps basic jsonschema validation using Ajv */

ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");

const Ajv = require("ajv");
const ajv = new Ajv({
  // important:  these options make ajv behave like 04, not draft-07
  schemaId: "auto", // id UNLESS $id is defined. (draft 5)
  meta: require("ajv/lib/refs/json-schema-draft-04.json"),
  validateSchema: false,
});

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
};

export default jsonschema;
