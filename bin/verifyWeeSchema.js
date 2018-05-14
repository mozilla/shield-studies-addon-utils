/* eslint-env node */

/**
 * given a proposed wee interface `schema.json`, lint and check it for
 * validity
 *
 * If exist, validate all `types` against `testcase`.
 */

// TODO, use assert

const path = require("path");

const proposed = require(path.resolve(process.argv[2]));
const ajv = new require("ajv")();

const { inspect } = require("util");
// for printing a deeply nested object to node console
// eslint-disable-next-line no-unused-vars
function full(myObject) {
  return inspect(myObject, { showHidden: false, depth: null });
}

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
    const testcases = type.testcases || [];
    if (type.testcase) testcases.push(type.testcase);

    if (!testcases.length) continue;

    for (const tc of testcases) {
      valid = ajv.validate(type, tc);
      if (!valid) {
        clean = false;
        console.error(
          `# testcase failed IN ${i}:${j} ${ns.namespace}.${type.name}  "${
            type.id
          }"

${full(tc)}
          `,
        );
        console.error(ajv.errors);
      }
    }

    // now, known failures
    for (const tc of type.failcases || []) {
      valid = ajv.validate(type, tc);
      if (valid) {
        clean = false;
        console.error(
          `# testcase should not validate IN ${i}:${j} ${ns.namespace}.${
            type.name
          }  "${type.id}"

${full(tc)}
          `,
        );
        console.error(ajv.errors);
      }
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
