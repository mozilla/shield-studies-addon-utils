
// Chrome privileged
const {Cu} = require("chrome");
const { Services } = Cu.import("resource://gre/modules/Services.jsm");
const { TelemetryController } = Cu.import("resource://gre/modules/TelemetryController.jsm");
const CID = Cu.import("resource://gre/modules/ClientID.jsm");

// sdk
const { Class } = require("sdk/core/heritage");
const { merge } = require("sdk/util/object");
const querystring = require("sdk/querystring");
const { prefs } = require("sdk/simple-prefs");
const prefSvc = require("sdk/preferences/service");
const { setInterval } = require("sdk/timers");
const { URL } = require("sdk/url");

const { EventTarget } = require("sdk/event/target");
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

var Reporter = EventTarget().on("report", console.debug.bind(console,"report"));

function report(data) {
  data = merge({}, data ,{
    study_version: self.version
  });
  if (prefSvc.get('shield.testing')) data.testing = true

  emit(Reporter, "report", data);
  let telOptions = {addClientId: true, addEnvironment: true}
  return TelemetryController.submitExternalPing("shield-study", data, telOptions);
}

/* convert `xSetupConfig` to a realized experimental runtime config

  xConfig <- xSetupConfig

  sets some addon prefs by side effect.

  safely callable multiple times.
*/
function xsetup (xSetupConfig) {
  /*
    xSetupConfig: {
      choices:  names of variations for chooseVariation,
      name: name of experiment
      surveyUrl: url
      duration:  in days
    }
  */
  if (prefs["firstrun"] === undefined) {
    prefs.firstrun = String(dateToUTC(new Date())) // in utc
  }
  let variation = prefs["variation"]
  if (variation === undefined) {
    prefs["variation"] = variation = chooseVariation(xSetupConfig.choices);
  }
  return {
    variation: variation,
    firstrun: prefs.firstrun,
    name: xSetupConfig.name,
    surveyUrl: xSetupConfig.surveyUrl,
    duration: xSetupConfig.duration,
    who:  userId()
  }
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
      who: xconfig.who,
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
  delete prefs.firstrun;
  delete prefs.variation;
}

/*
    xconfig: from xsetup().  Has specific branch, etc.

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

var Study = Class({
  extends: EventTarget,
  initialize: function initialize(xconfig, variationsMod) {
    EventTarget.prototype.initialize.call(this, {});
    //merge(this, options);
    this.xconfig = xconfig;
    this.variationsMod = variationsMod;
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
        report(merge({}, telemetrySubset(this.xconfig), {study_state: "ineligible"}));
        this.final();
        die();
      }).bind(this)
    )
    this.on(
      "installing", (function () {
        if (!this.variationsMod.isEligible()) {
          this.changeState("ineligible-die");
        } else {
          report(merge({}, telemetrySubset(this.xconfig), {study_state: "install"}));
          this.changeState("modifying");
        }
      }).bind(this)
    )
    this.on(
      "modifying", (function () {
        var mybranchname = this.xconfig.variation;
        this.variationsMod.variations[mybranchname]();  // do the effect
        this.changeState("running");
      }).bind(this)
    )
    this.on(
      "running", (function () {
        // report success
        report(merge({}, telemetrySubset(this.xconfig), {study_state: "running"}));
        this.final();
      }).bind(this)
    )
    this.on(
      "normal-shutdown", (function () {
        this.flags.dying = true;
        report(merge({}, telemetrySubset(this.xconfig), {study_state: "shutdown"}));
        this.final();
      }).bind(this)
    )
    this.on(
      "end-of-study", (function () {
        if (this.flags.expired) {
          this.final();
          return;
        } else {
          // first time seen.
          this.flags.expired = true;
          report(merge({}, telemetrySubset(this.xconfig) ,{study_state: "end-of-study"}));
          // survey for end of study
          survey(this.xconfig, {"reason": "end-of-study"});
          this.variationsMod.cleanup();
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
        report(merge({}, telemetrySubset(this.xconfig), {study_state: "user-ended-study"}));
        survey(this.xconfig, {"reason": "user-ended-study"});
        this.variationsMod.cleanup();
        this.final();
        die();
      }).bind(this)
    )
  },
  get state () {
    let n = this.states.length;
    return n ? this.states[n-1]  : undefined
  },
  dieIfExpired: function dieIfExpired() {
    let xconfig = this.xconfig;
    if (expired(xconfig)) {
      emit(this, "change", "end-of-study");
      return true
    } else {
      return false
    }
  },
  alivenessPulse: function(last=lastDailyPing) {
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
  },
  changeState: function (newstate) {
    emit(this,'change', newstate);
  },
  final: function () {
    emit(this,'final', {});
  }
});


function handleStartup (startupOptions, thisStudy) {
  /*
    startupOptions: the bootstrap.js options.  `loadReason`
  */

  // https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Listening_for_load_and_unload

  // check expiry first, before anything, quit and die if so

  // check once, right away, short circuit both install and startup
  // to prevent modifications from happening.
  if (thisStudy.dieIfExpired()) return thisStudy

  switch (startupOptions.loadReason) {
    case "install":
      emit(thisStudy, "change", "installing");  // TODO merges install and normal startup
      break;

    case "enable":
    case "startup":
    case "upgrade":
    case "downgrade":
      emit(thisStudy, "change", "starting");  // TODO merges install and normal startup
  }

  thisStudy._pulseTimer = setInterval(thisStudy.alivenessPulse.bind(thisStudy), 5*60*1000 /*5 minutes */)
  return thisStudy;
}

function handleOnUnload (reason, thisStudy) {
  // https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Listening_for_load_and_unload
  if (thisStudy.flags.ineligibleDie ||
    thisStudy.flags.expired ||
    thisStudy.flags.dying
  ) { return thisStudy }        // special cases.

  switch (reason) {
    case "uninstall":
    case "disable":
      emit(thisStudy, "change", "user-uninstall-disable");
      break;

    // 5. usual end of session.
    case "shutdown":
    case "upgrade":
    case "downgrade":
      emit(thisStudy, "change", "normal-shutdown")
      break;
  }
  return thisStudy;
}

module.exports = {
  chooseVariation: chooseVariation,
  die: die,
  expired: expired,
  generateTelemetryIdIfNeeded: generateTelemetryIdIfNeeded,
  handleStartup: handleStartup,
  handleOnUnload: handleOnUnload,
  report: report,
  Reporter: Reporter,
  resetPrefs: resetPrefs,
  Study:  Study,
  survey: survey,
  xsetup: xsetup,
}
