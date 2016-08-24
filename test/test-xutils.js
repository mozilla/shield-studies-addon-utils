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
  prefSvc.set("toolkit.telemetry.server","http://localhost:5000")
  prefSvc.set("shield.fakedie",true)
  prefSvc.set("browser.selfsupport.url","")
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
  cleanup:  () => {
    xutils.resetPrefs();
    prefSvc.reset(FAKEPREF);
  },
  variations: {  // just one brach 'a'
    "a":  () => prefSvc.set(FAKEPREF,"a")
  },
  isEligible: () => true,
  name: "study-blah",
  duration: 7,   // in days,
  surveyUrl: self.data.url("some-url")
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
    ["resetPrefs", "function"],
    ["Study", "function"],
    ["survey", "function"],
    ["decideAndPersistConfig", "function"]
  ];
  let keys = expected.map((x)=>x[0]);
  expected.forEach((e) => expect(xutils[e[0]]).to.be.a(e[1]));
  expect(xutils).to.have.all.keys(keys);
  done();
}

exports["test resetPrefs actually resets"] = function (assert, done) {
  prefs["shield.firstrun"] = String(Date.now());
  prefs["shield.variation"] = "whatever";
  ["shield.firstrun", "shield.variation"].map((p) => expect(prefs[p]).to.not.be.undefined);
  xutils.resetPrefs();
  ["shield.firstrun", "shield.variation"].map((p) => expect(prefs[p]).to.be.undefined);
  done()
}

exports["test decideAndPersistConfig"] = function (assert, done) {
  //return {
  //  variation: variation,
  //  firstrun: prefs.firstrun,
  //  name: decideAndPersistConfigConfig.name,
  //  surveyUrl: decideAndPersistConfigConfig.surveyUrl,
  //  duration: decideAndPersistConfigConfig.duration
  //}
  function checkXconfig(xconfig) {
    let keys = ["variation", "firstrun", "name"];
    expect(xconfig).to.contain.keys(keys);

    expect(Number(prefs['shield.firstrun'])).to.be.an("number");
    expect(Number(prefs['shield.firstrun'])).to.equal(xconfig.firstrun);

    expect(prefs['shield.variation']).to.equal(xconfig.variation);
    ["name", "surveyUrl", "duration"].map(
      (k) => expect(xconfig[k]).to.equal(studyInfo[k])
    )
  }

  // A. precheck, empty prefs.
  expect(prefs['shield.firstrun']).to.be.undefined;
  expect(prefs['shield.variation']).to.be.undefined;

  // run decideAndPersistConfig.
  let C = studyInfoCopy();

  let xconfig = xutils.decideAndPersistConfig(C);
  let firstrun = xconfig.firstrun;
  checkXconfig(xconfig);

  // run twice, idempotent
  xconfig = xutils.decideAndPersistConfig(C);
  checkXconfig(xconfig);
  expect(xconfig.firstrun, "firstrun still same.").to.equal(firstrun)
  done();
}

exports['test Reporter: testing flag works'] = function (assert, done) {
  let reports = [];
  let R = xutils.Reporter.on("report", (d)=>reports.push(d.testing));

  xutils.report({});  // false
  prefSvc.set('shield.testing', true);
  xutils.report({});  // true
  prefSvc.set('shield.testing', false);
  xutils.report({});  // false
  waitABit().then(function () {
    expect(reports).to.deep.equal([undefined, true, undefined]);
    xutils.Reporter.off(R);
    done()
  })
}

function setupStartupTest (aConfig) {
  let thisStudy = new xutils.Study(aConfig);
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

// TODO eventTarget has all kinds of race conditions with it.
// maybe either record states as an array in the object OR
// consider doing it all promise/forward only?

exports["test startup 1: install while eligible"] = function (assert, done) {
  let {thisStudy, seen, R} = setupStartupTest(studyInfoCopy());
  // test
  // expect seen states... right now in wrong order, for ???
  thisStudy.once("final",function () {
    expect(thisStudy.flags.ineligibleDie).to.be.undefined;
    expect(thisStudy.state).to.equal("running"); // passed through installed.
    expect(hasVariationEffect()).to.be.true;
    teardownStartupTest(R);
    expect(seen.reports).to.deep.equal(["install","running"])
    expect(thisStudy.states).to.deep.equal(["maybe-installing","installed","modifying","running"])
    // no surveys open!
    waitABit().then(()=>{
      expect(hasTabWithUrlLike("some-url")).to.be.false;
      teardownStartupTest(R);
      done();
    })
  })

  thisStudy.startup("install");
}

exports["test startup 2: install while ineligible"] = function (assert, done) {
  let {thisStudy, seen, R} = setupStartupTest(studyInfoCopy());
  thisStudy.config.isEligible = () => false; // new change to nope.

  thisStudy.once("final",function () {
    expect(thisStudy.flags.ineligibleDie, true);
    expect(thisStudy.state, "ineligible-die");
    expect(hasVariationEffect()).to.be.false;
    expect(seen.reports).to.deep.equal(["ineligible"])
    expect(thisStudy.states).to.deep.equal(["maybe-installing","ineligible-die"])
    // no surveys open!
    waitABit().then(()=>{
      expect(hasTabWithUrlLike("some-url")).to.be.false;
      teardownStartupTest(R);
      done();
    })

  })

  thisStudy.startup("install");
},

exports["test startup 3a: user disables (which uninstalls)"] = function (assert, done) {
  let {thisStudy, seen, R} = setupStartupTest(studyInfoCopy());
  // does this race?
  thisStudy.once("final",function () {
    expect(hasVariationEffect()).to.be.true;

    // 2nd time!
    thisStudy.once("final", function () {
      expect(thisStudy.flags.ineligibleDie, undefined);
      expect(thisStudy.state, "user-uninstall-disable");
      expect(hasVariationEffect()).to.be.false;
      expect(seen.reports).to.deep.equal(["install","running","user-ended-study"])
      expect(thisStudy.states).to.deep.equal(["maybe-installing","installed","modifying","running","user-uninstall-disable"])
      waitABit().then(()=>{
        expect(countTabsLike("user-ended-study")).to.equal(1);
        expect(hasTabWithUrlLike("end-of-study")).to.be.false;
        teardownStartupTest(R);
        done();
      })
    })

    // #2
    thisStudy.shutdown("disable");
  })
  // #1
  thisStudy.startup("install");
}

exports["test startup 3b: user uninstalls"] = function (assert, done) {
  let {thisStudy, seen, R} = setupStartupTest(studyInfoCopy());
  thisStudy.once("final",function () {
    expect(hasVariationEffect()).to.be.true;

    // 2nd time!
    thisStudy.once("final", function () {
      expect(thisStudy.flags.ineligibleDie, undefined);
      expect(thisStudy.state, "user-uninstall-disable");
      expect(hasVariationEffect()).to.be.false;
      expect(seen.reports).to.deep.equal(["install","running","user-ended-study"])
      expect(thisStudy.states).to.deep.equal(["maybe-installing","installed","modifying","running","user-uninstall-disable"])
      waitABit().then(()=>{
        expect(countTabsLike("user-ended-study")).to.equal(1);
        expect(hasTabWithUrlLike("end-of-study")).to.be.false;
        teardownStartupTest(R);
        done();
      })
    })
    //#2
    thisStudy.shutdown("uninstall");
  })
  // #1
  thisStudy.startup("install");
}

exports["test 4: normal shutdown (fx shutdown)"] = function (assert, done) {
  let {thisStudy, seen, R} = setupStartupTest(studyInfoCopy());
  // does this race?
  thisStudy.once("final",function () {
    expect(hasVariationEffect()).to.be.true;

    // 2nd time!
    thisStudy.once("final", function () {
      expect(thisStudy.flags.ineligibleDie, undefined);
      expect(thisStudy.state, "normal-shutdown");
      expect(hasVariationEffect()).to.be.true; // still true
      expect(seen.reports).to.deep.equal(["install","running","shutdown"])
      expect(thisStudy.states).to.deep.equal(["maybe-installing","installed","modifying","running","normal-shutdown"])
      waitABit().then(()=>{
        expect(hasTabWithUrlLike("some-url")).to.be.false;
        teardownStartupTest(R);
        done();
      })
    })

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

  myStudyInfo = merge (
    myStudyInfo,
    {
      name: "special-blah",
      duration: 7,   // in days,
      surveyUrl: "resource://some-url"
    }
  );

  ['a','b','c','d','e'].map((v) => {
    // simulate previous runs
    myStudyInfo.cleanup();
    // #1: no effect yet
    expect(prefSvc.get(FAKEPREF)).to.be.undefined;

    // #2 xconfig picks the existing.
    prefs["shield.variation"] = v;
    let xconfig = xutils.decideAndPersistConfig(myStudyInfo);
    expect(xconfig.variation).to.equal(v);
  })

  // reset
  myStudyInfo.cleanup();
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

exports['test 6a: startup while expired kills a study, fires state and UT'] = function (assert, done) {
  // pretend we have been running a long time!
  prefs["shield.firstrun"] = String(500); // 1970!
  // claim: setup should pick up the existing firstrun
  let testConfig = xutils.decideAndPersistConfig(studyInfo);
  expect(testConfig.firstrun).to.equal(500);
  expect(testConfig.firstrun).to.equal(Number(prefs["shield.firstrun"]))

  let {thisStudy, seen, R} = setupStartupTest(testConfig, studyInfo);
  promiseFinalizedStartup(thisStudy, "startup").then(waitABit).then(
  ()=>{
    expect(hasTabWithUrlLike("end-of-study")).to.be.true;
    expect(hasTabWithUrlLike("user-ended-study")).to.be.false;

    expect(seen.reports).to.deep.equal(["end-of-study"]);
    expect(thisStudy.states).to.deep.equal(["end-of-study"])
    teardownStartupTest(R);
    done();
  })
};

exports['test 6b: install while expired installs a study, then immediately kills it, fires state and UT'] = function (assert, done) {
  // pretend we have been running a long time!
  prefs["shield.firstrun"] = String(500); // 1970!
  // claim: setup should pick up the existing firstrun
  let testConfig = xutils.decideAndPersistConfig(studyInfo);
  expect(testConfig.firstrun).to.equal(500);
  expect(testConfig.firstrun).to.equal(Number(prefs["shield.firstrun"]));

  let {thisStudy, seen, R} = setupStartupTest(testConfig, studyInfo);
  promiseFinalizedStartup(thisStudy).then(waitABit).then(
  ()=>{
    expect(hasTabWithUrlLike("end-of-study")).to.be.true;
    expect(hasTabWithUrlLike("user-ended-study")).to.be.false;
    expect(seen.reports).to.deep.equal(["end-of-study"]);
    expect(thisStudy.states).to.deep.equal(["end-of-study"])
    teardownStartupTest(R);
    done();
  })
};

exports['test 7: install, shutdown, then 2nd startup'] = function (assert, done) {
  let testConfig = xutils.decideAndPersistConfig(studyInfo);
  let wanted = {
    reports: ["install","running","shutdown","running"],
    states: ["maybe-installing","installed","modifying","running","normal-shutdown","starting","modifying","running"]
  }
  let {thisStudy, seen, R} = setupStartupTest(testConfig, studyInfo);
  promiseFinalizedStartup(thisStudy).then(waitABit).then(
  () => promiseFinalizedShutdown(thisStudy, "shutdown")).then(waitABit).then(
  () => promiseFinalizedStartup(thisStudy,"startup")).then(
  ()=>{
    expect(hasTabWithUrlLike("end-of-study")).to.be.false;
    expect(hasTabWithUrlLike("user-ended-study")).to.be.false;
    expect(seen.reports).to.deep.equal(wanted.reports);
    expect(thisStudy.states).to.deep.equal(wanted.states);
    teardownStartupTest(R);
    done();
  })
};


["enable", "upgrade", "downgrade", "startup"].map(function (reason, i) {
  exports[`test 8-${reason}: all synonyms for startup: ${reason}`] = function (assert, done) {
    let testConfig = xutils.decideAndPersistConfig(studyInfo);
    let {thisStudy, seen, R} = setupStartupTest(testConfig, studyInfo);
    let wanted = {
      reports: ["running"],
      states:  ["starting","modifying","running"]
    }
    promiseFinalizedStartup(thisStudy, reason).then(waitABit).then(
    ()=>{
      expect(hasTabWithUrlLike("end-of-study")).to.be.false;
      expect(hasTabWithUrlLike("user-ended-study")).to.be.false;

      expect(seen.reports).to.deep.equal(wanted.reports);
      expect(thisStudy.states).to.deep.equal(wanted.states)
      teardownStartupTest(R);
      done();
    })
  }
  exports[`test 9-${reason}: all synonyms for startup die if expired: ${reason}`] = function (assert, done) {
    prefs["shield.firstrun"] = String(500); // 1970!
    let testConfig = xutils.decideAndPersistConfig(studyInfo);
    let {thisStudy, seen, R} = setupStartupTest(testConfig, studyInfo);
    let wanted = {
      reports: ["end-of-study"],
      states:  ["end-of-study"]
    }
    promiseFinalizedStartup(thisStudy, reason).then(waitABit).then(
    ()=>{
      expect(hasTabWithUrlLike("end-of-study")).to.be.true;
      expect(hasTabWithUrlLike("user-ended-study")).to.be.false;
      expect(seen.reports).to.deep.equal(wanted.reports);
      expect(thisStudy.states).to.deep.equal(wanted.states)
      teardownStartupTest(R);
      done();
    })
  }
});

['uninstall', 'disable'].map(function (reason) {
  exports[`test 10-${reason}: unload during ineligibleDie doesnt send user-uninstall-disable`] = function (assert, done) {
    let testConfig = xutils.decideAndPersistConfig(studyInfo);
    let {thisStudy, seen, R} = setupStartupTest(testConfig, studyInfo);
    emit(thisStudy, "change", "ineligible-die");
    let wanted = {
      reports: ["ineligible"],
      states:  ["ineligible-die"]
    }
    waitABit().then(
    ()=> {
      expect(thisStudy.flags.ineligibleDie, 'should have ineligibleDie').to.be.true;
      thisStudy.shutdown(reason);
      waitABit().then(
      ()=> {
        expect(hasTabWithUrlLike(studyInfo.surveyUrl)).to.be.false;
        expect(seen.reports).to.deep.equal(wanted.reports);
        expect(thisStudy.states).to.deep.equal(wanted.states)
        teardownStartupTest(R);
        done();
      })
    })
  }
});

["shutdown", "upgrade", "downgrade"].map(function (reason, i) {
  exports[`test 10-${reason}: unload during ineligibleDie doesnt send normal-shutdown`] = function (assert, done) {
    let testConfig = xutils.decideAndPersistConfig(studyInfo);
    let {thisStudy, seen, R} = setupStartupTest(testConfig, studyInfo);
    emit(thisStudy, "change", "ineligible-die");
    let wanted = {
      reports: ["ineligible"],
      states:  ["ineligible-die"]
    }
    waitABit().then(
    ()=> {
      expect(thisStudy.flags.ineligibleDie, "ineligibleDie should be true").to.be.true;
      thisStudy.shutdown(reason);
      waitABit().then(
      ()=> {
        expect(hasTabWithUrlLike(studyInfo.surveyUrl)).to.be.false;
        expect(seen.reports).to.deep.equal(wanted.reports);
        expect(thisStudy.states).to.deep.equal(wanted.states)
        teardownStartupTest(R);
        done();
      })
    }
    )
  }
});

exports[`test Study states: end-of-study: call all you want, only does one survey`] = function (assert, done) {
  let testConfig = xutils.decideAndPersistConfig(studyInfo);
  let {thisStudy, seen, R} = setupStartupTest(testConfig, studyInfo);
  emit(thisStudy, "change", "end-of-study");
  emit(thisStudy, "change", "end-of-study");
  emit(thisStudy, "change", "end-of-study");
  emit(thisStudy, "change", "end-of-study");
  let wanted = {
    reports: ["end-of-study"],
    states:  ["end-of-study", "end-of-study", "end-of-study", "end-of-study"]
  }
  waitABit().then(
  ()=> {
    expect(thisStudy.flags.expired).to.be.true;
    expect(hasTabWithUrlLike('user-ended-study')).to.be.false;
    expect(countTabsLike("end-of-study"),'exactly 1 survey').to.equal(1);
    expect(countTabsLike(testConfig.surveyUrl),'exactly 1 survey').to.equal(1);
    expect(seen.reports).to.deep.equal(wanted.reports);
    expect(thisStudy.states).to.deep.equal(wanted.states)
    teardownStartupTest(R);
    done();
  }
  )
}

exports[`test Study states: user-uninstall-disable: call all you want, only does one survey`] = function (assert, done) {
  let testConfig = xutils.decideAndPersistConfig(studyInfo);
  let {thisStudy, seen, R} = setupStartupTest(testConfig, studyInfo);
  emit(thisStudy, "change", "user-uninstall-disable");
  emit(thisStudy, "change", "user-uninstall-disable");
  emit(thisStudy, "change", "user-uninstall-disable");
  emit(thisStudy, "change", "user-uninstall-disable");
  let wanted = {
    reports: ["user-ended-study"],
    states:  ["user-uninstall-disable", "user-uninstall-disable", "user-uninstall-disable", "user-uninstall-disable"]
  }
  waitABit().then(
  ()=> {
    expect(thisStudy.flags.dying).to.be.true;
    expect(hasTabWithUrlLike('end-of-study')).to.be.false;
    expect(countTabsLike("user-ended-study"),'exactly 1 survey').to.equal(1);
    expect(countTabsLike(testConfig.surveyUrl),'exactly 1 survey').to.equal(1);
    expect(seen.reports).to.deep.equal(wanted.reports);
    expect(thisStudy.states).to.deep.equal(wanted.states)
    teardownStartupTest(R);
    done();
  }
  )
}


exports["test aliveness 1, been a day, study is expired, phone home and die"] = function (assert, done) {
  let config = merge({}, studyInfo);
  prefs["shield.firstrun"] = String(500); // 1970!
  let {thisStudy, seen, R} = setupStartupTest(config);
  let wanted = {
    reports: ["running", "end-of-study"],
    states:  ["running", "end-of-study"]
  }
  thisStudy.alivenessPulse(Date.now() - 2*DAY);
  waitABit().then(
  ()=>{
    expect(seen.reports).to.deep.equal(wanted.reports);
    expect(thisStudy.states).to.deep.equal(wanted.states);
    teardownStartupTest(R);
    done();
  })
};

exports["test aliveness 2, been a day, study NOT expired, will phone home"] = function (assert, done) {
  let config = merge({}, studyInfo);
  let {thisStudy, seen, R} = setupStartupTest(config);
  let wanted = {
    reports: ["running"],
    states:  ["running"]
  }
  thisStudy.alivenessPulse(Date.now() - 2*DAY);
  waitABit().then(
  ()=>{
    expect(seen.reports).to.deep.equal(wanted.reports);
    expect(thisStudy.states).to.deep.equal(wanted.states);
    teardownStartupTest(R);
    done();
  })
};


exports["test aliveness 3, < 24 hours, not expired, do nothing"] = function (assert, done) {
  let config = merge({}, studyInfo);
  let {thisStudy, seen, R} = setupStartupTest(config);
  let wanted = {
    reports: [],
    states: []
  }
  thisStudy.alivenessPulse(Date.now() - .1 * DAY); // a wee bit ago
  waitABit().then(
  ()=>{
    expect(seen.reports).to.deep.equal(wanted.reports);
    expect(thisStudy.states).to.deep.equal(wanted.states);
    teardownStartupTest(R);
    done();
  })
};

exports["test aliveness 4, < 24 hours, IS expired, die"] = function (assert, done) {
  let config = merge({}, studyInfo);
  prefs["shield.firstrun"] = String(500); // 1970!
  let {thisStudy, seen, R} = setupStartupTest(config);
  let wanted = {
    reports: ['end-of-study'],
    states: ['end-of-study']
  }
  thisStudy.alivenessPulse(Date.now() - .1 * DAY);  // a week bit
  waitABit().then(
  ()=>{
    expect(seen.reports).to.deep.equal(wanted.reports);
    expect(thisStudy.states).to.deep.equal(wanted.states);
    teardownStartupTest(R);
    done();
  })
};

exports['test survey with various queryArg things'] = function (assert, done) {
  // combos: [url has qa's or not, with or without extras]
  let ans = [
    ['resource://a', {b:'junk'}, {b:'junk'}, 'extra vars works' ],
    ['resource://a', {}, {'b': undefined}, 'extra vars wont appear'],
    ['resource://a?b=some%40thing', {}, {'b': 'some@thing'}, 'no escaping or unescaping, mostly'],
    ['resource://a?b=first', {'b': 'second'}, {'b': 'second'}, 'normal vars: the extra override the survey one'],
    ['resource://a?b=first&b=second', {}, {'b[0]': 'first', 'b[1]': 'second'}, "arrays are handled 'as arrays' only if in the survey url"],
    ['resource://a?b=first&b=second', {'b': 'third'}, {'b': 'third'}, "later string vars override earlier 'arrays' "],
    // this are for the special 'xname' key
    ['resource://a?xname=first', {xname: 'second'}, {xname: studyInfo.name}, 'config wins on "special" keys'],
    ['resource://a?xname=first', {}, {xname: studyInfo.name}, 'config wins or "special" keys'],
  ];

  function toArgs(url) {
    let U = new URL(url);
    let q = U.search;
    q = querystring.parse(querystring.unescape(q.slice(1)));
    return q
  }
  let alwaysKeys = ["variation",'xname','who','updateChannel','fxVersion'];
  for (let row of ans) {
    let config = merge({}, studyInfo);
    config.surveyUrl = row[0];
    let extra = row[1];
    let theTest = row[2];
    let what_test = row[3];
    let builtUrl = xutils.survey(config, extra);
    let qa = toArgs(builtUrl);

    // actual tests.
    expect(qa).to.include.keys(alwaysKeys);
    for (let k in theTest) {
      expect(qa[k], what_test).to.deep.equal(theTest[k])
    }
  }
  waitABit().then(waitABit).then(done)
}


exports['test new studies make arm, firstrun decision during init'] = function (assert, done) {
  let config = studyInfoCopy();
  let thisStudy = new xutils.Study(config);
  // equal there there is overlap!
  Object.keys(config).map(
    (k) => expect(thisStudy.config[k]).to.deep.equal(config[k])
  )
  expect(thisStudy.config).to.not.deep.equal(config); // no!

  expect(config.firstrun).to.be.undefined;
  expect(config.variation).to.be.undefined;

  expect(thisStudy.config.firstrun).to.not.be.undefined;
  expect(thisStudy.config.variation).to.not.be.undefined;

  done();
}

exports['test new studies respect arm, firstrun decision during init'] = function (assert, done) {
  let config = xutils.decideAndPersistConfig(studyInfoCopy());  // decided!
  let thisStudy = new xutils.Study(config);
  // equal there there is overlap!

  expect(thisStudy.config).to.deep.equal(config);  // yes!
  expect(config.firstrun).to.not.be.undefined;
  expect(config.variation).to.not.be.undefined;

  expect(thisStudy.config.firstrun).to.not.be.undefined;
  expect(thisStudy.config.variation).to.not.be.undefined;

  done();
}

exports['test new Study has undefined state var'] = function (assert, done) {
  let config = studyInfoCopy();
  let thisStudy = new xutils.Study(config);
  expect(thisStudy.state).to.be.undefined;
  expect(thisStudy.states).to.deep.equal([]);
  done();
};

exports['test generateTelemetryIdIfNeeded'] = function (assert, done) {
  let CLIENTIDPREF = "toolkit.telemetry.cachedClientID";

  xutils.generateTelemetryIdIfNeeded().then((clientId)=>{
    expect(clientId).to.be.a("string");
    expect(clientId).to.equal(prefSvc.get(CLIENTIDPREF));
    done();
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

before(module.exports, function (name, assert, done) {
  console.log("***", name);
  studyInfo.cleanup();
  done();
});

after(module.exports, function (name, assert, done) {
  studyInfo.cleanup();
  only1Tab();
  done();
});

require("sdk/test").run(module.exports);
