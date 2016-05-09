var { expect } = require("chai");

let prefSvc = require("sdk/preferences/service");
let prefs = require("sdk/simple-prefs").prefs;

var xutils = require("../lib/");

let { before, after } = require('sdk/test/utils');

// useful for local dev
function setupEnv () {
  prefSvc.set("toolkit.telemetry.server","http://localhost:5000")
  prefSvc.set("shield.fakedie",true)
}
setupEnv()


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

/* Tests Begin Here */

exports['test Module has right keys and types'] = function (assert) {
  let expected = [
    ["chooseVariation", "function"],
    ["die", "function"],
    ["expired", "function"],
    ["generateTelemetryIdIfNeeded", "function"],
    ["handleOnUnload", "function"],
    ["handleStartup", "function"],
    ["report", "function"],
    ["resetPrefs", "function"],
    ["studyManager", "object"],
    ["survey", "function"],
    ["target", "function"],
    ["xsetup", "function"]
  ];
  let keys = expected.map((x)=>x[0]);
  expect(xutils).to.have.all.keys(keys);
  expected.forEach((e) => expect(xutils[e[0]]).to.be.a(e[1]))
}

exports['test resetPrefs actually resets'] = function (assert) {
  prefs['firstrun'] = String(Date.now());
  prefs['variation'] = "whatever";
  ['firstrun', 'variation'].map((p) => expect(prefs[p]).to.not.be.undefined);
  xutils.resetPrefs();
  ['firstrun', 'variation'].map((p) => expect(prefs[p]).to.be.undefined);
}

exports['test xsetup'] = function (assert) {
  //return {
  //  variation: variation,
  //  firstrun: prefs.firstrun,
  //  name: xSetupConfig.name,
  //  surveyUrl: xSetupConfig.surveyUrl,
  //  duration: xSetupConfig.duration
  //}

  function checkXconfig(xconfig) {
    let keys = ['variation', 'firstrun', 'name', 'surveyUrl', 'duration', 'who'];
    expect(xconfig).to.have.keys(keys);

    expect(Number(prefs.firstrun)).to.be.an("number");
    expect(prefs.firstrun).to.equal(xconfig.firstrun);

    expect(prefs.variation).to.equal(xconfig.variation);
    ['name', 'surveyUrl', 'duration'].map(
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


// function handleStartup (options, xconfig, variationsMod) {
function variationRan () {
  expect(prefSvc.get(FAKEPREF)).to.be.true;
}

//exports['test handleStartup:install'] = function (assert) {
//  // test all the cases
//  variationsMod.cleanup();
//  let options = {loadReason: 'install'};
//  let xconfig = xutils.xsetup(forSetup);
//
//  // not checking eligible.
//  // not checking telemetry
//  expect(variationsMod.isEligible()).to.be.true;
//  variationsMod.cleanup();
//  xutils.handleStartup(options, xconfig, variationsMod);
//  // the variation ran
//  variationRan();
//}
//
//exports['test handleStartup:startup'] = function (assert) {
//  // test all the cases
//  let options = {loadReason: 'startup'};
//  let xconfig = xutils.xsetup(forSetup);
//
//  // not checking eligible.
//  // not checking telemetry
//  expect(variationsMod.isEligible()).to.be.true;
//  variationsMod.cleanup();
//  xutils.handleStartup(options, xconfig, variationsMod);
//  // the variation ran
//  variationRan();
//}


function watchStates(statesExpected) {
  return
}

exports["test 1: install while eligible"] = function (assert) {
  xutils.handleStartup({loadReason: "install"})
  assert.equal(xutils.target.flags.ineligibleDie, undefined);
  assert.equal(xutils.target.state, "running"); // passed through installed.

}

exports["test 2: install while ineligible"] = function (assert) {
  xutils.target.isEligible = () =>false; // new change to nope.
  xutils.handleStartup({loadReason: "install"})

  assert.equal(xutils.target.flags.ineligibleDie, true);
  assert.equal(xutils.target.state, "ineligible-die");
},

exports["test 3a: user disables"] = function (assert) {
  xutils.handleStartup({loadReason: "install"})

  xutils.handleOnUnload('disable');

  assert.equal(xutils.target.flags.ineligibleDie, undefined);
  assert.equal(xutils.target.state, "user-uninstall-disable");
}

exports["test 3b: user uninstalls"] = function (assert) {
  xutils.handleStartup({loadReason: "install"})

  xutils.handleOnUnload('uninstall');

  assert.equal(xutils.target.flags.ineligibleDie, undefined);
  assert.equal(xutils.target.state, "user-uninstall-disable");
}

exports["test 4: normal handleOnUnload"] = function (assert) {
  xutils.handleStartup({loadReason: "install"})

  xutils.handleOnUnload('shutdown');

  assert.equal(xutils.target.flags.ineligibleDie, undefined);
  assert.equal(xutils.target.state, "normal-handleOnUnload");
}

before(exports, function (name, assert) {
  xutils.target.reset();
  variationsMod.cleanup();
});

after(exports, function (name, assert) {
  variationsMod.cleanup();
});


require("sdk/test").run(exports);
