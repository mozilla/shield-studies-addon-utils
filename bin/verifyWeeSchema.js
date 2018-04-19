
/**
  * given a proposed wee interface `schema.json`, lint and check it for
  * validity
  *
  * If exist, validate all `types` against `testcase`.
  */


const path = require("path");

const proposed = require(path.resolve(process.argv[2]));
const ajv = new require("ajv")()

const wee = require(path.resolve(path.join(__dirname, 'wee-schema-schema.json')));

let clean = true;

// 1. is every 'type' valid jsonschema
//    do their testcase (if any) pass?
for (let i in proposed) {
  let ns = proposed[i];
  for (let j in ns.types || []) {
    let type = ns.types[j];
    let valid = ajv.validateSchema(type);
    if (!valid) {
      clean = false;
      console.error(`# ERRORS IN ${i}:${j} ${ns.namespace}.types[${j}] "${type.id}"`)
      console.error(ajv.errors)
    }

    // checking test cases if any
    if (!type.testcase) continue
    valid = ajv.validate(type, type.testcase);
    if (!valid) {
      clean = false;
      console.error(`# testcase failed IN ${i}:${j} ${ns.namespace}.types[${j}] "${type.id}"`)
      console.error(ajv.errors)
    }
  }

}

// 2. Does every (function|event) 'parameter' have a valid jsonschema?
for (let i in proposed) {
  let ns = proposed[i];
  for (let j in ns.functions || []) {
    let type = ns.functions[j];
    for (let k in type.parameters) {
      let parameter = type.parameters[k]
      let valid = ajv.validateSchema(parameter);
      if (!valid) {
        clean = false;
        console.error(`# ERRORS IN ${i}:${j} ${type.name} ${ns.namespace}.functions[${j}].paramters[${k}]`)
        console.error(ajv.errors)
        debugger;
      }
    }
  }
  for (let j in ns.events || []) {
    let type = ns.events[j];
    for (let k in type.parameters) {
      let parameter = type.parameters[k]
      let valid = ajv.validateSchema(parameter);
      if (!valid) {
        clean = false;
        console.error(`# ERRORS IN ${i}:${j} ${type.name} ${ns.namespace}.events[${j}].parameters[${k}]`)
        console.error(ajv.errors)
      }
    }
  }
}


// 3.  Check it against our not great WEE schema for WEE schemas.
if (!ajv.validate(wee, proposed)) {
  console.error(ajv.errors);
}

if (clean) (console.log(`OK: verifyWeeSchema ${process.argv[2]}`))


