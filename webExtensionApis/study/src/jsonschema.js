const Ajv = require("ajv/dist/ajv.min.js");
const ajv = new Ajv();

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
      throw new Error(JSON.stringify(ajv.errors));
    }
    return true;
  },
};

export default jsonschema;
