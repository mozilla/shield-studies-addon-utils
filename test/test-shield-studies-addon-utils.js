var { expect } = require("chai");

const { merge } = require("sdk/util/object");
const { setTimeout } = require("sdk/timers");
const { emit } = require("sdk/event/core");
const querystring = require("sdk/querystring");
const { URL } = require("sdk/url");

let prefSvc = require("sdk/preferences/service");
let prefs = require("sdk/simple-prefs").prefs;

var xutils = require("../lib/");

let { before, after } = require("sdk/test/utils");

const self = require("sdk/self");

const DAY = 86400*1000;

exports.only = {}
exports.skip = {}

/* Testing utilities */
function setupEnv () {
  prefSvc.set("toolkit.telemetry.enabled", false)
  prefSvc.set("shield.fakedie", true)
  prefSvc.set("browser.selfsuppport.enabled", false)
  prefSvc.set("shield.debug", true)
  prefSvc.set("general.warnOnAboutConfig", false)
}
setupEnv()

const tabs = require("sdk/tabs");
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
  if (typeof aRegexp  === 'string') aRegexp = new RegExp(aRegexp)
  for (let tab of tabs) {
    if (aRegexp.test(tab.url)) return true
  }
  return false;
}

function countTabsLike (aRegexp) {
  if (typeof aRegexp  === 'string') aRegexp = new RegExp(aRegexp)
  let n = 0;
  for (let tab of tabs) {
    if (aRegexp.test(tab.url)) n += 1
  }
  return n;
}

function waitABit (val) {
  return new Promise(function(resolve, reject) {
    setTimeout(()=>resolve(val),200);
  })
}

// A Fake Experiment for these tests
const FAKEPREF = "fake.variations.pref";
var studyInfo = {
  variations: {  // just one brach 'a'
    "a":  () => prefSvc.set(FAKEPREF,"a")
  },
  name: "study-blah",
  days: 7,
  surveyUrls: {
    'end-of-study': self.data.url("expired.html"),
    'user-ended-study': self.data.url("uninstall.html")
  }
};

function studyInfoCopy () { return merge({}, studyInfo)}

function hasVariationEffect() {
  return Boolean(prefSvc.get(FAKEPREF));
}

/** Tests Begin Here */
exports["test Module has right keys and types"] = function (assert, done) {
  let expected = [
    ["chooseVariation", "function"],
    ["die", "function"],
    ["expired", "function"],
    ["generateTelemetryIdIfNeeded", "function"],
    ["report", "function"],
    ["Reporter", "object"],
    ["resetShieldPrefs", "function"],
    ["Study", "function"],
    ["cleanup", "function"],
    ["survey", "function"],
  ];

  let keys = expected.map((x)=>x[0]);
  expected.forEach((e) => expect(xutils[e[0]]).to.be.a(e[1]));
  expect(xutils).to.have.all.keys(keys);
  done();
}

exports["test resetShieldPrefs actually resets"] = function (assert, done) {
  prefs["shield.firstrun"] = String(Date.now());
  prefs["shield.variation"] = "whatever";
  ["shield.firstrun", "shield.variation"].map((p) => expect(prefs[p]).to.not.be.undefined);
  xutils.resetShieldPrefs();
  ["shield.firstrun", "shield.variation"].map((p) => expect(prefs[p]).to.be.undefined);
  done()
}

exports['test Reporter: testing flag works'] = function (assert) {
  let reports = [];
  let R = xutils.Reporter.on("report", (d)=>reports.push(d.testing));

  xutils.report({});  // false
  prefSvc.set('shield.testing', true);
  xutils.report({});  // true
  prefSvc.set('shield.testing', false);
  xutils.report({});  // false
  return waitABit().then(function () {
    expect(reports).to.deep.equal([undefined, true, undefined]);
    xutils.Reporter.off(R);
  })
}

function setupStartupTest (aConfig, klass = xutils.Study) {
  let thisStudy = new klass(aConfig);
  let seen = {reports: []};
  // what goes to telemetry
  let R = xutils.Reporter.on("report",(d)=>seen.reports.push(d.study_state));
  return {seen: seen, R: R, thisStudy: thisStudy}
}

function teardownStartupTest (R) {
  xutils.Reporter.off(R);
}

function promiseFinalizedStartup (aStudy, reason="install") {
  return new Promise((res, rej) => {
    aStudy.once("final",res);
    aStudy.startup(reason);
  })
}

function promiseFinalizedShutdown(aStudy, reason="shutdown") {
  return new Promise((res, rej) => {
    aStudy.once("final",res);
    aStudy.shutdown(reason);
  })
}

function urlsOf (urls) {
  return Object.keys(urls).map((k)=>urls[k]).filter(Boolean)
}


function endsLike (wanted, aStudy, seen) {
  let defaultWanted = {
    flags:  {},
    state: undefined,
    variation: undefined,
    firstrun: undefined,
    urls:  [],
    notUrls: [],
    reports:  [],
    states:  [],
  };
  wanted = merge({}, defaultWanted, wanted); // override keys

  let a;
  a = Object.keys(wanted.flags).map(function (flagName) {
    let flagSeen = aStudy.flags[flagName];
    let flagWanted = wanted.flags[flagName];
    expect(flagSeen, `want ${flagName} => ${flagWanted}`).to.deep.equal(flagWanted)
  });

  a = ['state', 'variation', 'firstrun'].map(function (aGetter) {
    let val = wanted[aGetter];
    if (val) {
      let got = aStudy[aGetter];
      expect(got, `want ${aGetter} => ${val}`).to.equal(val)
    }
  });

  a = wanted.urls.map((url) => {
    expect(hasTabWithUrlLike(url),`want ${url}`).to.be.true;
  })
  a = wanted.notUrls.map((url) => {
    expect(hasTabWithUrlLike(url),`not want ${url}`).to.be.false;
  })
  if (wanted.reports.length) {
    expect(seen.reports, `reports: ${wanted.reports}`).to.deep.equal(wanted.reports);
  }
  if (wanted.states.length) {
    expect(aStudy.states, `states: ${wanted.states}`).to.deep.equal(wanted.states);
  }

  a;
  return true;
}

exports["test Catch throw"] = function () {
  // this was part of debugging the Error thing in test method overrides
  const { EventTarget } = require("../lib/event-target");

  class A  {
    constructor () {
      throw new Error("Study Error: with a message")}
  }
  class B extends A {
    constructor () {
      super();
    }
  }

  expect(() => new A()).throws(Error)
  expect(() => new B()).throws(Error)

  class C extends EventTarget {
    constructor () {
      super();
      if (!('b' in [])) {
        throw new Error("Study Error: chosen variation must be in config.variations")
      }
    }
  }

  class D extends C {
  }
  expect(() => new D()).throws(Error)

}

exports["test method overrides 1: whenInstalled"] = function (assert) {
  let override = false;
  class OverrideStudy extends xutils.Study {
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
  })
}

exports["test method overrides 2: whenIneligible"] = function (assert) {
  let override = false;
  class OverrideStudy extends xutils.Study {
    whenIneligible () {
      super.whenIneligible();
      override = true;
      throw new Error();
    }
    isEligible () { return false }
  }

  let thisStudy = new OverrideStudy(studyInfoCopy());
  return promiseFinalizedStartup(thisStudy,"install").then(()=>{
    expect(thisStudy.state).to.equal('ineligible-die');
    expect(override).to.be.true;
  })
}


exports["test method overrides 3: whenComplete"] = function (assert) {
  let override = false;
  class OverrideStudy extends xutils.Study {
    whenComplete () {
      super.whenComplete();
      override = true;
      throw new Error();
    }
  }

  prefs["shield.firstrun"] = String(500); // 1970!
  let thisStudy = new OverrideStudy(studyInfoCopy());
  return promiseFinalizedStartup(thisStudy,"install").then(()=>{
    expect(thisStudy.state).to.equal('end-of-study');
    expect(override).to.be.true;
  })
}

exports['test method overrides 4a: decideVariation - OK'] = function (assert) {
  let override = false;

  let variations = {};
  // make a lot of answers
  let keys = 'abcdefghijklmopqrstuvwx'.split('');
  keys.forEach((k)=>variations[k] = ()=>{})
  let config = studyInfoCopy();
  config.variations = variations;

  class OverrideStudy extends xutils.Study {
    decideVariation () {
      override = true;
      return 'q'  // always the same one
    }
  }

  let thisStudy = new OverrideStudy(config);

  expect(prefs['shield.variation']).to.equal(thisStudy.variation);
  expect(thisStudy.variation).to.equal('q');
  expect(override).to.be.true;
  expect(thisStudy.config.variations).to.contain.keys(keys)
}

exports['test method overrides 4b: decideVariation - Invalid'] = function (assert) {
  let override = false;
  class OverrideStudy extends xutils.Study {
    decideVariation () {
      override = true;
      return 'not exist'  // this is a terrible idea, btw
    }
  }

  try {
    new OverrideStudy(studyInfoCopy())
  } catch (err) {
    assert.pass();
    // these don't work for UNKNOWN REASONS  'Error' vs. 'Error'
    //expect(err, "i am").instanceOf(Error);
    //expect(/Study/.test(err.message), "string test").to.be.true;
  }
  expect(override, "override").to.be.true;
}



exports["test startup 1: install while eligible"] = function (assert) {
  let {thisStudy, seen, R} = setupStartupTest(studyInfoCopy());
  // expect seen states... right now in wrong order, for ???
  return promiseFinalizedStartup(thisStudy).then(
  function () {
    teardownStartupTest(R);
    // no surveys open!
    waitABit().then(()=>{
      expect(hasVariationEffect(), "effect happened").to.be.true;
      endsLike(
        {
          flags: {
            ineligibleDie: undefined,
          },
          state: 'running',
          reports: ["install","running"],
          states: ["maybe-installing","installed","modifying","running"],
          notUrls:  urlsOf(thisStudy.config.surveyUrls)
        },
        thisStudy,
        seen
      )
    })
  })
}

exports["test startup 2: install while ineligible"] = function (assert) {
  class IneligibleStudy extends xutils.Study {
    isEligible () { return false}
  }

  let {thisStudy, seen, R} = setupStartupTest(studyInfoCopy(), IneligibleStudy);
  thisStudy.config.isEligible = () => false; // new change to nope.

  return promiseFinalizedStartup(thisStudy,'install').then(
  function () {
    teardownStartupTest(R);
    // no surveys open!
    waitABit().then(()=>{
      expect(hasVariationEffect(), "effect did not happen").to.be.false;
      endsLike(
        {
          flags: {
            ineligibleDie: true,
          },
          state: 'ineligible-die',
          reports: ["ineligible"],
          states: ["maybe-installing","ineligible-die"],
          notUrls:  urlsOf(thisStudy.config.surveyUrls)
        },
        thisStudy,
        seen
      )
    })
  })
},

['disable', 'uninstall'].forEach(function (does) {
  exports[`test startup 3: user-${does} (which uninstalls)`] = function (assert) {
    class TestStudy extends xutils.Study {
      cleanup () { super.cleanup(); cleanup() }
    }
    let {thisStudy, seen, R} = setupStartupTest(studyInfoCopy(), TestStudy);

    // install
    return promiseFinalizedStartup(thisStudy,'install').then(function () {
      expect(hasVariationEffect()).to.be.true;

      // 2nd time!  `${does}` (disable or uninstall)
      return promiseFinalizedShutdown(thisStudy, does).then(function () {
        teardownStartupTest(R);

        expect(hasVariationEffect()).to.be.false;
        endsLike(
          {
            flags: {
              ineligibleDie: undefined,
            },
            state: "user-uninstall-disable",
            reports: ["install","running","user-ended-study"],
            states: ["maybe-installing","installed","modifying","running","user-uninstall-disable"],
            notUrls: [],
            urls: []
          },
          thisStudy,
          seen
        )
        // extra
        waitABit().then(()=>{
          expect(countTabsLike("user-ended-study")).to.equal(1);
          expect(hasTabWithUrlLike("end-of-study")).to.be.false;
        })
      })
    })
  }
})

exports["test 4: normal shutdown (fx shutdown)"] = function (assert, done) {
  let {thisStudy, seen, R} = setupStartupTest(studyInfoCopy());
  // does this race?
  thisStudy.once("final",function () {
    expect(hasVariationEffect()).to.be.true;

    // 2nd time!  interesting tests
    thisStudy.once("final", function () {
      teardownStartupTest(R);

      expect(hasVariationEffect()).to.be.true;
      waitABit().then(() => {
        endsLike(
          {
            flags: {
              ineligibleDie: undefined,
            },
            state: "normal-shutdown",
            reports: ["install","running","shutdown"],
            states: ["maybe-installing","installed","modifying","running","normal-shutdown"],
            notUrls: urlsOf(thisStudy.config.surveyUrls),
            urls: []
          },
          thisStudy,
          seen
        )
        done();
      })
    })

    // #2
    thisStudy.shutdown("shutdown");
  })

  // first install
  thisStudy.startup("install");
}


exports['test 5: startup REVIVING a previous config keeps that config'] = function (assert, done) {
  let myStudyInfo = studyInfoCopy();
  // setup

  myStudyInfo.variations = {
    "a":  () => prefSvc.set(FAKEPREF,'a'),
    "b":  () => prefSvc.set(FAKEPREF,'b'),
    "c":  () => prefSvc.set(FAKEPREF,'c'),
    "d":  () => prefSvc.set(FAKEPREF,'d'),
    "e":  () => prefSvc.set(FAKEPREF,'e')
  }

  class TestStudy extends xutils.Study {
    cleanup () { super.cleanup(); cleanup() }
  }

  ['a','b','c','d','e'].map((v) => {
    // simulate previous runs
    cleanup();
    // #1: no effect yet
    expect(prefSvc.get(FAKEPREF)).to.be.undefined;

    // #2 xconfig picks the existing.
    prefs["shield.variation"] = v;
    let R = new TestStudy(myStudyInfo);
    expect(R.variation).to.equal(v);
    R.cleanup();
  })

  // reset happens in loop
  expect(prefSvc.get(FAKEPREF)).to.be.undefined;

  // #3, do an install, and prove it did SOMETHING
  let {thisStudy, R} = setupStartupTest(myStudyInfo);
  promiseFinalizedStartup(thisStudy).then(waitABit).then(
  ()=>{
    expect(prefSvc.get(FAKEPREF)).to.not.be.undefined;
    teardownStartupTest(R);
    done();
  })
};

['install', 'startup'].forEach(function (reason) {
  exports[`test 6-${reason} while expired kills a study, fires state and UT`] = function (assert, done) {
    // pretend we have been running a long time!
    prefs["shield.firstrun"] = String(500); // 1970!
    let {thisStudy, seen, R} = setupStartupTest(studyInfoCopy());

    // claim: setup should pick up the existing firstrun
    expect(thisStudy.firstrun).to.equal(500);
    expect(thisStudy.firstrun).to.equal(Number(prefs["shield.firstrun"]));

    promiseFinalizedStartup(thisStudy, reason).then(waitABit).then(waitABit).then(
    ()=>{
      teardownStartupTest(R);
      endsLike(
        {
          flags: {
            ineligibleDie: undefined,
            expired: true
          },
          firstrun: 500,
          state: "end-of-study",
          reports: ["end-of-study"],
          states: ["end-of-study"],
          notUrls: ['user-ended-study', thisStudy.config.surveyUrls['user-ended-study']],
          urls: ['end-of-study', thisStudy.config.surveyUrls['end-of-study']]
        },
        thisStudy,
        seen
      )
      done();
    })
  };
})


exports['test 7: install, shutdown, then 2nd startup'] = function (assert) {
  let wanted = {
    reports: ["install","running","shutdown","running"],
    states: ["maybe-installing","installed","modifying","running","normal-shutdown","starting","modifying","running"]
  }
  let {thisStudy, seen, R} = setupStartupTest(studyInfoCopy());
  return promiseFinalizedStartup(thisStudy,"install").then(waitABit).then(
  () => promiseFinalizedShutdown(thisStudy, "shutdown")).then(waitABit).then(
  () => promiseFinalizedStartup(thisStudy,"startup")).then(
  ()=>{
    teardownStartupTest(R);
    endsLike(
      {
        flags: {
          ineligibleDie: undefined,
        },
        state: "running",
        reports: wanted.reports,
        states: wanted.states,
        notUrls: urlsOf(thisStudy.config.surveyUrls),
        urls: []
      },
      thisStudy,
      seen
    );
  })
};


["enable", "upgrade", "downgrade", "startup"].map(function (reason, i) {
  exports[`test 8-${reason}: all synonyms for startup: ${reason}`] = function (assert) {
    let testConfig = studyInfoCopy();
    let {thisStudy, seen, R} = setupStartupTest(testConfig);
    let wanted = {
      reports: ["running"],
      states:  ["starting","modifying","running"]
    }
    return promiseFinalizedStartup(thisStudy, reason).then(waitABit).then(
    ()=>{
      teardownStartupTest(R);
      endsLike(
        {
          flags: {
            ineligibleDie: undefined,
          },
          state: "running",
          reports: wanted.reports,
          states: wanted.states,
          notUrls: urlsOf(thisStudy.config.surveyUrls),
          urls: []
        },
        thisStudy,
        seen
      )
    })
  }
  exports[`test 9-${reason}: all synonyms for startup die if expired: ${reason}`] = function (assert) {
    prefs["shield.firstrun"] = String(500); // 1970!
    let testConfig = studyInfoCopy();
    let {thisStudy, seen, R} = setupStartupTest(testConfig);
    let wanted = {
      reports: ["end-of-study"],
      states:  ["end-of-study"]
    }
    return promiseFinalizedStartup(thisStudy, reason).then(waitABit).then(
    ()=>{
      teardownStartupTest(R);
      endsLike(
        {
          flags: {
            ineligibleDie: undefined,
            expired: true
          },
          state: "end-of-study",
          reports: wanted.reports,
          states: wanted.states,
          notUrls: [thisStudy.config.surveyUrls['user-ended-study']],
          urls: [thisStudy.config.surveyUrls['end-of-study']]
        },
        thisStudy,
        seen
      )
    })
  }
});

['uninstall', 'disable'].map(function (reason) {
  exports[`test 10-${reason}: unload during ineligibleDie doesnt send user-uninstall-disable`] = function (assert) {
    let testConfig = studyInfoCopy();
    let {thisStudy, seen, R} = setupStartupTest(testConfig);
    emit(thisStudy, "change", "ineligible-die");
    let wanted = {
      reports: ["ineligible"],
      states:  ["ineligible-die"]
    }
    return waitABit().then(
    ()=> {
      thisStudy.shutdown(reason);
      waitABit().then(
      ()=> {
        teardownStartupTest(R);
        endsLike(
          {
            flags: {
              ineligibleDie: true,
            },
            state: "ineligible-die",
            reports: wanted.reports,
            states: wanted.states,
            notUrls: urlsOf(thisStudy.config.surveyUrls),
            urls: []
          },
          thisStudy,
          seen
        )
      })
    })
  }
});

["shutdown", "upgrade", "downgrade"].map(function (reason, i) {
  exports[`test 10-${reason}: unload during ineligibleDie doesnt send normal-shutdown`] = function (assert, done) {
    let testConfig = studyInfoCopy();
    let {thisStudy, seen, R} = setupStartupTest(testConfig);
    emit(thisStudy, "change", "ineligible-die");
    let wanted = {
      reports: ["ineligible"],
      states:  ["ineligible-die"]
    }
    waitABit().then(
    ()=> {
      thisStudy.shutdown(reason);
      waitABit().then(
      ()=> {
        teardownStartupTest(R);
        endsLike(
          {
            flags: {
              ineligibleDie: true,
              expired: undefined
            },
            state: "ineligible-die",
            reports: wanted.reports,
            states: wanted.states,
            notUrls: urlsOf(thisStudy.config.surveyUrls),
            urls: []
          },
          thisStudy,
          seen
        )
        done();
      })
    }
    )
  }
});


exports['test cleanup: bad cleanup function wont stop uninstall'] = function (assert) {
  let wasCalled = false;
  let errorFn = function x () { wasCalled = true; throw new Error() };

  class BrokenCleanupStudy extends xutils.Study {
    cleanup () { super.cleanup(); errorFn() }
  }

  // check that we didn't typo, and setup is ok.
  expect(errorFn, "and it throws").to.throw(Error);
  expect(wasCalled,"now set!").to.be.true;

  // reset
  wasCalled = false;

  let {thisStudy, seen, R} = setupStartupTest(studyInfoCopy(), BrokenCleanupStudy);

  // if called directly, still an issue!
  expect(wasCalled,"unset!").to.be.false;
  expect(()=>thisStudy.cleanup(),"gross").to.throw(Error);

  expect(wasCalled,"now set!").to.be.true;
  wasCalled = false;

  // but but but, it will be called as part of the Study life-cycle
  // which will catch it.

  let wanted = {
    reports: ["user-ended-study"],
    states:  ["user-uninstall-disable"]
  }
  return waitABit().then(
  ()=> {
    thisStudy.shutdown("uninstall");
    return waitABit().then(
    ()=> {
      teardownStartupTest(R);
      endsLike(
        {
          flags: {
            ineligibleDie: undefined,
            expired: undefined
          },
          state: "user-uninstall-disable",
          reports: wanted.reports,
          states: wanted.states,
          notUrls: [],
          urls: [thisStudy.config.surveyUrls['user-ended-study']]
        },
        thisStudy,
        seen
      )
    })
  }
  )
}


exports[`test Study states: end-of-study: call all you want, only does one survey`] = function (assert) {
  let {thisStudy, seen, R} = setupStartupTest(studyInfoCopy());
  emit(thisStudy, "change", "end-of-study");
  emit(thisStudy, "change", "end-of-study");
  emit(thisStudy, "change", "end-of-study");
  emit(thisStudy, "change", "end-of-study");
  let wanted = {
    reports: ["end-of-study"],
    states:  ["end-of-study", "end-of-study", "end-of-study", "end-of-study"]
  }
  return waitABit().then(
  ()=> {
    teardownStartupTest(R);
    endsLike(
      {
        flags: {
          ineligibleDie: undefined,
          expired: true
        },
        state: "user-uninstall-disable",
        reports: wanted.reports,
        states: wanted.states,
        notUrls: [thisStudy.config.surveyUrls['user-ended-study'],'user-ended-study'],
        urls: [thisStudy.config.surveyUrls['end-of-study']]
      },
      thisStudy,
      seen
    )
    expect(countTabsLike("end-of-study"),'exactly 1 survey').to.equal(1);
  })
}

exports[`test Study states: user-uninstall-disable: call all you want, only does one survey`] = function (assert) {
  let {thisStudy, seen, R} = setupStartupTest(studyInfoCopy());
  emit(thisStudy, "change", "user-uninstall-disable");
  emit(thisStudy, "change", "user-uninstall-disable");
  emit(thisStudy, "change", "user-uninstall-disable");
  emit(thisStudy, "change", "user-uninstall-disable");
  let wanted = {
    reports: ["user-ended-study"],
    states:  ["user-uninstall-disable", "user-uninstall-disable", "user-uninstall-disable", "user-uninstall-disable"]
  }
  return waitABit().then(
  ()=> {
    teardownStartupTest(R);
    endsLike(
      {
        flags: {
          ineligibleDie: undefined,
          expired: undefined,
          dying: true
        },
        state: "user-uninstall-disable",
        reports: wanted.reports,
        states: wanted.states,
        notUrls: [thisStudy.config.surveyUrls['end-of-study'],'end-of-study'],
        urls: [thisStudy.config.surveyUrls['end-of-study']]
      },
      thisStudy,
      seen
    )
    expect(countTabsLike("user-ended-study"),'exactly 1 survey').to.equal(1);
    expect(countTabsLike(thisStudy.config.surveyUrls['user-ended-study']),'exactly 1 survey').to.equal(1);
  })
}


exports["test aliveness 1, been a day, study is expired, phone home and die"] = function (assert) {
  let config = studyInfoCopy();
  prefs["shield.firstrun"] = String(500); // 1970!
  let {thisStudy, seen, R} = setupStartupTest(config);
  let wanted = {
    reports: ["running", "end-of-study"],
    states:  ["running", "end-of-study"]
  }
  thisStudy.alivenessPulse(Date.now() - 2*DAY);
  return waitABit().then(
  ()=>{
    teardownStartupTest(R);
    endsLike(
      {
        flags: {
          ineligibleDie: undefined,
          expired: true,
        },
        firstrun: 500,
        state: "end-of-study",
        reports: wanted.reports,
        states: wanted.states,
        notUrls: [thisStudy.config.surveyUrls['end-of-study'],'end-of-study'],
        urls: [thisStudy.config.surveyUrls['user-ended-study']]
      },
      thisStudy,
      seen
    )
    expect(countTabsLike("user-ended-study"),'exactly 1 survey').to.equal(1);
  })
};

exports["test aliveness 2, been a day, study NOT expired, will phone home"] = function (assert) {
  let config = studyInfoCopy();
  let {thisStudy, seen, R} = setupStartupTest(config);
  let wanted = {
    reports: ["running"],
    states:  ["running"]
  }
  thisStudy.alivenessPulse(Date.now() - 2*DAY);
  return waitABit().then(
  ()=>{
    teardownStartupTest(R);
    endsLike(
      {
        flags: {
          ineligibleDie: undefined,
          expired: undefined,
        },
        state: "end-of-study",
        reports: wanted.reports,
        states: wanted.states,
        notUrls: [thisStudy.config.surveyUrls['end-of-study'],'end-of-study'],
        urls: [thisStudy.config.surveyUrls['user-ended-study']]
      },
      thisStudy,
      seen
    )
    expect(countTabsLike("user-ended-study"),'exactly 1 survey').to.equal(1);
  })
};


exports["test aliveness 3, < 24 hours, not expired, do nothing"] = function (assert) {
  let config = studyInfoCopy();
  let {thisStudy, seen, R} = setupStartupTest(config);
  let wanted = {
    reports: [],
    states: []
  }
  thisStudy.alivenessPulse(Date.now() - .1 * DAY); // a wee bit ago
  return waitABit().then(
  ()=>{
    teardownStartupTest(R);
    endsLike(
      {
        reports: wanted.reports,
        states: wanted.states,
      },
      thisStudy,
      seen
    )
    teardownStartupTest(R);
  })
};

exports["test aliveness 4, < 24 hours, IS expired, die"] = function (assert) {
  let config = studyInfoCopy();
  prefs["shield.firstrun"] = String(500); // 1970!
  let {thisStudy, seen, R} = setupStartupTest(config);
  let wanted = {
    reports: ['end-of-study'],
    states: ['end-of-study']
  }
  thisStudy.alivenessPulse(Date.now() - .1 * DAY);  // a week bit
  return waitABit().then(
  ()=>{
    expect(seen.reports, "reports match wanted").to.deep.equal(wanted.reports);
    expect(thisStudy.states, "states match wanted").to.deep.equal(wanted.states);
    teardownStartupTest(R);
  })
};


// TODO got up to here!

exports['test Study: surveyQueryArgs'] = function (assert) {
  let alwaysKeys = ["variation",'xname','who','updateChannel','fxVersion'];
  let S = new xutils.Study(studyInfoCopy());
  expect(S.surveyQueryArgs).to.include.keys(alwaysKeys);
}

exports['test Study: survey for different events'] = function (assert, done) {
  let S = new xutils.Study(studyInfoCopy());
  expect(S.showSurvey('some random reason')).to.be.undefined;
  expect(S.showSurvey('end-of-study')).to.not.be.undefined;
  waitABit().then(waitABit).then(waitABit).then(done);
}


exports['test survey with various queryArg things'] = function (assert) {
  // combos: [url has qa's or not, with or without extras]
  let ans = [
    ['resource://a', {b:'junk'}, {b:'junk'}, 'extra vars works' ],
    ['resource://a', {}, {'b': undefined}, 'extra vars wont appear'],
    ['resource://a?b=some%40thing', {}, {'b': 'some@thing'}, 'no escaping or unescaping, mostly'],
    ['resource://a?b=first', {'b': 'second'}, {'b': 'second'}, 'normal vars: the extra override the survey one'],
    ['resource://a?b=first&b=second', {}, {'b[0]': 'first', 'b[1]': 'second'}, "arrays are handled 'as arrays' only if in the survey url"],
    ['resource://a?b=first&b=second', {'b': 'third'}, {'b': 'third'}, "later string vars override earlier 'arrays' "],
  ];

  function toArgs(url) {
    let U = new URL(url);
    let q = U.search;
    q = querystring.parse(querystring.unescape(q.slice(1)));
    return q
  }
  for (let row of ans) {
    let surveyUrl = row[0];
    let extra = row[1];
    let theTest = row[2];
    let what_test = row[3];
    let builtUrl = xutils.survey(surveyUrl, extra);
    let qa = toArgs(builtUrl);

    // actual tests.
    for (let k in theTest) {
      expect(qa[k], what_test).to.deep.equal(theTest[k])
    }
  }
}

exports['test survey with empty urls give empty answers'] = function (assert, done) {
  expect(xutils.survey(undefined, {}),"undefined").to.be.undefined;
  expect(xutils.survey(''), 'empty string').to.be.undefined;
  done();
}

exports['test new studies: make variation, firstrun decision during init'] = function (assert, done) {
  let config = studyInfoCopy();
  let thisStudy = new xutils.Study(config);
  // equal there there is overlap!
  Object.keys(config).map((k) => {
    expect(thisStudy.config[k]).to.deep.equal(config[k])
  })
  expect(thisStudy.config).to.not.deep.equal(config);

  expect(config.firstrun).to.be.undefined;
  expect(config.variation).to.be.undefined;

  expect(thisStudy.config.firstrun).to.not.be.undefined;
  expect(thisStudy.config.variation).to.not.be.undefined;

  done();
}

exports['test new studies: respect prefs for variation, firstrun decision during init'] = function (assert, done) {
  // setup prefs first
  prefs['shield.variation'] = 'b';
  prefs['shield.firstrun'] = '500';

  let config = studyInfoCopy();
  let thisStudy = new xutils.Study(config);
  // equal there there is overlap!

  expect(prefs['shield.variation']).to.equal(thisStudy.variation);
  expect(Number(prefs['shield.firstrun'])).to.equal(thisStudy.firstrun);

  expect(thisStudy.firstrun).to.equal(500);
  expect(thisStudy.variation).to.equal('b');
  done();
}



exports['test new Study has undefined state var'] = function (assert, done) {
  let config = studyInfoCopy();
  let thisStudy = new xutils.Study(config);
  expect(thisStudy.state).to.be.undefined;
  expect(thisStudy.states).to.deep.equal([]);
  done();
};

exports['test generateTelemetryIdIfNeeded'] = function (assert) {
  let CLIENTIDPREF = "toolkit.telemetry.cachedClientID";

  return xutils.generateTelemetryIdIfNeeded().then((clientId)=>{
    expect(clientId).to.be.a("string");
    expect(clientId).to.equal(prefSvc.get(CLIENTIDPREF));
  });
};


exports['test obligatory exercise the event-target code, grrrrr'] = function (assert, done) {
  // until istanbul /* ignore next */ works with class statements
  let ET = require("../lib/event-target");
  let target = new ET.EventTarget();
  let f = target.on('blah',()=>{});
  target.once('blah',()=>{});
  target.off('blah', ()=>{});
  target.removeListener('blah', f);
  assert.pass();
  done();
}


// WHICH TESTS TO RUN.
// if anything in "only", run those instead
module.exports = (Object.keys(exports.only).length >= 1) ? exports.only : exports;

function cleanup () {
  xutils.cleanup();
  xutils.resetShieldPrefs();
  prefSvc.reset(FAKEPREF);
}
before(module.exports, function (name, assert, done) {
  console.log("***", name);
  cleanup();
  done();
});

after(module.exports, function (name, assert, done) {
  cleanup();
  only1Tab();
  done();
});

require("sdk/test").run(module.exports);
