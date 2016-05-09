
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
const { emit } = require('sdk/event/core');
const self = require('sdk/self');


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

var Reporter = EventTarget().on('report', console.log.bind(console,"report"));

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
  if (prefs['firstrun'] === undefined) {
    prefs.firstrun = String(dateToUTC(new Date())) // in utc
  }
  let variation = prefs["variation"]
  if (variation === undefined) {
    prefs['variation'] = variation = chooseVariation(xSetupConfig.choices);
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

var Study = Class({
  extends: EventTarget,
  initialize: function initialize(options) {
    EventTarget.prototype.initialize.call(this, options);
    merge(this, options);
    this.flags = {
      ineligibleDie: undefined
    }
    this.isEligible = function () {}
  },
  reset: function () {
    this.state = undefined;
    this.isEligible = yep;
    this.flags.ineligibleDie = undefined;
  },
  dieIfExpired: function dieIfExpired() {
    let xconfig = this.xconfig;
    let variationsMod = this.variationsMod;
    // TODO fix this.
    if (expired(xconfig)) {
      emit(this, "change",'end-of-study');
    }
  },
  alivenessPulse: function() {
    that = this;
    // check for new day, phone home if true.
    let t = Date.now();
    if ((t - lastDailyPing) >= DAY) {
      lastDailyPing = t;
      // TODO GROSS
      emit(that,'change','running');
    }
    // check expiration, and die with report if needed
    that.dieIfExpired();
  },
  xconfig:  {},
  variationsMod: {}
});

target = Study();

// all these work, but could be cleaner.  I hate the `bind` stuff.

target.on(
  'change', (function (newstate) {
    this.state = newstate;
    emit(this, newstate);  // could have checks here.
  }).bind(target)
)

target.on(
  'starting', (function () {
    console.log('!!! starting')
    if (!this.isEligible()) {
      this.flags.ineligibleDie = true;
      emit(this, 'change', 'ineligible-die');
    } else {
      emit(this, 'change', 'modifying');
    }
  }).bind(target)
)

target.on(
  'ineligible-die', (function () {
    die();
  }).bind(target)
)

target.on(
  'installing', (function () {
  }).bind(target)
)

target.on(
  'modifying', (function () {
    var mybranchname = this.xconfig.variation;
    this.variationsMod.variations[mybranchname]();  // do the effect
    console.log("did the variation:", mybranchname);
    emit(this, "change", "running");
  }).bind(target)
)

target.on(
  'running', (function () {
    // report success
    report(merge({}, this.xconfig, {msg:"running"}));
  }).bind(target)
)

target.on(
  'normal-handleOnUnload', (function () {
  }).bind(target)
)

target.on(
  'end-of-study', (function () {
    report(merge({},this.xconfig,{msg:"end-of-study"}));
    // 3b. survey for end of study
    survey(this.xconfig, {'reason': 'end-of-study'});
    this.variationsMod.cleanup();
    resetPrefs();
    die();
  }).bind(target)
)

target.on(
  'user-uninstall-disable', (function () {
    let xconfig = this.xconfig;
    report(merge({}, xconfig, {msg:"user-ended-study"}));
    survey(this.xconfig, {'reason': 'user-ended-study'});
    this.variationsMod.cleanup();
    die();
  }).bind(target)
)

function handleStartup (options, xconfig, variationsMod) {
  /*
    options: the bootstrap.js options.  `loadReason`

    xconfig: from xsetup().  Has specific branch, etc.

    variationsMod:
    - variations object:  variationName: callable
    - cleanup
  */

  // TOFIX
  // check / lint xconfig, variationsMod
  // create/modify the study target object.
  target.isEligible = variationsMod.isEligible;
  target.variationsMod = variationsMod;
  target.xconfig = xconfig;

  // https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Listening_for_load_and_unload
  switch (options.loadReason) {
    case "install":
    case "enable":
    case "startup":
    case "upgrade":
    case "downgrade":
      emit(target, 'change', 'starting');  // TODO merges install and normal startup
  }

  // check once, right away.
  target.dieIfExpired();

  let _pulseTimer = setInterval(target.alivenessPulse.bind(target), 5*60*1000 /*5 seconds*/)
}

function handleOnUnload (reason, xconfig, variationsMod) {
  // https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Listening_for_load_and_unload
  console.log('reason', reason)
  switch (reason) {
    case "uninstall":
    case "disable":
      if (target.flags.ineligibleDie) { } // special case.

      emit(target, 'change', 'user-uninstall-disable');
      break;

    // 5. usual end of session.
    case "shutdown":
    case "upgrade":
    case "downgrade":
      emit(target, 'change', 'normal-handleOnUnload')
      break;

  }
}

module.exports = {
  handleStartup: handleStartup,
  handleOnUnload: handleOnUnload,
  target: target,
  report: report,
  chooseVariation: chooseVariation,
  xsetup: xsetup,
  die: die,
  expired: expired,
  survey: survey,
  handleStartup: handleStartup,
  handleOnUnload: handleOnUnload,
  resetPrefs: resetPrefs,
  studyManager: studyManager,
  generateTelemetryIdIfNeeded: generateTelemetryIdIfNeeded
}
