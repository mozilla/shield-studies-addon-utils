'use strict';

const UTILS_VERSION = require('../package.json').version;
const PACKET_VERSION = 3;

// Chrome privileged
const { Cu } = require('chrome');
const { Services } = Cu.import('resource://gre/modules/Services.jsm');
const { TelemetryController } = Cu.import('resource://gre/modules/TelemetryController.jsm');
const CID = Cu.import('resource://gre/modules/ClientID.jsm');
Cu.importGlobalProperties(['URL', 'URLSearchParams']);

// outside
var Ajv = require('../external/ajv.min.js');
var ajv = new Ajv();


var jsonschema = {
  validate: function (data, schema) {
    var valid = ajv.validate(schema, data);
    return {valid: valid, errors:  ajv.errors || []};
  }
};

const schemas = {
  'shield-study': require('../external/schemas/shield-study.schema.json'),
  'shield-study-addon': require('../external/schemas/shield-study-addon.schema.json'),
  'shield-study-error': require('../external/schemas/shield-study-error.schema.json')
};

// sdk
const { merge } = require('../jetpack');
const { prefs } = require('../jetpack');
const { prefSvc } = require('../jetpack');
const { setInterval } = require('../jetpack/timers');

const { EventTarget } = require('./event-target');
const { emit } = require('../jetpack/events-core');
const self = require('sdk/self');

const DAY = 86400*1000;

/* Functional, self-contained utils */
function DEBUG (...args) {
  /* istanbul ignore if */
  if (prefSvc.get('shield.debug')) console.log(...args);
}


function openTab (url) {
  /*
   * let newTab = window.gBrowser.addTab(url);
   * if (!options.inBackground) {
   *   activateTab(newTab);
   * }
   * return newTab;
   **/
  let recent = Services.wm.getMostRecentWindow('navigator:browser');
  recent.gBrowser.addTab(url);
}


// equal probability choices from a list "choices"
function chooseVariation(choices,rng=Math.random()) {
  let l = choices.length;
  return choices[Math.floor(l*Math.random())];
}

function dateToUTC(date=new Date()) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
}

function generateTelemetryIdIfNeeded() {
  let id = TelemetryController.clientID;
  /* istanbul ignore next */
  if (id === undefined) {
    return CID.ClientIDImpl._doLoadClientID();
  } else {
    return Promise.resolve(id);
  }
}

function userId () {
  return prefSvc.get('toolkit.telemetry.cachedClientID','unknown');
}

var TelemetryWatcher = new EventTarget().on('telemetry',
  (d) => DEBUG('TELEMETRY', JSON.stringify(d))
);

var SurveyWatcher = new EventTarget().on('survey',
  (d) => DEBUG('SURVEY', JSON.stringify(d))
);

function survey (url, queryArgs={}) {
  if (! url) return;

  let U = new URL(url);
  let q = U.search || '?';
  q = new URLSearchParams(q);

  // get user info.
  Object.keys(queryArgs).forEach((k)=>{
    q.set(k, queryArgs[k]);
  });

  let searchstring = q.toString();
  U.search = searchstring;
  return U.toString();
}

function setOrGetFirstrun () {
  let firstrun = prefs['shield.firstrun'];
  if (firstrun === undefined) {
    firstrun = prefs['shield.firstrun'] = String(dateToUTC(new Date())); // in utc, user set
  }
  return Number(firstrun);
}


class ActivePing {
  constructor () {
    this.name = 'shield.lastactiveping';
  }

  get (value) {
    return Number(prefs[this.name] || 0);
  }
  set (value) {
    prefs[this.name] = String(value);
  }
}

function reuseVariation (choices) {
  return prefs['shield.variation'];
}

function setVariation (choice) {
  prefs['shield.variation'] = choice;
  return choice;
}

function die (addonId=self.id) {
  /* istanbul ignore else */
  if (prefSvc.get('shield.fakedie')) return;
  /* istanbul ignore next */
  require('../jetpack').uninstall(addonId);
}

// TODO: GRL vulnerable to clock time issues #1
function expired (xconfig, now = dateToUTC(new Date()) ) {

  return ((now - Number(xconfig.firstrun))/ DAY) > xconfig.days;
}

function resetShieldPrefs () {
  // Time of install / first run
  delete prefs['shield.firstrun'];
  // which variation
  delete prefs['shield.variation'];
  // last daily active ping sent
  delete prefs['shield.lastactiveping'];
}

function cleanup () {
  prefSvc.keys(`extensions.${self.preferencesBranch}`).forEach (
  (p) => {
    delete prefs[p];
  });
}

class Study extends EventTarget {
  constructor (config) {
    super();
    this.config = merge({
      name: self.id,
      variations: {'observe-only': () => {}},
      surveyUrls: {},
      days: 7
    },config);

    this.config.firstrun = setOrGetFirstrun();

    let variation = reuseVariation();
    if (variation === undefined) {
      variation = this.decideVariation();
      if (!(variation in this.config.variations)) {
        // chaijs doesn't think this is an instanceof Error
        // freaktechnik and gregglind debugged for a while.
        // sdk errors might not be 'Errors' or chai is wack, who knows.
        // https://dxr.mozilla.org/mozilla-central/search?q=regexp%3AError%5Cs%3F(%3A%7C%3D)+path%3Aaddon-sdk%2Fsource%2F&redirect=false would list
        throw new Error('Study Error: chosen variation must be in config.variations');
      }
      setVariation(variation);
    }
    this.config.variation = variation;

    this.flags = {
      ineligibleDie: undefined
    };
    this.states = [];
    // all these work, but could be cleaner.  I hate the `bind` stuff.
    this.on(
      'change', (function (newstate) {
        DEBUG(`state: "${newstate}". previous: ${this.states}`);
        this.states.push(newstate);
        emit(this, newstate);  // could have checks here.
      }).bind(this)
    );

    // reason = "install"
    this.on(
      'maybe-installing', (function () {
        this.telemetry({study_state: 'enter'}, 'shield-study');
        if (!this.isEligible()) {
          this.changeState('ineligible-die');
        } else {
          this.changeState('installed');
        }
      }).bind(this)
    );
    this.on(
      'ineligible-die', (function () {
        try {this.whenIneligible();} catch (err) {/*ok*/} finally { /*ok*/ }
        this.flags.ineligibleDie = true;
        this.telemetry({study_state: 'ineligible'}, 'shield-study');
        this.telemetry({study_state: 'exit'}, 'shield-study');
        this.final();
        die();
      }).bind(this)
    );
    this.on(
      'installed', (function () {
        try {this.whenInstalled();} catch (err) {/*ok*/} finally { /*ok*/ }
        this.telemetry({study_state: 'installed'}, 'shield-study');
        this.changeState('modifying');
      }).bind(this)
    );

    // reason = "anything else"
    this.on(
      'starting', (function () {
        this.changeState('modifying');
      }).bind(this)
    );

    // sink for "installed" and "starting"
    this.on(
      'modifying', (function () {
        if (! this._pulseTimer) {
          this.alivenessPulse();
          this._pulseTimer = setInterval(this.alivenessPulse.bind(this), 5*60*1000 /*5 minutes */);
        }

        var mybranchname = this.variation;
        this.config.variations[mybranchname]();  // do the effect
        this.changeState('running');
      }).bind(this)
    );

    this.on(  // the one 'many'
      'running', (function () {
        this.final();
      }).bind(this)
    );

    this.on(
      'normal-shutdown', (function () {
        this.flags.dying = true;
        //this.telemetry({study_state: "shutdown"}, "shield-study");
        this.final();
      }).bind(this)
    );
    this.on(
      'expired', (function () {
        if (this.flags.expired) {  // safe to call multiple times
          this.final();
          return;
        } else {
          // first time seen.
          this.flags.expired = true;
          try {this.whenComplete();} catch (err) { /*ok*/ } finally { /*ok*/ }
          this.telemetry({study_state: 'expired'}, 'shield-study');
          this.telemetry({study_state: 'exit'}, 'shield-study');

          // survey for end of study
          this.showSurvey('expired');
          try {this.cleanup();} catch (err) {/*ok*/} finally { /*ok*/ }
          this.final();
          die();
        }
      }).bind(this)
    );
    this.on(
      'user-disable', (function () {
        if (this.flags.dying) {
          this.final();
          return;
        }
        this.flags.dying = true;
        this.telemetry({study_state: 'user-disable'}, 'shield-study');
        this.telemetry({study_state: 'exit'}, 'shield-study');

        this.showSurvey('user-disable');
        try {this.cleanup();} catch (err) {/*ok*/} finally { /*ok*/ }
        this.final();
        die();
      }).bind(this)
    );
  }

  get state () {
    let n = this.states.length;
    return n ? this.states[n-1]  : undefined;
  }

  get variation () {
    return this.config.variation;
  }

  get firstrun () {
    return this.config.firstrun;
  }

  dieIfExpired () {
    let xconfig = this.config;
    if (expired(xconfig)) {
      emit(this, 'change', 'expired');
      return true;
    } else {
      return false;
    }
  }

  alivenessPulse (ap=new ActivePing()) {
    // check for new day, phone home if true.
    let t = dateToUTC(new Date());
    let last = ap.get();
    function crossedUtcMidnight(t1, t2) {
      // t2 >= t1.
      let midnight = new Date(t2);
      midnight.setHours(0,0,0,0);
      return t1 < midnight;
    }

    // TODO should do a midnight crossing instead.

    if (crossedUtcMidnight(last, t)) {
      // phone home
      ap.set(String(t));
      this.telemetry({study_state: 'active'}, 'shield-study');
    }
    // check expiration, and die with telemetry if needed
    return this.dieIfExpired();
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
    if (this.dieIfExpired()) return this;

    switch (reason) {
    case 'install':
      emit(this, 'change', 'maybe-installing');
      break;

    case 'enable':
    case 'startup':
    case 'upgrade':
    case 'downgrade':
      emit(this, 'change', 'starting');
    }
    return this;
  }

  shutdown (reason) {
    // https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Listening_for_load_and_unload
    if (this.flags.ineligibleDie ||
      this.flags.expired ||
      this.flags.dying
    ) { return this; }        // special cases.

    switch (reason) {
    case 'uninstall':
    case 'disable':
      emit(this, 'change', 'user-disable');
      break;

      // 5. usual end of session.
    case 'shutdown':
    case 'upgrade':
    case 'downgrade':
      emit(this, 'change', 'normal-shutdown');
      break;
    }
    return this;
  }

  cleanup () {
    // do the simple prefs and simplestorage cleanup
    // extend by extension
    resetShieldPrefs();
    cleanup();
  }

  isEligible () {
    return true;
  }

  whenIneligible () {
    // empty function unless overrided
  }

  whenInstalled () {
    // empty unless overrided
  }

  whenComplete () {
    // when the study expires
  }

  /**
    * equal choice from varations, by default.  override to get unequal
    */
  decideVariation (rng=Math.random()) {
    return chooseVariation(Object.keys(this.config.variations), rng);
  }

  get surveyQueryArgs () {
    let queryArgs = {
      shield: PACKET_VERSION,
      study: this.config.name,
      variation: this.variation,
      updateChannel: Services.appinfo.defaultUpdateChannel,
      fxVersion: Services.appinfo.version,
      // telemetry clientId
      who: userId()
    };
    if (prefSvc.get('shield.testing')) queryArgs.testing = 1;
    return queryArgs;
  }

  showSurvey(reason) {
    let partial = this.config.surveyUrls[reason];

    let queryArgs = this.surveyQueryArgs;

    queryArgs.reason = reason;
    if (partial) {
      let url = survey(partial, queryArgs);
      emit(SurveyWatcher, 'survey', [reason, url]);
      openTab(url);
      return url;
    } else {
      emit(SurveyWatcher, 'survey', [reason, null]);
      return;
    }
  }

  // new v3 spec, telemetry ONLY exists from inside studies.
  // shield packets send to the 'shield-study' bucket
  telemetryError(errorReport) {
    return this.telemetry(errorReport, 'shield-study-error');
  }

  telemetry(data, bucket='shield-study-addon') {
    let payload = {
      version:        PACKET_VERSION,
      study_name:     this.config.name,
      branch:         this.variation,
      addon_version:  self.version,
      shield_version: UTILS_VERSION,
      type:           bucket,
      data:           data
    };

    if (prefSvc.get('shield.testing')) payload.testing = true;

    let validation;

    /* istanbul ignore next */
    try {
      validation = jsonschema.validate(payload, schemas[bucket]);
    } catch (err) {
      // if validation broke, GIVE UP.
      console.error(err);
      return;
    }

    if (validation.errors.length) {
      let errorReport = {
        'error_id': 'jsonschema-validation',
        'error_source': 'addon',
        'severity': 'fatal',
        'message': JSON.stringify(validation.errors.map((x)=>x.message))
      };
      if (bucket === 'shield-study-error') {
        return; // just die, maybe should have a super escape hatch?
      }
      return this.telemetryError(errorReport);
    }
    emit(TelemetryWatcher, 'telemetry', [bucket, payload]);
    let telOptions = {addClientId: true, addEnvironment: true};
    return TelemetryController.submitExternalPing(bucket, payload, telOptions);
  }
}

module.exports = {
  chooseVariation: chooseVariation,
  cleanup: cleanup,
  die: die,
  dateToUTC: dateToUTC,
  expired: expired,
  generateTelemetryIdIfNeeded: generateTelemetryIdIfNeeded,
  resetShieldPrefs: resetShieldPrefs,
  survey: survey,
  Study:  Study,
  TelemetryWatcher: TelemetryWatcher,
  SurveyWatcher: SurveyWatcher,
  EventTarget: EventTarget,
  emit: emit,
  jsonschema: jsonschema,
  schemas: schemas
};
