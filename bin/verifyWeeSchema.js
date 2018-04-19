
/**
  * given a propose wee interface schama.json, lint and check it for
  * validity
  */
// given a proposed WEE schema attept to validate it, including.

const path = require("path");

const proposed = require(path.resolve(process.argv[2]));
// const weeSchemaSchema = require(path.resolve("./wee-schema-schema.json"));

const ajv = new require("ajv")()

// 1. is eevery 'type' and every 'parameter' valid
for (let i in proposed) {
  let ns = proposed[i];
  for (let j in ns.types || []) {
    let type = ns.types[j];
    let valid = ajv.validateSchema(type);
    if (!valid) {
      console.error(`# ERRORS IN ${i}:${j} ${ns.namespace}.types[${j}] "${type.id}"`)
      console.error(ajv.errors)
    }

    // checking test cases if any
    if (!type.testcase) continue
    valid = ajv.validate(type, type.testcase);
    if (!valid) {
      console.error(`# testcase failed IN ${i}:${j} ${ns.namespace}.types[${j}] "${type.id}"`)
      console.error(ajv.errors)
    }
  }

}


// 2. is every 'parameter' valid
for (let i in proposed) {
  let ns = proposed[i];
  for (let j in ns.functions || []) {
    let type = ns.functions[j];
    for (let k in type.parameters) {
      let parameter = type.parameters[k]
      let valid = ajv.validateSchema(parameter);
      if (!valid) {
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
        console.error(`# ERRORS IN ${i}:${j} ${type.name} ${ns.namespace}.events[${j}].parameters[${k}]`)
        console.error(ajv.errors)
      }
    }
  }
}

