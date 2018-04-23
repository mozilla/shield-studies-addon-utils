/* eslint-env node */

/**
 * given a proposed wee interface `schema.json`, lint and check it for
 * validity
 *
 * If exist, validate all `types` against `testcase`.
 */

const path = require("path");

const proposed = require(path.resolve(process.argv[2]));
const ajv = new require("ajv")();

const wee = require(path.resolve(
  path.join(__dirname, "wee-schema-schema.json"),
));

let clean = true;

// 1. is every 'type' valid jsonschema
//    do their testcase (if any) pass?
for (const i in proposed) {
  const ns = proposed[i];
  for (const j in ns.types || []) {
    const type = ns.types[j];
    let valid = ajv.validateSchema(type);
    if (!valid) {
      clean = false;
      console.error(
        `# SCHEMA ERROR: ${ns.namespace}.${type.name} "${type.id}"`,
      );
      console.error(ajv.errors);
    }

    // checking test cases if any
    if (!type.testcase) continue;
    valid = ajv.validate(type, type.testcase);
    if (!valid) {
      clean = false;
      console.error(
        `# testcase failed IN ${i}:${j} ${ns.namespace}.${type.name} "${
          type.id
        }"`,
      );
      console.error(ajv.errors);
    }
  }
}

// 2. Does every (function|event) 'parameter' have a valid jsonschema?
for (const i in proposed) {
  const ns = proposed[i];
  for (const j in ns.functions || []) {
    const type = ns.functions[j];
    for (const k in type.parameters) {
      const parameter = type.parameters[k];
      const valid = ajv.validateSchema(parameter);
      if (!valid) {
        clean = false;
        console.error(
          `# SCHEMA ERROR: ${ns.namespace}.${type.name}({${parameter.name}})`,
        );
        console.error(ajv.errors);
      }
    }
  }
  for (const j in ns.events || []) {
    const type = ns.events[j];
    for (const k in type.parameters) {
      const parameter = type.parameters[k];
      const valid = ajv.validateSchema(parameter);
      if (!valid) {
        clean = false;
        console.error(
          `# SCHEMA ERROR: ${ns.namespace}.${type.name}({${parameter.name}})`,
        );
        console.error(ajv.errors);
      }
    }
  }
}

// 3.  Check it against our not great WEE schema for WEE schemas.
if (!ajv.validate(wee, proposed)) {
  console.error(ajv.errors);
}

if (clean) console.log(`OK: verifyWeeSchema ${process.argv[2]}`);
