var { expect } = require("chai");

const { merge } = require("sdk/util/object");
const { setTimeout } = require("sdk/timers");
const { emit } = require("sdk/event/core");
const querystring = require("sdk/querystring");
const { URL } = require("sdk/url");

let prefSvc = require("sdk/preferences/service");
let prefs = require("sdk/simple-prefs").prefs;

var xutils = require("../coverage/instrument/lib/");

let { before, after } = require("sdk/test/utils");

const self = require("sdk/self");

const DAY = 86400*1000;

exports.only = {}
exports.skip = {}

/* Testing utilities */
function setupEnv () {
  prefSvc.set("toolkit.telemetry.server","http://localhost:5000")
  prefSvc.set("shield.fakedie",true)
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
var variationsMod = {
  cleanup:  () => {
    xutils.resetPrefs();
    prefSvc.reset(FAKEPREF);
  },
  variations: {
    "a":  () => prefSvc.set(FAKEPREF,"a")
  },
  isEligible: () => true,
}

const forSetup = {
  name: "study-blah",
  choices: Object.keys(variationsMod.variations), // names of branches.
  duration: 7,   // in days,
  surveyUrl: self.data.url("some-url")
};

const aConfig = xutils.xsetup(forSetup);
console.log(aConfig);
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
    ["handleOnUnload", "function"],
    ["handleStartup", "function"],
    ["report", "function"],
    ["Reporter", "object"],
    ["resetPrefs", "function"],
    ["Study", "function"],
    ["survey", "function"],
    ["xsetup", "function"]
  ];
  let keys = expected.map((x)=>x[0]);
  expected.forEach((e) => expect(xutils[e[0]]).to.be.a(e[1]));
  expect(xutils).to.have.all.keys(keys);
  done();
}

exports["test resetPrefs actually resets"] = function (assert, done) {
  prefs["firstrun"] = String(Date.now());
  prefs["variation"] = "whatever";
  ["firstrun", "variation"].map((p) => expect(prefs[p]).to.not.be.undefined);
  xutils.resetPrefs();
  ["firstrun", "variation"].map((p) => expect(prefs[p]).to.be.undefined);
  done()
}

exports["test xsetup"] = function (assert, done) {
  //return {
  //  variation: variation,
  //  firstrun: prefs.firstrun,
  //  name: xSetupConfig.name,
  //  surveyUrl: xSetupConfig.surveyUrl,
  //  duration: xSetupConfig.duration
  //}
  function checkXconfig(xconfig) {
    let keys = ["variation", "firstrun", "name", "surveyUrl", "duration", "who"];
    expect(xconfig).to.have.keys(keys);

    expect(Number(prefs.firstrun)).to.be.an("number");
    expect(prefs.firstrun).to.equal(xconfig.firstrun);

    expect(prefs.variation).to.equal(xconfig.variation);
    ["name", "surveyUrl", "duration"].map(
      (k) => expect(xconfig[k]).to.equal(forSetup[k])
    )
  }

  // A. precheck, empty prefs.
  expect(prefs.firstrun).to.be.undefined;
  expect(prefs.variation).to.be.undefined;

  // run xsetup.
  let xconfig = xutils.xsetup(forSetup);
  let firstrun = xconfig.firstrun;
  checkXconfig(xconfig);

  // run twice, idempotent
  xconfig = xutils.xsetup(forSetup);
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

function setupStartupTest (aConfig, variationsMod) {
  let thisStudy = new xutils.Study(
    merge({}, aConfig),      // copy
    merge({}, variationsMod)  // copy
  );
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
    xutils.handleStartup({loadReason: reason}, aStudy);
  })
}

function promiseFinalizedShutdown(aStudy, reason="shutdown") {
  return new Promise((res, rej) => {
    aStudy.once("final",res);
    xutils.handleOnUnload(reason, aStudy);
  })
}

// TODO eventTarget has all kinds of race conditions with it.
// maybe either record states as an array in the object OR
// consider doing it all promise/forward only?

exports["test startup 1: install while eligible"] = function (assert, done) {
  let {thisStudy, seen, R} = setupStartupTest(aConfig, variationsMod);
  // test
  // expect seen states... right now in wrong order, for ???
  thisStudy.once("final",function () {
    expect(thisStudy.flags.ineligibleDie).to.be.undefined;
    expect(thisStudy.state).to.equal("running"); // passed through installed.
    expect(hasVariationEffect()).to.be.true;
    teardownStartupTest(R);
    expect(seen.reports).to.deep.equal(["install","running"])
    expect(thisStudy.states).to.deep.equal(["installing","modifying","running"])
    // no surveys open!
    waitABit().then(()=>{
      expect(hasTabWithUrlLike("some-url")).to.be.false;
      teardownStartupTest(R);
      done();
    })
  })

  xutils.handleStartup({loadReason: "install"}, thisStudy);
}

exports["test startup 2: install while ineligible"] = function (assert, done) {
  let {thisStudy, seen, R} = setupStartupTest(aConfig, variationsMod);
  thisStudy.variationsMod.isEligible = () => false; // new change to nope.

  thisStudy.once("final",function () {
    expect(thisStudy.flags.ineligibleDie, true);
    expect(thisStudy.state, "ineligible-die");
    expect(hasVariationEffect()).to.be.false;
    expect(seen.reports).to.deep.equal(["ineligible"])
    expect(thisStudy.states).to.deep.equal(["installing","ineligible-die"])
    // no surveys open!
    waitABit().then(()=>{
      expect(hasTabWithUrlLike("some-url")).to.be.false;
      teardownStartupTest(R);
      done();
    })

  })

  xutils.handleStartup({loadReason: "install"}, thisStudy);
},

exports["test startup 3a: user disables (which uninstalls)"] = function (assert, done) {
  let {thisStudy, seen, R} = setupStartupTest(aConfig, variationsMod);
  // does this race?
  thisStudy.once("final",function () {
    expect(hasVariationEffect()).to.be.true;

    // 2nd time!
    thisStudy.once("final", function () {
      expect(thisStudy.flags.ineligibleDie, undefined);
      expect(thisStudy.state, "user-uninstall-disable");
      expect(hasVariationEffect()).to.be.false;
      expect(seen.reports).to.deep.equal(["install","running","user-ended-study"])
      expect(thisStudy.states).to.deep.equal(["installing","modifying","running","user-uninstall-disable"])
      waitABit().then(()=>{
        expect(countTabsLike("user-ended-study")).to.equal(1);
        expect(hasTabWithUrlLike("end-of-study")).to.be.false;
        teardownStartupTest(R);
        done();
      })
    })

    // #2
    xutils.handleOnUnload("disable", thisStudy);
  })
  // #1
  xutils.handleStartup({loadReason: "install"}, thisStudy)

}

exports["test startup 3b: user uninstalls"] = function (assert, done) {
  let {thisStudy, seen, R} = setupStartupTest(aConfig, variationsMod);
  thisStudy.once("final",function () {
    expect(hasVariationEffect()).to.be.true;

    // 2nd time!
    thisStudy.once("final", function () {
      expect(thisStudy.flags.ineligibleDie, undefined);
      expect(thisStudy.state, "user-uninstall-disable");
      expect(hasVariationEffect()).to.be.false;
      expect(seen.reports).to.deep.equal(["install","running","user-ended-study"])
      expect(thisStudy.states).to.deep.equal(["installing","modifying","running","user-uninstall-disable"])
      waitABit().then(()=>{
        expect(countTabsLike("user-ended-study")).to.equal(1);
        expect(hasTabWithUrlLike("end-of-study")).to.be.false;
        teardownStartupTest(R);
        done();
      })
    })
    //#2
    xutils.handleOnUnload("uninstall", thisStudy);
  })
  // #1
  xutils.handleStartup({loadReason: "install"}, thisStudy)
}

exports["test 4: normal handleOnUnload (fx shutdown)"] = function (assert, done) {
  let {thisStudy, seen, R} = setupStartupTest(aConfig, variationsMod);
  // does this race?
  thisStudy.once("final",function () {
    expect(hasVariationEffect()).to.be.true;

    // 2nd time!
    thisStudy.once("final", function () {
      expect(thisStudy.flags.ineligibleDie, undefined);
      expect(thisStudy.state, "normal-shutdown");
      expect(hasVariationEffect()).to.be.true; // still true
      expect(seen.reports).to.deep.equal(["install","running","shutdown"])
      expect(thisStudy.states).to.deep.equal(["installing","modifying","running","normal-shutdown"])
      waitABit().then(()=>{
        expect(hasTabWithUrlLike("some-url")).to.be.false;
        teardownStartupTest(R);
        done();
      })
    })

    xutils.handleOnUnload("shutdown", thisStudy);
  })

  // first install
  xutils.handleStartup({loadReason: "install"}, thisStudy)
}


exports['test 5: startup REVIVING a previous config keeps that config'] = function (assert, done) {
  let myVariations = merge({}, variationsMod); // copy
  // setup

  myVariations.variations = {
    "a":  () => prefSvc.set(FAKEPREF,'a'),
    "b":  () => prefSvc.set(FAKEPREF,'b'),
    "c":  () => prefSvc.set(FAKEPREF,'c'),
    "d":  () => prefSvc.set(FAKEPREF,'d'),
    "e":  () => prefSvc.set(FAKEPREF,'e')
  }

  let mySetup = {
    name: "special-blah",
    choices: Object.keys(myVariations.variations), // names of branches.
    duration: 7,   // in days,
    surveyUrl: "resource://some-url"
  };

  let xconfig;
  ['a','b','c','d','e'].map((v) => {
    // simulate previous runs
    myVariations.cleanup();
    // #1: no effect yet
    expect(prefSvc.get(FAKEPREF)).to.be.undefined;

    // #2 xconfig picks the existing.
    prefs["variation"] = v;
    xconfig = xutils.xsetup(mySetup);
    expect(xconfig.variation).to.equal(v);
  })

  // reset
  myVariations.cleanup();
  expect(prefSvc.get(FAKEPREF)).to.be.undefined;
  expect(xconfig.variation).to.equal("e");

  // #3, do an install, and prove it did 'e'
  let {thisStudy, R} = setupStartupTest(xconfig, myVariations);
  promiseFinalizedStartup(thisStudy).then(waitABit).then(
  ()=>{
    expect(prefSvc.get(FAKEPREF)).to.be.equal("e");
    teardownStartupTest(R);
    done();
  })
};

exports['test 6a: startup while expired kills a study, fires state and UT'] = function (assert, done) {
  // pretend we have been running a long time!
  prefs["firstrun"] = String(500); // 1970!
  // claim: setup should pick up the existing firstrun
  let testConfig = xutils.xsetup(forSetup);
  expect(testConfig.firstrun).to.equal(String(500));
  expect(testConfig.firstrun).to.equal(prefs["firstrun"])

  let {thisStudy, seen, R} = setupStartupTest(testConfig, variationsMod);
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
  prefs["firstrun"] = String(500); // 1970!
  // claim: setup should pick up the existing firstrun
  let testConfig = xutils.xsetup(forSetup);
  expect(testConfig.firstrun).to.equal(String(500));
  expect(testConfig.firstrun).to.equal(prefs["firstrun"])

  let {thisStudy, seen, R} = setupStartupTest(testConfig, variationsMod);
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
  let testConfig = xutils.xsetup(forSetup);
  let wanted = {
    reports: ["install","running","shutdown","running"],
    states: ["installing","modifying","running","normal-shutdown","starting","modifying","running"]
  }
  let {thisStudy, seen, R} = setupStartupTest(testConfig, variationsMod);
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
    let testConfig = xutils.xsetup(forSetup);
    let {thisStudy, seen, R} = setupStartupTest(testConfig, variationsMod);
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
    prefs["firstrun"] = String(500); // 1970!
    let testConfig = xutils.xsetup(forSetup);
    let {thisStudy, seen, R} = setupStartupTest(testConfig, variationsMod);
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
    let testConfig = xutils.xsetup(forSetup);
    let {thisStudy, seen, R} = setupStartupTest(testConfig, variationsMod);
    emit(thisStudy, "change", "ineligible-die");
    let wanted = {
      reports: ["ineligible"],
      states:  ["ineligible-die"]
    }
    waitABit().then(
    ()=> {
      expect(thisStudy.flags.ineligibleDie, 'should have ineligibleDie').to.be.true;
      xutils.handleOnUnload(reason, thisStudy);
      waitABit().then(
      ()=> {
        expect(hasTabWithUrlLike(forSetup.surveyUrl)).to.be.false;
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
    let testConfig = xutils.xsetup(forSetup);
    let {thisStudy, seen, R} = setupStartupTest(testConfig, variationsMod);
    emit(thisStudy, "change", "ineligible-die");
    let wanted = {
      reports: ["ineligible"],
      states:  ["ineligible-die"]
    }
    waitABit().then(
    ()=> {
      expect(thisStudy.flags.ineligibleDie, "ineligibleDie should be true").to.be.true;
      xutils.handleOnUnload(reason, thisStudy);
      waitABit().then(
      ()=> {
        expect(hasTabWithUrlLike(forSetup.surveyUrl)).to.be.false;
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
  let testConfig = xutils.xsetup(forSetup);
  let {thisStudy, seen, R} = setupStartupTest(testConfig, variationsMod);
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
  let testConfig = xutils.xsetup(forSetup);
  let {thisStudy, seen, R} = setupStartupTest(testConfig, variationsMod);
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
  let config = merge({}, aConfig);
  config.firstrun = 500;  // 1970
  let {thisStudy, seen, R} = setupStartupTest(config, variationsMod);
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
  let config = merge({}, aConfig);
  let {thisStudy, seen, R} = setupStartupTest(config, variationsMod);
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
  let config = merge({}, aConfig);
  let {thisStudy, seen, R} = setupStartupTest(config, variationsMod);
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
  let config = merge({}, aConfig);
  config.firstrun = 500;  // 1970
  let {thisStudy, seen, R} = setupStartupTest(config, variationsMod);
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
    ['resource://a?xname=first', {xname: 'second'}, {xname: aConfig.name}, 'config wins on "special" keys'],
    ['resource://a?xname=first', {}, {xname: aConfig.name}, 'config wins or "special" keys'],
  ];

  function toArgs(url) {
    let U = new URL(url);
    let q = U.search;
    q = querystring.parse(querystring.unescape(q.slice(1)));
    return q
  }
  let alwaysKeys = ["variation",'xname','who','updateChannel','fxVersion'];
  for (let row of ans) {
    let config = merge({}, aConfig);
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


exports['test new Study has undefined state var'] = function (assert, done) {
  let thisStudy = new xutils.Study(
    merge({},aConfig),      // copy
    merge({},variationsMod)  // copy
  );
  expect(thisStudy.xconfig).to.deep.equal(aConfig);
  expect(thisStudy.variationsMod).to.deep.equal(variationsMod);
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


// WHICH TESTS TO RUN.
// if anything in "only", run those instead
module.exports = (Object.keys(exports.only).length >= 1) ? exports.only : exports;

before(module.exports, function (name, assert, done) {
  console.log("***", name);
  variationsMod.cleanup();
  done();
});

after(module.exports, function (name, assert, done) {
  variationsMod.cleanup();
  only1Tab();
  done();
});

require("sdk/test").run(module.exports);
