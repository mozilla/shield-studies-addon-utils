"use strict";


// Chrome privileged
const {Cu} = require("chrome");
const { Services } = Cu.import("resource://gre/modules/Services.jsm");
const { TelemetryController } = Cu.import("resource://gre/modules/TelemetryController.jsm");
const CID = Cu.import("resource://gre/modules/ClientID.jsm");

// sdk
const { merge } = require("sdk/util/object");
const querystring = require("sdk/querystring");
const { prefs } = require("sdk/simple-prefs");
const prefSvc = require("sdk/preferences/service");
const { setInterval } = require("sdk/timers");
const { URL } = require("sdk/url");

const { EventTarget } = require("./event-target");
const { emit } = require("sdk/event/core");
const self = require("sdk/self");

const DAY = 86400*1000;
// ongoing within-addon fuses / timers
let lastDailyPing = Date.now();

/* Functional, self-contained utils */

// equal probability choices from a list "choices"
function chooseVariation(choices,rng=Math.random()) {
  let l = choices.length;
  return choices[Math.floor(l*Math.random())];
}

function dateToUTC(date) {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
}

/* TODO: GRL figure out if there is a way to test this.*/
function generateTelemetryIdIfNeeded() {
  let id = TelemetryController.clientID;
  /* istanbul ignore next */
  if (id == undefined) {
    return CID.ClientIDImpl._doLoadClientID()
  } else {
    return Promise.resolve(id)
  }
}

function userId () {
  return prefSvc.get("toolkit.telemetry.cachedClientID","unknown");
}

var Reporter = new EventTarget().on("report", console.debug.bind(console,"report"));

function report(data, src="addon", bucket="shield-study") {
  data = merge({}, data , {
    study_version: self.version,
    about: {
      _src: src,
      _v: 2
    }
  });
  if (prefSvc.get('shield.testing')) data.testing = true

  emit(Reporter, "report", data);
  let telOptions = {addClientId: true, addEnvironment: true}
  return TelemetryController.submitExternalPing(bucket, data, telOptions);
}


function setOrGetFirstrun () {
  let firstrun = prefs["shield.firstrun"];
  if (firstrun === undefined) {
    firstrun = prefs["shield.firstrun"] = String(dateToUTC(new Date())) // in utc, user set
  }
  return Number(firstrun)
}

function chooseOrReviveVariation (choices) {
  let variation = prefs["shield.variation"];
  if (variation === undefined) {
    prefs["shield.variation"] = variation = chooseVariation(choices);
  }
  return variation
}

function decideAndPersistConfig (aConfig) {
  /*
    extends a config by (if not set) adding new keys from prefs for:
    - firstrun
    - variation
  */
  return merge (
    {},
    aConfig,
    {
      variation: chooseOrReviveVariation(Object.keys(aConfig.variations)),
      firstrun: setOrGetFirstrun(),
    }
  )
}

function die (addonId=self.id) {
  /* istanbul ignore else */
  if (prefSvc.get("shield.fakedie")) return;
  /* istanbul ignore next */
  require("sdk/addon/installer").uninstall(addonId);
}

// TODO: GRL vulnerable to clock time issues #1
function expired (xconfig, now = Date.now() ) {
  return ((now - Number(xconfig.firstrun))/ DAY) > xconfig.duration;
}

// open a survey, strong assumptions about query args merging
// NOTE WARNING:  your use case might not work.

function survey(xconfig, extraQueryArgs={}) {
  let url = xconfig.surveyUrl;
  let U = new URL(url);
  let q = U.search;
  if (q) {
    url = U.href.split(q)[0];
    q = querystring.parse(querystring.unescape(q.slice(1)));
  } else {
    q = {};
  }
  // get user info.
  let newArgs = merge({},
    q,
    extraQueryArgs,
    {
      variation: xconfig.variation,
      xname: xconfig.name,
      who: userId(),
      updateChannel: Services.appinfo.defaultUpdateChannel,
      fxVersion: Services.appinfo.version,
    }
  );
  let searchstring = querystring.stringify(newArgs);
  url = url + "?" + searchstring;
  require("sdk/tabs").open(url);
  return url;
}

function resetPrefs () {
  delete prefs['shield.firstrun'];
  delete prefs['shield.variation'];
}

/*
    xconfig: from decideAndPersistConfig().  Has specific branch, etc.

    variationsMod:
    - variations object:  variationName: callable
    - cleanup
*/
function telemetrySubset (xconfig) {
  return {
    study_name: xconfig.name,
    branch: xconfig.variation,
  }
}

class Study extends EventTarget {
  //extends: EventTarget,
  //initialize: function initialize(config) {
  //  EventTarget.prototype.initialize.call(this, {});

  constructor (config) {
    super();
    this.config = decideAndPersistConfig(config); // set the missing keys if any
    this.flags = {
      ineligibleDie: undefined
    };
    this.states = [];
    // all these work, but could be cleaner.  I hate the `bind` stuff.
    this.on(
      "change", (function (newstate) {
        this.states.push(newstate)
        emit(this, newstate);  // could have checks here.
      }).bind(this)
    )
    this.on(
      "starting", (function () {
        this.changeState("modifying");
      }).bind(this)
    )
    this.on(
      "ineligible-die", (function () {
        this.flags.ineligibleDie = true;
        report(merge({}, telemetrySubset(this.config), {study_state: "ineligible"}), "shield");
        this.final();
        die();
      }).bind(this)
    )
    this.on(
      "maybe-installing", (function () {
        if (!this.config.isEligible()) {
          this.changeState("ineligible-die");
        } else {
          this.changeState("installed")
        }
      }).bind(this)
    )
    this.on(
      "installed", (function () {
        report(merge({}, telemetrySubset(this.config), {study_state: "install"}), "shield");
        this.changeState("modifying");
      }).bind(this)
    )
    this.on(
      "modifying", (function () {
        var mybranchname = this.config.variation;
        this.config.variations[mybranchname]();  // do the effect
        this.changeState("running");
      }).bind(this)
    )
    this.on(
      "running", (function () {
        // report success
        report(merge({}, telemetrySubset(this.config), {study_state: "running"}), "shield");
        this.final();
      }).bind(this)
    )
    this.on(
      "normal-shutdown", (function () {
        this.flags.dying = true;
        report(merge({}, telemetrySubset(this.config), {study_state: "shutdown"}), "shield");
        this.final();
      }).bind(this)
    )
    this.on(
      "end-of-study", (function () {
        if (this.flags.expired) {  // safe to call multiple times
          this.final();
          return;
        } else {
          // first time seen.
          this.flags.expired = true;
          report(merge({}, telemetrySubset(this.config) ,{study_state: "end-of-study"}), "shield");
          // survey for end of study
          generateTelemetryIdIfNeeded().then(()=>survey(this.config, {"reason": "end-of-study"}));
          this.cleanup();
          resetPrefs();
          this.final();
          die();
        }
      }).bind(this)
    )
    this.on(
      "user-uninstall-disable", (function () {
        if (this.flags.dying) {
          this.final();
          return;
        }
        this.flags.dying = true;
        report(merge({}, telemetrySubset(this.config), {study_state: "user-ended-study"}), "shield");
        generateTelemetryIdIfNeeded().then(()=>survey(this.config, {"reason": "user-ended-study"}));
        this.cleanup();
        this.final();
        die();
      }).bind(this)
    )
  }

  get state () {
    let n = this.states.length;
    return n ? this.states[n-1]  : undefined
  }

  dieIfExpired () {
    let xconfig = this.config;
    if (expired(xconfig)) {
      emit(this, "change", "end-of-study");
      return true
    } else {
      return false
    }
  }

  alivenessPulse (last=lastDailyPing) {
    let that = this;
    // check for new day, phone home if true.
    let t = Date.now();
    if ((t - last) >= DAY) {
      lastDailyPing = t;
      // phone home
      emit(that,"change","running");
    }
    // check expiration, and die with report if needed
    return that.dieIfExpired();
  }

  changeState (newstate) {
    emit(this,'change', newstate);
  }

  final () {
    emit(this,'final', {});
  }

  startup (reason) {
    // https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Listening_for_load_and_unload

    // check expiry first, before anything, quit and die if so

    // check once, right away, short circuit both install and startup
    // to prevent modifications from happening.
    if (this.dieIfExpired()) return this

    switch (reason) {
      case "install":
        emit(this, "change", "maybe-installing");  // TODO merges install and normal startup
        break;

      case "enable":
      case "startup":
      case "upgrade":
      case "downgrade":
        emit(this, "change", "starting");  // TODO merges install and normal startup
    }

    // only set it once -- TODO needs tests
    if (! this._pulseTimer) this._pulseTimer = setInterval(this.alivenessPulse.bind(this), 5*60*1000 /*5 minutes */)
    return this;
  }

  shutdown (reason) {
    // https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Listening_for_load_and_unload
    if (this.flags.ineligibleDie ||
      this.flags.expired ||
      this.flags.dying
    ) { return this }        // special cases.

    switch (reason) {
      case "uninstall":
      case "disable":
        emit(this, "change", "user-uninstall-disable");
        break;

      // 5. usual end of session.
      case "shutdown":
      case "upgrade":
      case "downgrade":
        emit(this, "change", "normal-shutdown")
        break;
    }
    return this;
  }

  cleanup () {
    try {
      return this.config.cleanup();
    } catch (e) {
      /* istanbul ignore next */
      1;
    }
  }
}

module.exports = {
  chooseVariation: chooseVariation,
  die: die,
  expired: expired,
  generateTelemetryIdIfNeeded: generateTelemetryIdIfNeeded,
  report: report,
  Reporter: Reporter,
  resetPrefs: resetPrefs,
  Study:  Study,
  survey: survey,
  decideAndPersistConfig: decideAndPersistConfig,
}
