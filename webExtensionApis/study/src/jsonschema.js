/* eslint-env commonjs */

ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");

// eslint-disable-next-line no-undef
const { ExtensionError } = ExtensionUtils;

const Ajv = require("ajv/dist/ajv.min.js");
const ajv = new Ajv({
  // important:  these options make ajv behave like 04, not draft-07
  schemaId: "auto", // id UNLESS $id is defined. (draft 5)
  meta: require("ajv/lib/refs/json-schema-draft-04.json"),
  extendRefs: true, // optional, current default is to 'fail', spec behaviour is to 'ignore'
  unknownFormats: "ignore", // optional, current default is true (fail),
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
