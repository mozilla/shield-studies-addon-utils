var { expect } = require('chai');

const {Cu} = require('chrome');
Cu.importGlobalProperties(['URL', 'URLSearchParams']);

const { setTimeout } = require('../jetpack/timers');
const { emit } = require('../jetpack/events-core');

let { prefSvc } = require('../jetpack/');
let { prefs } = require('../jetpack/');

var shield = require('../lib/');
const { merge } = require('../jetpack/');

let { before, after } = require('sdk/test/utils');

const self = require('sdk/self');

const ALIVENESS = 'shield.lastactiveping';

exports.only = {};
exports.skip = {};

var Ajv = require('../external/ajv.min.js');
var ajv = new Ajv();

function DEBUG(...args) { false && console.log(...args);}

var jsonschema = {
  validate: function (data, schema) {
    var valid = ajv.validate(schema, data);
    return {valid: valid, errors: (ajv.errors || []).slice(0)};
  }
};

var schemas = {
  'shield-study': require('../external/schemas/shield-study.schema.json'),
  'shield-study-addon': require('../external/schemas/shield-study-addon.schema.json'),
  'shield-study-error': require('../external/schemas/shield-study-error.schema.json')
};

exports['test validation works'] = function (assert)  {
  let d;
  let validation;

  // good data packet
  d = {'version':3,  'type':'shield-study-addon', 'study_name':'@shield-studies-addon-utils', 'branch':'observe-only', 'addon_version':'3.0.0', 'shield_version':'3.0.0', 'data':{'attributes':{},}};
  validation = jsonschema.validate(d, schemas[d.type]);
  assert.ok(validation.valid, `${validation.errors}`);

  // bad data packet
  d =  {'version':3,  'type':'shield-study-addon', 'study_name':'@shield-studies-addon-utils', 'branch':'observe-only', 'addon_version':'3.0.0', 'shield_version':'3.0.0', 'data':{}};
  validation = jsonschema.validate(d, schemas[d.type]);
  assert.ok(!validation.valid, `${validation.errors}`);
};


/* Testing utilities */
function setupEnv () {
  prefSvc.set('toolkit.telemetry.enabled', false);
  prefSvc.set('shield.fakedie', true);
  prefSvc.set('browser.selfsuppport.enabled', false);
  prefSvc.set('shield.debug', false);
  prefSvc.set('general.warnOnAboutConfig', false);
}
setupEnv();

const tabs = require('sdk/tabs');
function only1Tab () {
  let first = true;
  for (let tab of tabs) {
    if (first) {
      first = false;
      continue;
    }
    tab.close();
  }
}

function hasTabWithUrlLike(aRegexp) {
  if (typeof aRegexp  === 'string') aRegexp = new RegExp(aRegexp);
  for (let tab of tabs) {
    if (aRegexp.test(tab.url)) return true;
  }
  return false;
}

function countTabsLike (aRegexp) {
  if (typeof aRegexp  === 'string') aRegexp = new RegExp(aRegexp);
  let n = 0;
  for (let tab of tabs) {
    if (aRegexp.test(tab.url)) n += 1;
  }
  return n;
}

function countSurveysLike (aRegexp, surveys) {
  if (typeof aRegexp  === 'string') aRegexp = new RegExp(aRegexp);
  return surveys.filter((s)=>aRegexp.test(s[1])).length;
}


function hasSurveyWithUrlLike(aRegexp, surveys) {
  if (typeof aRegexp  === 'string') aRegexp = new RegExp(aRegexp);
  let ans = false;
  surveys.forEach((s) => {
    if (aRegexp.test(s[1])) {
      ans = true;
    }
  });
  return ans;
}

function waitABit (val, ts=10) {
  return new Promise(function(resolve, reject) {
    setTimeout(()=>resolve(val), ts);
  });
}

// A Fake Experiment for these tests
const FAKEPREF = 'fake.variations.pref';
var studyInfo = {
  variations: {  // just one brach 'a'
    'a':  () => prefSvc.set(FAKEPREF, 'a')
  },
  name: 'study-blah',
  days: 7,
  surveyUrls: {
    'expired': self.data.url('expired.html'),
    'user-disable': self.data.url('uninstall.html')
  }
};

function studyInfoCopy () { return merge({}, studyInfo);}

function hasVariationEffect() {
  return Boolean(prefSvc.get(FAKEPREF));
}

/** Tests Begin Here */
exports['test Module has right keys and types'] = function (assert, done) {
  let expected = [
    ['chooseVariation', 'function'],
    ['cleanup', 'function'],
    ['die', 'function'],
    ['dateToUTC', 'function'],
    ['expired', 'function'],
    ['generateTelemetryIdIfNeeded', 'function'],
    ['resetShieldPrefs', 'function'],
    ['survey', 'function'],
    ['Study', 'function'],
    ['TelemetryWatcher', 'object'],
    ['SurveyWatcher', 'object'],
    ['EventTarget', 'function'],
    ['emit', 'function'],
    ['jsonschema', 'object'],
    ['schemas', 'object']
  ];

  let keys = expected.map((x)=>x[0]);
  expected.forEach((e) => expect(shield[e[0]]).to.be.a(e[1]));
  expect(shield).to.have.all.keys(keys);
  done();
};

exports['test resetShieldPrefs actually resets'] = function (assert, done) {
  prefs['shield.firstrun'] = String(Date.now());
  prefs['shield.variation'] = 'whatever';
  prefs['shield.lastactiveping'] = String(Date.now());

  let shieldPrefs = ['shield.firstrun', 'shield.variation', 'shield.lastactiveping'];
  shieldPrefs.map((k)=>{
    let p = `extensions.${self.preferencesBranch}.${k}`;
    expect(prefSvc.get(p)).to.not.be.undefined;
  });
  shieldPrefs.map((p) => expect(prefs[p]).to.not.be.undefined);
  shield.resetShieldPrefs();
  shieldPrefs.map((k)=>{
    let p = `extensions.${self.preferencesBranch}.${k}`;
    expect(prefSvc.get(p)).to.be.undefined;
  });
  shieldPrefs.map((p) => expect(prefs[p]).to.be.undefined);
  waitABit().then(done);
};

exports['test SurveyWatcher accurately (eventually) reflects surveys opened'] = function (assert, done) {
  // open a bunch, including some that don't have urls,
  //
  let S = new shield.Study(studyInfoCopy());
  let surveyUrls = studyInfo.surveyUrls;
  let surveysOpened = [];

  let W = shield.SurveyWatcher.on('survey', (d)=>surveysOpened.push(d));

  expect(S.showSurvey('some random reason')).to.be.undefined;
  expect(S.showSurvey('expired')).to.not.be.undefined;

  let wanted = {
    urls: [
      surveyUrls.expired
    ],
    notUrls: [
      surveyUrls['user-disable']
    ]
  };

  waitABit(null, 1000).then(function () {
    shield.SurveyWatcher.off(W);
    expect(surveysOpened.length, 'length is').to.equal(2);
    expect(surveysOpened[0], 'o').to.deep.equal(['some random reason', null]);
    expect(surveysOpened[1][0], 'expired').to.deep.equal('expired');
    expect(countTabsLike('user-disable')).to.equal(0);
    expect(countTabsLike('expired')).to.equal(1);

    let a;
    a = wanted.urls.map((url) => {
      expect(hasTabWithUrlLike(url),`want ${url}`).to.be.true;
    });
    a = wanted.notUrls.map((url) => {
      expect(hasTabWithUrlLike(url),`not want ${url}`).to.be.false;
    });
    a;

    done();
  });
};

exports['test TelemetryWatcher: testing flag works'] = function (assert, done) {
  let reports = [];
  let R = shield.TelemetryWatcher.on('telemetry', (d)=>reports.push(d[1].testing));

  let aStudy = new shield.Study({});
  let data = {attributes: {}}; // valid data packet

  prefSvc.set('shield.testing', false);
  aStudy.telemetry(data);  // false
  prefSvc.set('shield.testing', true);
  aStudy.telemetry(data);  // true
  prefSvc.set('shield.testing', false);
  aStudy.telemetry(data);  // false
  return waitABit().then(function () {
    expect(reports).to.deep.equal([undefined, true, undefined]);
    shield.TelemetryWatcher.off(R);
    done();
  });
};

exports['test Telemetry: buckets: default bucket is "shield-study-addon"'] = function (assert, done) {
  let reports = [];
  let R = shield.TelemetryWatcher.on('telemetry', (d)=>reports.push(d[0]));

  let aStudy = new shield.Study({});

  let data = {attributes: {}}; // valid data packet
  aStudy.telemetry(data);

  return waitABit().then(function () {
    expect(reports[0]).to.deep.equal('shield-study-addon');
    shield.TelemetryWatcher.off(R);
    done();
  });
};


exports['test Telemetry: invalid data sends an error'] = function (assert, done) {
  let reports = [];
  let R = shield.TelemetryWatcher.on('telemetry', (d)=>reports.push(d[0]));

  let aStudy = new shield.Study({});
  aStudy.telemetry({}); // empty packets aren't valid

  return waitABit().then(function () {
    expect(reports[0]).to.deep.equal('shield-study-error');
    shield.TelemetryWatcher.off(R);
    done();
  });
};


exports['test Telemetry: malformed error packets dont blow up / cascade'] = function (assert, done) {
  let aStudy = new shield.Study({});
  aStudy.telemetryError({}); // empty errors aren't valid

  // nothing should happen
  return waitABit().then(done);
};

function setupStartupTest (aConfig, klass = shield.Study) {
  let thisStudy = new klass(aConfig);
  let seen = {reports: [], surveys: []};
  // what goes to telemetry
  let R = shield.TelemetryWatcher.on('telemetry',(d)=>seen.reports.push(d[1].data.study_state));
  let S = shield.SurveyWatcher.on('survey', (d) => seen.surveys.push(d));
  return {seen: seen, R: R, S: S, thisStudy: thisStudy};
}

function teardownStartupTest (R, S) {
  shield.TelemetryWatcher.off(R);
  shield.SurveyWatcher.off(S);

}

function promiseFinalizedStartup (aStudy, reason='install') {
  return new Promise((res, rej) => {
    aStudy.once('final',res);
    aStudy.startup(reason);
  });
}

function promiseFinalizedShutdown(aStudy, reason='shutdown') {
  return new Promise((res, rej) => {
    aStudy.once('final',res);
    aStudy.shutdown(reason);
  });
}

function urlsOf (urls) {
  return Object.keys(urls).map((k)=>urls[k]).filter(Boolean);
}


/* utility for the ending of a study state */
function endsLike (wanted, aStudy, seen) {
  let defaultWanted = {
    flags:  {},
    state: undefined,
    variation: undefined,
    firstrun: undefined,
    urls:  [],
    notUrls: [],
    reports:  [],
    states:  []
  };
  wanted = merge({}, defaultWanted, wanted); // override keys

  DEBUG('WANTED', JSON.stringify(wanted));
  DEBUG('SEEN  ',
    JSON.stringify(seen),
    aStudy.states,
    'flags:', JSON.stringify(aStudy.flags),
    JSON.stringify(aStudy.config),
    seen.surveys );

  let a;
  a = Object.keys(wanted.flags).map(function (flagName) {
    let flagSeen = aStudy.flags[flagName];
    let flagWanted = wanted.flags[flagName];
    expect(flagSeen, `want ${flagName} => ${flagWanted}`).to.deep.equal(flagWanted);
  });

  a = ['state', 'variation', 'firstrun'].map(function (aGetter) {
    let val = wanted[aGetter];
    if (val) {
      let got = aStudy[aGetter];
      expect(got, `want ${aGetter} => ${val}`).to.equal(val);
    }
  });

  if (wanted.reports.length) {
    expect(seen.reports, `reports: ${wanted.reports}`).to.deep.equal(wanted.reports);
  }
  if (wanted.states.length) {
    expect(aStudy.states, `states: ${wanted.states}`).to.deep.equal(wanted.states);
  }

  a = wanted.urls.map((url) => {
    expect(hasSurveyWithUrlLike(url, seen.surveys),`want ${url}`).to.be.true;
  });
  a = wanted.notUrls.map((url) => {
    expect(hasSurveyWithUrlLike(url, seen.surveys),`not want ${url}`).to.be.false;
  });
  a;
  return true;
}

exports['test Catch throw'] = function () {
  // this was part of debugging the Error thing in test method overrides
  const { EventTarget } = require('../lib/event-target');

  class A  {
    constructor () {
      throw new Error('Study Error: with a message');}
  }
  class B extends A {
    constructor () {
      super();
    }
  }

  expect(() => new A()).throws(Error);
  expect(() => new B()).throws(Error);

  class C extends EventTarget {
    constructor () {
      super();
      if (!('b' in [])) {
        throw new Error('Study Error: chosen variation must be in config.variations');
      }
    }
  }

  class D extends C {
  }
  expect(() => new D()).throws(Error);

};

exports['test method overrides 1: whenInstalled'] = function (assert, done) {
  let override = false;
  class OverrideStudy extends shield.Study {
    whenInstalled () {
      super.whenInstalled();
      override = true;
      throw new Error();
    }
  }
  let thisStudy = new OverrideStudy(studyInfoCopy());
  return promiseFinalizedStartup(thisStudy).then(()=>{
    expect(thisStudy.state).to.equal('running');
    expect(override).to.be.true;
    done();
  });
};

exports['test method overrides 2: whenIneligible'] = function (assert, done) {
  let override = false;
  class OverrideStudy extends shield.Study {
    whenIneligible () {
      super.whenIneligible();
      override = true;
      throw new Error();
    }
    isEligible () { return false; }
  }

  let thisStudy = new OverrideStudy(studyInfoCopy());
  return promiseFinalizedStartup(thisStudy, 'install').then(()=>{
    expect(thisStudy.state).to.equal('ineligible-die');
    expect(override).to.be.true;
    done();
  });
};


exports['test method overrides 3: whenComplete'] = function (assert, done) {
  let override = false;
  class OverrideStudy extends shield.Study {
    whenComplete () {
      super.whenComplete();
      override = true;
      throw new Error();
    }
  }

  prefs['shield.firstrun'] = String(500); // 1970!
  let thisStudy = new OverrideStudy(studyInfoCopy());
  return promiseFinalizedStartup(thisStudy, 'install').then(()=>{
    expect(thisStudy.state).to.equal('expired');
    expect(override).to.be.true;
    done();
  });
};

exports['test method overrides 4a: decideVariation - OK'] = function (assert, done) {
  let override = false;

  let variations = {};
  // make a lot of answers
  let keys = 'abcdefghijklmopqrstuvwx'.split('');
  keys.forEach((k)=>variations[k] = ()=>{});
  let config = studyInfoCopy();
  config.variations = variations;

  class OverrideStudy extends shield.Study {
    decideVariation () {
      override = true;
      return 'q';  // always the same one
    }
  }

  let thisStudy = new OverrideStudy(config);

  expect(prefs['shield.variation']).to.equal(thisStudy.variation);
  expect(thisStudy.variation).to.equal('q');
  expect(override).to.be.true;
  expect(thisStudy.config.variations).to.contain.keys(keys);
  done();
};

exports['test method overrides 4b: decideVariation - Invalid'] = function (assert, done) {
  let override = false;
  class OverrideStudy extends shield.Study {
    decideVariation () {
      override = true;
      return 'not exist';  // this is a terrible idea, btw
    }
  }

  try {
    new OverrideStudy(studyInfoCopy());
  } catch (err) {
    assert.pass();
    // these don't work for UNKNOWN REASONS  'Error' vs. 'Error'
    //expect(err, "i am").instanceOf(Error);
    //expect(/Study/.test(err.message), "string test").to.be.true;
  }
  expect(override, 'override').to.be.true;
  done();
};

exports['test startup 1: install while eligible'] = function (assert, done) {
  let {thisStudy, seen, R, S} = setupStartupTest(studyInfoCopy());
  // expect seen states... right now in wrong order, for ???
  return promiseFinalizedStartup(thisStudy).then(
  function () {
    teardownStartupTest(R, S);
    // no surveys open!
    waitABit().then(()=>{
      expect(hasVariationEffect(), 'effect happened').to.be.true;
      endsLike(
        {
          flags: {
            ineligibleDie: undefined,
          },
          state: 'running',
          reports: ['enter', 'installed', 'active'],
          states: ['maybe-installing', 'installed', 'modifying', 'running'],
          notUrls:  urlsOf(thisStudy.config.surveyUrls)
        },
        thisStudy,
        seen
      );
      done();
    });
  });
};

exports['test startup 2: install while ineligible'] = function (assert, done) {
  class IneligibleStudy extends shield.Study {
    isEligible () { return false;}
  }

  let {thisStudy, seen, R, S} = setupStartupTest(studyInfoCopy(), IneligibleStudy);
  thisStudy.config.isEligible = () => false; // new change to nope.

  return promiseFinalizedStartup(thisStudy,'install').then(
  function () {
    teardownStartupTest(R, S);
    // no surveys open!
    waitABit().then(()=>{
      expect(hasVariationEffect(), 'effect did not happen').to.be.false;
      endsLike(
        {
          flags: {
            ineligibleDie: true,
          },
          state: 'ineligible-die',
          reports: ['enter', 'ineligible', 'exit'],
          states: ['maybe-installing', 'ineligible-die'],
          notUrls:  urlsOf(thisStudy.config.surveyUrls)
        },
        thisStudy,
        seen
      );
      done();
    });
  });
},

['disable', 'uninstall'].forEach(function (does) {
  exports[`test startup 3: user-${does} (which uninstalls)`] = function (assert, done) {
    class TestStudy extends shield.Study {
      cleanup () { super.cleanup(); cleanup(); }
    }
    let {thisStudy, seen, R, S} = setupStartupTest(studyInfoCopy(), TestStudy);

    // install
    return promiseFinalizedStartup(thisStudy,'install').then(function () {
      expect(hasVariationEffect()).to.be.true;

      // 2nd time!  `${does}` (disable or uninstall)
      return promiseFinalizedShutdown(thisStudy, does).then(function () {
        teardownStartupTest(R, S);

        expect(hasVariationEffect()).to.be.false;
        endsLike(
          {
            flags: {
              ineligibleDie: undefined,
            },
            state: 'user-disable',
            reports: ['enter', 'installed', 'active', 'user-disable', 'exit'],
            states: ['maybe-installing', 'installed', 'modifying', 'running', 'user-disable'],
            urls: ['user-disable'],
            notUrls: ['expired'],
          },
          thisStudy,
          seen
        );
        // extra
        waitABit().then(()=>{
          expect(countSurveysLike('user-disable', seen.surveys)).to.equal(1);
          expect(hasSurveyWithUrlLike('expired', seen.surveys)).to.be.false;
          done();
        });
      });
    });
  };
});

exports['test 4: normal shutdown (fx shutdown)'] = function (assert, done) {
  let {thisStudy, seen, R, S} = setupStartupTest(studyInfoCopy());
  // does this race?
  thisStudy.once('final',function () {
    expect(hasVariationEffect()).to.be.true;
    // 2nd time!  interesting tests
    thisStudy.once('final', function () {
      teardownStartupTest(R, S);

      expect(hasVariationEffect()).to.be.true;
      waitABit().then(() => {
        endsLike(
          {
            flags: {
              ineligibleDie: undefined,
            },
            state: 'normal-shutdown',
            reports: ['enter', 'installed', 'active'],
            states: ['maybe-installing', 'installed', 'modifying', 'running', 'normal-shutdown'],
            notUrls: urlsOf(thisStudy.config.surveyUrls),
            urls: []
          },
          thisStudy,
          seen
        );
        done();
      });
    });

    // #2
    thisStudy.shutdown('shutdown');
  });

  // first install
  thisStudy.startup('install');
};


exports['test 5: startup REVIVING a previous config keeps that config'] = function (assert, done) {
  let myStudyInfo = studyInfoCopy();
  // setup

  myStudyInfo.variations = {
    'a':  () => prefSvc.set(FAKEPREF,'a'),
    'b':  () => prefSvc.set(FAKEPREF,'b'),
    'c':  () => prefSvc.set(FAKEPREF,'c'),
    'd':  () => prefSvc.set(FAKEPREF,'d'),
    'e':  () => prefSvc.set(FAKEPREF,'e')
  };

  class TestStudy extends shield.Study {
    cleanup () { super.cleanup(); cleanup(); }
  }

  ['a','b','c','d','e'].map((v) => {
    // simulate previous runs
    cleanup();
    // #1: no effect yet
    expect(prefSvc.get(FAKEPREF)).to.be.undefined;

    // #2 xconfig picks the existing.
    prefs['shield.variation'] = v;
    let R = new TestStudy(myStudyInfo);
    expect(R.variation).to.equal(v);
    R.cleanup();
  });

  // reset happens in loop
  expect(prefSvc.get(FAKEPREF)).to.be.undefined;

  // #3, do an install, and prove it did SOMETHING
  let {thisStudy, R, S} = setupStartupTest(myStudyInfo);
  promiseFinalizedStartup(thisStudy).then(waitABit).then(
  ()=>{
    expect(prefSvc.get(FAKEPREF)).to.not.be.undefined;
    teardownStartupTest(R, S);
    done();
  });
};

['install', 'startup'].forEach(function (reason) {
  exports[`test 6-${reason} while expired kills a study, fires state and UT`] = function (assert, done) {
    // pretend we have been running a long time!
    prefs['shield.firstrun'] = String(500); // 1970!
    let {thisStudy, seen, R, S} = setupStartupTest(studyInfoCopy());

    // claim: setup should pick up the existing firstrun
    expect(thisStudy.firstrun).to.equal(500);
    expect(thisStudy.firstrun).to.equal(Number(prefs['shield.firstrun']));

    promiseFinalizedStartup(thisStudy, reason).then(waitABit).then(
    ()=>{
      teardownStartupTest(R, S);
      endsLike(
        {
          flags: {
            ineligibleDie: undefined,
            expired: true
          },
          firstrun: 500,
          state: 'expired',
          reports: ['expired', 'exit'],
          states: ['expired'],
          notUrls: ['user-disable', thisStudy.config.surveyUrls['user-disable']],
          urls: ['expired', thisStudy.config.surveyUrls['expired']]
        },
        thisStudy,
        seen
      );
      done();
    });
  };
});


exports['test 7: install, shutdown, then 2nd startup'] = function (assert, done) {
  let wanted = {
    reports: ['enter', 'installed', 'active'],
    states: ['maybe-installing', 'installed', 'modifying', 'running', 'normal-shutdown', 'starting', 'modifying', 'running']
  };
  let {thisStudy, seen, R, S} = setupStartupTest(studyInfoCopy());
  return promiseFinalizedStartup(thisStudy, 'install').then(waitABit).then(
  () => promiseFinalizedShutdown(thisStudy, 'shutdown')).then(waitABit).then(
  () => promiseFinalizedStartup(thisStudy, 'startup')).then(
  ()=>{
    teardownStartupTest(R, S);
    endsLike(
      {
        flags: {
          ineligibleDie: undefined,
        },
        state: 'running',
        reports: wanted.reports,
        states: wanted.states,
        notUrls: urlsOf(thisStudy.config.surveyUrls),
        urls: []
      },
      thisStudy,
      seen
    );
    done();
  });
};


['enable', 'upgrade', 'downgrade', 'startup'].map(function (reason, i) {
  exports[`test 8-${reason}: all synonyms for startup: ${reason}`] = function (assert, done) {
    let testConfig = studyInfoCopy();
    let {thisStudy, seen, R, S} = setupStartupTest(testConfig);
    let wanted = {
      reports: ['active'],
      states:  ['starting', 'modifying', 'running']
    };
    return promiseFinalizedStartup(thisStudy, reason).
      then(waitABit).then(
    ()=>{
      teardownStartupTest(R, S);
      endsLike(
        {
          flags: {
            ineligibleDie: undefined,
          },
          state: 'running',
          reports: wanted.reports,
          states: wanted.states,
          notUrls: urlsOf(thisStudy.config.surveyUrls),
          urls: []
        },
        thisStudy,
        seen
      );
      done();
    });
  };
  exports[`test 9-${reason}: all synonyms for startup die if expired: ${reason}`] = function (assert, done) {
    prefs['shield.firstrun'] = String(500); // 1970!
    let testConfig = studyInfoCopy();
    let {thisStudy, seen, R, S} = setupStartupTest(testConfig);
    let wanted = {
      reports: ['expired', 'exit'],
      states:  ['expired']
    };
    return promiseFinalizedStartup(thisStudy, reason).then(waitABit).then(
    ()=>{
      teardownStartupTest(R, S);
      endsLike(
        {
          flags: {
            ineligibleDie: undefined,
            expired: true
          },
          state: 'expired',
          reports: wanted.reports,
          states: wanted.states,
          notUrls: [thisStudy.config.surveyUrls['user-disable']],
          urls: [thisStudy.config.surveyUrls['expired']]
        },
        thisStudy,
        seen
      );
      done();
    });
  };
});

['uninstall', 'disable'].map(function (reason) {
  exports.skip[`test 10-${reason}: unload during ineligibleDie doesnt send user-disable`] = function (assert, done) {
    let testConfig = studyInfoCopy();
    let {thisStudy, seen, R, S} = setupStartupTest(testConfig);
    emit(thisStudy, 'change', 'ineligible-die');
    let wanted = {
      reports: ['ineligible', 'exit'],
      states:  ['ineligible-die']
    };
    return waitABit().then(
    ()=> {
      thisStudy.shutdown(reason);
      waitABit().then(
      ()=> {
        teardownStartupTest(R, S);
        endsLike(
          {
            flags: {
              ineligibleDie: true,
            },
            state: 'ineligible-die',
            reports: wanted.reports,
            states: wanted.states,
            notUrls: urlsOf(thisStudy.config.surveyUrls),
            urls: []
          },
          thisStudy,
          seen
        );
      });
      done();
    });
  };
});

['shutdown', 'upgrade', 'downgrade'].map(function (reason, i) {
  exports[`test 10-${reason}: unload during ineligibleDie doesnt send normal-shutdown`] = function (assert, done) {
    let testConfig = studyInfoCopy();
    let {thisStudy, seen, R, S} = setupStartupTest(testConfig);
    emit(thisStudy, 'change', 'ineligible-die');
    let wanted = {
      reports: ['ineligible', 'exit'],
      states:  ['ineligible-die']
    };
    waitABit().then(
    ()=> {
      thisStudy.shutdown(reason);
      waitABit().then(
      ()=> {
        teardownStartupTest(R, S);
        endsLike(
          {
            flags: {
              ineligibleDie: true,
              expired: undefined
            },
            state: 'ineligible-die',
            reports: wanted.reports,
            states: wanted.states,
            notUrls: urlsOf(thisStudy.config.surveyUrls),
            urls: []
          },
          thisStudy,
          seen
        );
        done();
      });
    }
    );
  };
});


exports['test cleanup: bad cleanup function wont stop uninstall'] = function (assert, done) {
  let wasCalled = false;
  let errorFn = function x () { wasCalled = true; throw new Error(); };

  class BrokenCleanupStudy extends shield.Study {
    cleanup () { super.cleanup(); errorFn(); }
  }

  // check that we didn't typo, and setup is ok.
  expect(errorFn, 'and it throws').to.throw(Error);
  expect(wasCalled, 'now set!').to.be.true;

  // reset
  wasCalled = false;

  let {thisStudy, seen, R, S} = setupStartupTest(studyInfoCopy(), BrokenCleanupStudy);

  // if called directly, still an issue!
  expect(wasCalled, 'unset!').to.be.false;
  expect(()=>thisStudy.cleanup(), 'gross').to.throw(Error);

  expect(wasCalled, 'now set!').to.be.true;
  wasCalled = false;

  // but but but, it will be called as part of the Study life-cycle
  // which will catch it.

  let wanted = {
    reports: ['user-disable', 'exit'],
    states:  ['user-disable']
  };
  return waitABit().then(
  ()=> {
    thisStudy.shutdown('uninstall');
    return waitABit().then(
    ()=> {
      teardownStartupTest(R, S);
      endsLike(
        {
          flags: {
            ineligibleDie: undefined,
            expired: undefined
          },
          state: 'user-disable',
          reports: wanted.reports,
          states: wanted.states,
          notUrls: [],
          urls: [thisStudy.config.surveyUrls['user-disable']]
        },
        thisStudy,
        seen
      );
      done();
    });
  }
  );
};


exports['test Study states: end-of-study: call all you want, only does one survey'] = function (assert, done) {
  let {thisStudy, seen, R, S} = setupStartupTest(studyInfoCopy());
  emit(thisStudy, 'change', 'expired');
  emit(thisStudy, 'change', 'expired');
  emit(thisStudy, 'change', 'expired');
  emit(thisStudy, 'change', 'expired');
  let wanted = {
    reports: ['expired', 'exit'],
    states:  ['expired', 'expired', 'expired', 'expired']
  };
  return waitABit().then(
  ()=> {
    teardownStartupTest(R, S);
    endsLike(
      {
        flags: {
          ineligibleDie: undefined,
          expired: true
        },
        state: 'expired',
        reports: wanted.reports,
        states: wanted.states,
        notUrls: [thisStudy.config.surveyUrls['user-disable'],'user-disable'],
        urls: [thisStudy.config.surveyUrls['expired']]
      },
      thisStudy,
      seen
    );
    expect(countSurveysLike('expired', seen.surveys),'exactly 1 survey').to.equal(1);
    done();
  });
};

exports['test Study states: user-uninstall-disable: call all you want, only does one survey'] = function (assert, done) {
  let {thisStudy, seen, R, S} = setupStartupTest(studyInfoCopy());
  emit(thisStudy, 'change', 'user-disable');
  emit(thisStudy, 'change', 'user-disable');
  emit(thisStudy, 'change', 'user-disable');
  emit(thisStudy, 'change', 'user-disable');
  let wanted = {
    reports: ['user-disable', 'exit'],
    states:  ['user-disable', 'user-disable', 'user-disable', 'user-disable']
  };
  return waitABit().then(
  ()=> {
    teardownStartupTest(R, S);
    endsLike(
      {
        flags: {
          ineligibleDie: undefined,
          expired: undefined,
          dying: true
        },
        state: 'user-disable',
        reports: wanted.reports,
        states: wanted.states,
        notUrls: [thisStudy.config.surveyUrls['expired'],'expired'],
        urls: [thisStudy.config.surveyUrls['user-disable']]
      },
      thisStudy,
      seen
    );
    expect(countSurveysLike('user-disable', seen.surveys),'exactly 1 survey').to.equal(1);
    expect(countSurveysLike(thisStudy.config.surveyUrls['user-disable'], seen.surveys),'exactly 1 survey').to.equal(1);
    done();
  });
};


exports['test aliveness 1, crossed a midnight, study is expired, phone home and die'] = function (assert, done) {
  // EXPIRED COMES FIRST
  let config = studyInfoCopy();
  prefs['shield.firstrun'] = String(500); // 1970!
  prefs[ALIVENESS] = String(500);
  let {thisStudy, seen, R, S} = setupStartupTest(config);
  let wanted = {
    reports: ['expired', 'exit'],
    states:  ['expired']
  };
  return promiseFinalizedStartup(thisStudy, 'startup').then(
  ()=>{
    teardownStartupTest(R, S);
    endsLike(
      {
        flags: {
          ineligibleDie: undefined,
          expired: true,
        },
        firstrun: 500,
        state: 'expired',
        reports: wanted.reports,
        states: wanted.states,
      },
      thisStudy,
      seen
    );
    done();
  });
};

exports['test aliveness 2, cross a midnight, study NOT expired, will phone home'] = function (assert, done) {
  let config = studyInfoCopy();
  prefs[ALIVENESS] = String(500);
  let {thisStudy, seen, R, S} = setupStartupTest(config);
  let wanted = {
    reports: ['active'],
    states:  ['starting' ,'modifying' ,'running']
  };
  return promiseFinalizedStartup(thisStudy, 'startup').then(
  ()=>{
    teardownStartupTest(R, S);
    endsLike(
      {
        flags: {
          ineligibleDie: undefined,
          expired: undefined,
        },
        state: 'running',
        reports: wanted.reports,
        states: wanted.states,
      },
      thisStudy,
      seen
    );
    done();
  });
};


exports['test aliveness 3, no cross mindight, not expired, do nothing'] = function (assert, done) {
  let config = studyInfoCopy();
  let {thisStudy, seen, R, S} = setupStartupTest(config);
  let wanted = {
    reports: [],
    states:  ['starting' ,'modifying' ,'running']
  };
  prefs[ALIVENESS] = String(shield.dateToUTC());

  return promiseFinalizedStartup(thisStudy, 'startup').then(
  ()=>{
    teardownStartupTest(R, S);
    endsLike(
      {
        reports: wanted.reports,
        states: wanted.states,
      },
      thisStudy,
      seen
    );
    teardownStartupTest(R, S);
    done();
  });
};

exports['test aliveness 4, no cross midnight, IS expired, die'] = function (assert, done) {
  let config = studyInfoCopy();
  prefs['shield.firstrun'] = String(500); // 1970!
  let {thisStudy, seen, R, S} = setupStartupTest(config);
  let wanted = {
    reports: ['expired', 'exit'],
    states: ['expired']
  };
  prefs[ALIVENESS] = String(shield.dateToUTC()); // now
  return promiseFinalizedStartup(thisStudy, 'startup').then(
  ()=>{
    endsLike(
      {
        reports: wanted.reports,
        states: wanted.states
      },
      thisStudy,
      seen
    );
    teardownStartupTest(R, S);
    done();
  });
};


exports['test aliveness only sends one `active` per day'] = function (assert, done) {
  let config = studyInfoCopy();
  let {thisStudy, seen, R, S} = setupStartupTest(config);
  prefs[ALIVENESS] = String(500);

  let wanted = {
    reports: ['active'],
  };

  // this is vulnerable to crossing midnight during this test.
  thisStudy.alivenessPulse();
  thisStudy.alivenessPulse();
  thisStudy.alivenessPulse();
  thisStudy.alivenessPulse();
  thisStudy.alivenessPulse();

  waitABit().then(() => {
    endsLike(
      {
        reports: wanted.reports,
      },
      thisStudy,
      seen
    );
    teardownStartupTest(R, S);
    done();
  });
};

exports['test Study: surveyQueryArgs'] = function (assert) {
  prefSvc.set('shield.testing', false);
  let alwaysKeys = ['shield','study','variation','who','updateChannel','fxVersion'];
  let S = new shield.Study(studyInfoCopy());
  expect(S.surveyQueryArgs).to.have.all.keys(alwaysKeys);

  prefSvc.set('shield.testing', true);
  let testingKeys = alwaysKeys.concat('testing');
  expect(S.surveyQueryArgs).to.have.all.keys(testingKeys);
};

exports['test Study: survey for different events'] = function (assert, done) {
  let S = new shield.Study(studyInfoCopy());
  expect(S.showSurvey('some random reason')).to.be.undefined;
  expect(S.showSurvey('expired')).to.not.be.undefined;
  waitABit().then(done);
};


exports['test survey with various queryArg things'] = function (assert) {
  // combos: [url has qa's or not, with or without extras]
  let ans = [
    ['resource://a', {b:'junk'}, {b:'junk'}, 'extra vars works' ],
    ['resource://a', {}, {'b': null}, 'extra vars wont appear'],
    ['resource://a?b=some%40thing', {}, {'b': 'some@thing'}, 'no escaping or unescaping, mostly'],
    ['resource://a?b=first', {'b': 'second'}, {'b': 'second'}, 'normal vars: the extra override the survey one'],

    // this test is too sophisticated. We always override. If people send us arrays, then don't do it in our special keys
    //['resource://a?b=first&b=second', {}, {'b[0]': 'first', 'b[1]': 'second'}, 'arrays are handled \'as arrays\' only if in the survey url'],
    ['resource://a?b=first&b=second', {'b': 'third'}, {'b': 'third'}, 'later string vars override earlier \'arrays\' ']
  ];

  function toArgs(url) {
    let U = new URL(url);
    let q = U.search;
    q = new URLSearchParams(q);
    return q;
  }
  for (let row of ans) {
    let surveyUrl = row[0];
    let extra = row[1];
    let theTest = row[2];
    let what_test = row[3];
    let builtUrl = shield.survey(surveyUrl, extra);
    let qa = toArgs(builtUrl);

    // actual tests.
    for (let k in theTest) {
      expect(qa.get(k), what_test).to.deep.equal(theTest[k]);
    }
  }
};

exports['test survey with empty urls give empty answers'] = function (assert, done) {
  expect(shield.survey(undefined, {}), 'undefined').to.be.undefined;
  expect(shield.survey(''), 'empty string').to.be.undefined;
  done();
};

exports['test new studies: make variation, firstrun decision during init'] = function (assert, done) {
  let config = studyInfoCopy();
  let thisStudy = new shield.Study(config);
  // equal there there is overlap!
  Object.keys(config).map((k) => {
    expect(thisStudy.config[k]).to.deep.equal(config[k]);
  });
  expect(thisStudy.config).to.not.deep.equal(config);

  expect(config.firstrun).to.be.undefined;
  expect(config.variation).to.be.undefined;

  expect(thisStudy.config.firstrun).to.not.be.undefined;
  expect(thisStudy.config.variation).to.not.be.undefined;

  done();
};

exports['test new studies: respect prefs for variation, firstrun decision during init'] = function (assert, done) {
  // setup prefs first
  prefs['shield.variation'] = 'b';
  prefs['shield.firstrun'] = '500';

  let config = studyInfoCopy();
  let thisStudy = new shield.Study(config);
  // equal there there is overlap!

  expect(prefs['shield.variation']).to.equal(thisStudy.variation);
  expect(Number(prefs['shield.firstrun'])).to.equal(thisStudy.firstrun);

  expect(thisStudy.firstrun).to.equal(500);
  expect(thisStudy.variation).to.equal('b');
  done();
};



exports['test new Study has undefined state var'] = function (assert, done) {
  let config = studyInfoCopy();
  let thisStudy = new shield.Study(config);
  expect(thisStudy.state).to.be.undefined;
  expect(thisStudy.states).to.deep.equal([]);
  done();
};

exports['test generateTelemetryIdIfNeeded'] = function (assert, done) {
  let CLIENTIDPREF = 'toolkit.telemetry.cachedClientID';

  return shield.generateTelemetryIdIfNeeded().then((clientId)=>{
    expect(clientId).to.be.a('string');
    expect(clientId).to.equal(prefSvc.get(CLIENTIDPREF));
    done();
  });
};


exports['test obligatory exercise the event-target code, grrrrr'] = function (assert, done) {
  // until istanbul /* ignore next */ works with class statements
  let ET = require('../lib/event-target');
  let target = new ET.EventTarget();
  let f = target.on('blah',()=>{});
  target.once('blah',()=>{});
  target.off('blah', ()=>{});
  target.removeListener('blah', f);
  assert.pass();
  done();
};

// WHICH TESTS TO RUN.
// if anything in "only", run those instead
module.exports = (Object.keys(exports.only).length >= 1) ? exports.only : exports;

function cleanup () {
  shield.cleanup();
  shield.resetShieldPrefs();
  prefSvc.reset(FAKEPREF);
}
before(module.exports, function (name, assert, done) {
  cleanup();
  prefSvc.set('shield.testing', true);
  done();
});

after(module.exports, function (name, assert, done) {
  cleanup();
  only1Tab();
  prefSvc.set('shield.testing', false);
  done();
});

require('sdk/test').run(module.exports);
