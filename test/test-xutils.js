var { expect } = require("chai");

let prefSvc = require("sdk/preferences/service");
let prefs = require("sdk/simple-prefs").prefs;

var xutils = require("../lib/");

let { before, after } = require("sdk/test/utils");
exports.only = {}
exports.skip = {}

// useful for local dev
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
  console.log("only 1 tab", tabs.length);
}



// A Fake Experiment for these tests
const FAKEPREF = "fake.variations.pref";
var variationsMod = {
  cleanup:  () => {
    xutils.resetPrefs();
    prefSvc.reset(FAKEPREF);
  },
  variations: {
    "a":  () => prefSvc.set(FAKEPREF,true)
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


/** Tests Begin Here */

exports["test Module has right keys and types"] = function (assert) {
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
}

exports["test resetPrefs actually resets"] = function (assert) {
  prefs["firstrun"] = String(Date.now());
  prefs["variation"] = "whatever";
  ["firstrun", "variation"].map((p) => expect(prefs[p]).to.not.be.undefined);
  xutils.resetPrefs();
  ["firstrun", "variation"].map((p) => expect(prefs[p]).to.be.undefined);
}

exports["test xsetup"] = function (assert) {
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
}


function hasVariationEffect() Boolean(prefSvc.get(FAKEPREF));

function watchStates(statesExpected) {
  return
}

function setupStartupTest () {
  let thisStudy = new xutils.Study(aConfig, variationsMod);
  let seen = {reports: [], states: []};
  // what goes to telemetry
  let R = xutils.Reporter.on("report",(d)=>seen.reports.push(d.msg));
  thisStudy.on("change",(d)=>{console.log("test onChange", d); seen.states.push(d)});
  return {seen: seen, R: R, thisStudy: thisStudy}
}

function teardownStartupTest (R) {
  xutils.Reporter.off(R);
}

// TODO eventTarget has all kinds of race conditions with it.
// maybe either record states as an array in the object OR
// consider doing it all promise/forward only?

exports.only["test startup 1: install while eligible"] = function (assert, done) {
  let {thisStudy, seen, R} = setupStartupTest();
  // test
  // expect seen states... right now in wrong order, for ???
  thisStudy.once("final",function () {
    console.log(JSON.stringify(seen));
    expect(thisStudy.flags.ineligibleDie).to.be.undefined;
    expect(thisStudy.state).to.equal("running"); // passed through installed.
    expect(hasVariationEffect()).to.be.true;
    teardownStartupTest(R);
    done();
  })

  xutils.handleStartup({loadReason: "install"}, thisStudy);
}

exports["test startup 2: install while ineligible"] = function (assert, done) {
  let {thisStudy, seen, R} = setupStartupTest();
  thisStudy.variationsMod.isEligible = () => false; // new change to nope.

  thisStudy.once("final",function () {
    console.log(JSON.stringify(seen));
    expect(thisStudy.flags.ineligibleDie, true);
    expect(thisStudy.state, "ineligible-die");
    expect(hasVariationEffect()).to.be.false;
    teardownStartupTest(R);
    done();
  })

  xutils.handleStartup({loadReason: "install"}, thisStudy);
},

exports["test startup 3a: user disables"] = function (assert, done) {
  let {thisStudy, seen, R} = setupStartupTest();
  // does this race?
  thisStudy.once("final",function () {
    expect(hasVariationEffect()).to.be.true;

    // 2nd time!
    thisStudy.once("final", function () {
      console.log('2nd final', JSON.stringify(seen));
      expect(thisStudy.flags.ineligibleDie, undefined);
      expect(thisStudy.state, "user-uninstall-disable");
      expect(hasVariationEffect()).to.be.false;
      teardownStartupTest(R);
      done();
    })

    // #2
    xutils.handleOnUnload("disable", thisStudy);
  })
  // #1
  xutils.handleStartup({loadReason: "install"}, thisStudy)

}

exports["test startup 3b: user uninstalls"] = function (assert, done) {
  let {thisStudy, seen, R} = setupStartupTest();
  thisStudy.once("final",function () {
    expect(hasVariationEffect()).to.be.true;

    // 2nd time!
    thisStudy.once("final", function () {
      console.log(JSON.stringify(seen));
      expect(thisStudy.flags.ineligibleDie, undefined);
      expect(thisStudy.state, "user-uninstall-disable");
      expect(hasVariationEffect()).to.be.false;
      teardownStartupTest(R);
      done();
    })
    //#2
    xutils.handleOnUnload("uninstall", thisStudy);
  })
  // #1
  xutils.handleStartup({loadReason: "install"}, thisStudy)
}

exports["test 4: normal handleOnUnload"] = function (assert, done) {
  let {thisStudy, seen, R} = setupStartupTest();
  // does this race?
  thisStudy.once("final",function () {
    expect(hasVariationEffect()).to.be.true;

    // 2nd time!
    thisStudy.once("final", function () {
      console.log(JSON.stringify(seen));
      expect(thisStudy.flags.ineligibleDie, undefined);
      expect(thisStudy.state, "user-uninstall-disable");
      expect(hasVariationEffect()).to.be.false;
      teardownStartupTest(R);
      done();
    })

    xutils.handleOnUnload("uninstall", thisStudy);
  })

  // first install
  xutils.handleStartup({loadReason: "install"}, thisStudy)

}

/* other tests:
  - handleStartup and Shutdown init the study otherwise.
*/


before(exports, function (name, assert) {
  variationsMod.cleanup();
});

after(exports, function (name, assert) {
  variationsMod.cleanup();
  only1Tab();
});


// if anything in "only", run those instead
module.exports = (Object.keys(exports.only).length >= 1) ? exports.only : exports;
console.log(Object.keys(module.exports))
require("sdk/test").run(module.exports);
