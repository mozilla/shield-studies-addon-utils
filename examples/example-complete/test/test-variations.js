var { expect } = require("chai");
let prefSvc = require("sdk/preferences/service");

const OURPREF = 'some.experimental.pref';

var variationsMod = require("../src/variations");

exports['test right keys'] = function (assert) {
  let expected = ["isEligible","cleanup","variations"];
  expect(variationsMod).to.have.all.keys(expected);
}

exports['test all variations are functions'] = function (assert) {
  for (let k in variationsMod.variations) {
    expect(variationsMod.variations[k]).to.be.a("function");
  }
}

exports['test cleanup works'] = function (assert) {
  prefSvc.set(OURPREF, 10);
  expect(prefSvc.get(OURPREF)).to.equal(10);
  variationsMod.cleanup();
  expect(prefSvc.get(OURPREF)).to.be.undefined;
}

exports['test isEligible'] = function (assert) {
  // elibible is ONLY the pref is unset or normal value
  variationsMod.cleanup();
  expect(variationsMod.isEligible()).to.be.true;
  prefSvc.set(OURPREF, 10);
  expect(variationsMod.isEligible()).to.be.false;
  variationsMod.cleanup();
}

exports['test variations are functions'] = function (assert) {
  for (let k in variationsMod.variations) {
    expect(variationsMod.variations[k]).to.be.a("function");
  }
}

exports['test there are 2 variations'] = function (assert) {
  expect(Object.keys(variationsMod.variations).length).to.equal(2);
}

require("sdk/test").run(exports);
