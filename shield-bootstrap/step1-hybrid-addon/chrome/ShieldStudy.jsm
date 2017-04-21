"use strict";

Cu.import("resource://gre/modules/Log.jsm");
let log = Log.repository.getLogger("shield-study");
log.level = Log.Level.Debug;


var EXPORTED_SYMBOLS = ["ShieldStudy"];


class ShieldStudy {
  constructor (config) {
    this.config = config;
  }
  telemetry (data) {
    console.log("telemetry", data)
  }
  isEligible (state) {
    return true
  }

  startup () {
    log.debug("starting watchers");
    log.debug("watching duration");
    log.debug("watching telemetry at...");
    return this
  }
  shutdown () {
    return this
  }
  chooseVariation () {
    return "kitten"
  }
  setVariation (variation) {
    return this
  }
  save () {
    console.log("saved to disk!");
    return this
  }
  load () {
    console.log("loaded from disk!");
    return this
  }

}
