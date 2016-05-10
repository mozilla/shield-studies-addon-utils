var { expect } = require("chai");

const { merge } = require("sdk/util/object");
const { setTimeout } = require("sdk/timers");

let prefSvc = require("sdk/preferences/service");
let prefs = require("sdk/simple-prefs").prefs;

var xutils = require("../lib/");

let { before, after } = require("sdk/test/utils");
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
  };
}

function hasTabWithUrlLike(aRegexp) {
  if (typeof aRegexp  === 'string') aRegexp = new RegExp(aRegexp)
  for (let tab of tabs) {
    if (aRegexp.test(tab.url)) return true
  }
  return false;
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
  surveyUrl: "some url"
};

const aConfig = xutils.xsetup(forSetup);

function hasVariationEffect() Boolean(prefSvc.get(FAKEPREF));

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
    ["studyManager", "object"],
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

function setupStartupTest (aConfig, variationsMod) {
  let thisStudy = new xutils.Study(
    merge({},aConfig),      // copy
    merge({},variationsMod)  // copy
  );
  let seen = {reports: []};
  // what goes to telemetry
  let R = xutils.Reporter.on("report",(d)=>seen.reports.push(d.msg));
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
      expect(hasTabWithUrlLike("some url")).to.be.false;
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
      expect(hasTabWithUrlLike("some url")).to.be.false;
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
        expect(hasTabWithUrlLike("user-ended-study")).to.be.true;
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
        expect(hasTabWithUrlLike("user-ended-study")).to.be.true;
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
        expect(hasTabWithUrlLike("some url")).to.be.false;
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

  mySetup = {
    name: "special-blah",
    choices: Object.keys(myVariations.variations), // names of branches.
    duration: 7,   // in days,
    surveyUrl: "some url"
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
  let {thisStudy, seen, R} = setupStartupTest(xconfig, myVariations);
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
    expect(seen.reports).to.deep.equal(["end-of-study"]);
    expect(thisStudy.states).to.deep.equal(["end-of-study"])
    teardownStartupTest(R);
    done();
  })
};



/* MOAR TESTS */
// 'time's up'
// simulate several install uninstalls?
// test all the utility functions?




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
