
// Chrome privileged
const {Ci, Cu} = require("chrome");
const { Services } = Cu.import("resource://gre/modules/Services.jsm");
const { TelemetryController } = Cu.import("resource://gre/modules/TelemetryController.jsm");
const CID = Cu.import("resource://gre/modules/ClientID.jsm");

// sdk
const { merge } = require("sdk/util/object");
const querystring = require("sdk/querystring");
const prefs = require("sdk/simple-prefs").prefs;
const prefSvc = require("sdk/preferences/service");
const { setInterval } = require("sdk/timers");
const { EventTarget } = require("sdk/event/target");
const { Class } = require("sdk/core/heritage");
const { emit } = require("sdk/event/core");
const self = require("sdk/self");

const DAY = 86400*1000;
// ongoing within-addon fuses / timers
let lastDailyPing = Date.now();

/* TODO, only one study at a time. */
const STUDYPREF = "shield.currentSTUDY";
const studyManager = {
  current:  () => prefSvc.get(STUDYPREF),
  leave:  () => prefSvc.reset(STUDYPREF),
  join: (name) => prefSvc.set(STUDYPREF, name)
};

/* Functional, self-contained utils */

// equal probability choices from a list "choices"
function chooseVariation(choices,rng=Math.random()) {
  let l = choices.length;
  return choices[Math.floor(l*Math.random())];
}

function dateToUTC(date) {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
}

function generateTelemetryIdIfNeeded() {
  let id = TelemetryController.clientID;
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
    firstrun: prefs.firstrun,
    version: self.version
  });
  emit(Reporter, "report", data);
  let telOptions = {addClientId: true, addEnvironment: true}
  return TelemetryController.submitExternalPing("x-shield-studies", data, telOptions);
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
  if (prefSvc.get("shield.fakedie")) return;
  require("sdk/addon/installer").uninstall(addonId);
};

// TODO: GRL vulnerable to clock time issues #1
function expired (xconfig, now = Date.now() ) {
  return ((now - Number(xconfig.firstrun))/ DAY) > xconfig.duration;
}

// open a survey.
function survey(xconfig, extraQueryArgs={}) {
  let url = xconfig.surveyUrl;
  // get user info.
  extraQueryArgs = merge({},
    extraQueryArgs,
    {
      variation: xconfig.variation,
      xname: xconfig.name,
      who: xconfig.who,
      updateChannel: Services.appinfo.defaultUpdateChannel,
      fxVersion: Services.appinfo.version,
    }
  );
  // TODO we should be smarter here, and merge in the options
  if (extraQueryArgs) {
    url += "?" + querystring.stringify(extraQueryArgs);
  }
  console.log(url);
  require("sdk/tabs").open(url);
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
var Study = Class({
  extends: EventTarget,
  initialize: function initialize(xconfig, variationsMod) {
    EventTarget.prototype.initialize.call(this, {});
    //merge(this, options);
    this.xconfig = xconfig;
    this.variationsMod = variationsMod;
    this.flags = {
      ineligibleDie: undefined
    }
    // all these work, but could be cleaner.  I hate the `bind` stuff.
    this.on(
      "change", (function (newstate) {
        console.log("in change to", newstate);
        this.state = newstate;
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
        this.final();
        die();
      }).bind(this)
    )
    this.on(
      "installing", (function () {
        if (!this.variationsMod.isEligible()) {
          this.flags.ineligibleDie = true;
          this.changeState("ineligible-die");
        } else {
          report(merge({}, this.xconfig, {msg:"install"}));
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
        report(merge({}, this.xconfig, {msg:"running"}));
        console.log("wants to final!");
        this.final();
      }).bind(this)
    )
    this.on(
      "normal-handleOnUnload", (function () {
        this.final();
      }).bind(this)
    )
    this.on(
      "end-of-study", (function () {
        report(merge({},this.xconfig,{msg:"end-of-study"}));
        // 3b. survey for end of study
        survey(this.xconfig, {"reason": "end-of-study"});
        this.variationsMod.cleanup();
        resetPrefs();
        this.final();
        die();
      }).bind(this)
    )
    this.on(
      "user-uninstall-disable", (function () {
        let xconfig = this.xconfig;
        report(merge({}, xconfig, {msg:"user-ended-study"}));
        survey(this.xconfig, {"reason": "user-ended-study"});
        this.variationsMod.cleanup();
        this.final();
        die();
      }).bind(this)
    )
  },
  dieIfExpired: function dieIfExpired() {
    let xconfig = this.xconfig;
    let variationsMod = this.variationsMod;
    // TODO fix this.
    if (expired(xconfig)) {
      emit(this, "change","end-of-study");
    }
  },
  alivenessPulse: function() {
    that = this;
    // check for new day, phone home if true.
    let t = Date.now();
    if ((t - lastDailyPing) >= DAY) {
      lastDailyPing = t;
      // TODO GROSS
      emit(that,"change","running");
    }
    // check expiration, and die with report if needed
    that.dieIfExpired();
  },
  changeState: function (newstate) {
    console.log("changeState",newstate);
    emit(this,'change', newstate);
  },
  final: function () {
    console.log("in final method");
    emit(this,'final', {});
  }
});


function handleStartup (startupOptions, thisStudy) {
  /*
    startupOptions: the bootstrap.js options.  `loadReason`
  */

  // https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Listening_for_load_and_unload
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

  // check once, right away.
  thisStudy.dieIfExpired();
  thisStudy._pulseTimer = setInterval(thisStudy.alivenessPulse, 5*60*1000 /*5 seconds*/)
  return thisStudy;
}

function handleOnUnload (reason, thisStudy) {
  // https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Listening_for_load_and_unload
  console.log("reason", reason);
  switch (reason) {
    case "uninstall":
    case "disable":
      if (thisStudy.flags.ineligibleDie) { } // special case.

      emit(thisStudy, "change", "user-uninstall-disable");
      break;

    // 5. usual end of session.
    case "shutdown":
    case "upgrade":
    case "downgrade":
      emit(thisStudy, "change", "normal-handleOnUnload")
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
  studyManager: studyManager,
  Study:  Study,
  survey: survey,
  xsetup: xsetup,
}
