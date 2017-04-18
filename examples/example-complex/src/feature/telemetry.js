// Generate schemas using:  https://jsonschema.net for example

// dumb singleton pattern.  TODO better pattern.
const shield = require("shield-studies-addon-utils");
const schemas = require("./probeSchema.js");

class Telemetry {
  /* Note, that this can't send UNTIL it has a sender
    (a shield study) attached to it at 'study'
  */
  constructor () {
    this.config = {sender:null};  // needs telemetry, telemetryError methods
    this.id = Date.now();
    console.log("made a Telemetry!");
  }

  get sender () {
    return this.config.sender
  }

  set sender(val) {
    this.config.sender = val;
  }

  sendErrorIfNotValidating (data, schema) {
    let validation = shield.jsonschema.validate(data, schema);
    if (validation.errors.length) {
      let errorReport = {
        'error_id': 'jsonschema-validation',
        'error_source': 'addon',
        'severity': 'fatal',
        'message': JSON.stringify(validation.errors)
      };
      console.log(errorReport.message);
      if (this.sender) {
        this.sender.telemetryError(errorReport);
      }
      return true;
    }
  }

  send (evt, data) {
    /*
    1. check schemas for all known packet types
    2. send or log error packets if not
    */
    switch (evt) {
    case 'buttonClick':
    case 'someOtherEvent':
      let bad = this.sendErrorIfNotValidating(data, schemas[evt]);
      if (bad) return
      break;
    default:
      console.error(`no schema for ${evt}`);
      break;
    }
    // flatten it to string string map for storage at S3
    let mapped = shield.keyValuePairs.stringStringMap(data);
    if (this.sender) {
      this.sender.telemetry(mapped);
    } else {
      console.warn("no sender defined", Object.keys(this));
    }
  }
}

module.exports = new Telemetry();
