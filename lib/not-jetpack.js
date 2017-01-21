/* eslint-disable */

// SDK: from jetpack
const {Cu} = require('chrome');


/**
 * Merges all the properties of all arguments into first argument. If two or
 * more argument objects have own properties with the same name, the property
 * is overridden, with precedence from right to left, implying, that properties
 * of the object on the left are overridden by a same named property of the
 * object on the right.
 *
 * Any argument given with "falsy" value - commonly `null` and `undefined` in
 * case of objects - are skipped.
 *
 * @examples
 *    var a = { bar: 0, a: 'a' }
 *    var b = merge(a, { foo: 'foo', bar: 1 }, { foo: 'bar', name: 'b' });
 *    b === a   // true
 *    b.a       // 'a'
 *    b.foo     // 'bar'
 *    b.bar     // 1
 *    b.name    // 'b'
 */
function merge(source, ...args) {
  let descriptor = {};
  function getOwnPropertyIdentifiers(object, options = { names: true, symbols: true, nonEnumerables: true }) {
    const symbols = !options.symbols ? [] :
                    Object.getOwnPropertySymbols(object);
    const names = !options.names ? [] :
                  options.nonEnumerables ? Object.getOwnPropertyNames(object) :
                  Object.keys(object);
    return [...names, ...symbols];
  }
  // `Boolean` converts the first parameter to a boolean value. Any object is
  // converted to `true` where `null` and `undefined` becames `false`. Therefore
  // the `filter` method will keep only objects that are defined and not null.
  args.filter(Boolean).forEach(function onEach(properties) {
    getOwnPropertyIdentifiers(properties).forEach(function(name) {
      descriptor[name] = Object.getOwnPropertyDescriptor(properties, name);
    });
  });
  return Object.defineProperties(source, descriptor);
}


/** Uninstall */
const { AddonManager } = Cu.import('resource://gre/modules/AddonManager.jsm');
function uninstall (addonId) {
  // the one in sdk is promise-like
  AddonManager.getAddonBy(addonId, addon => addon.uninstall());
}


const self = require('sdk/self');
// uses get, set, keys
const prefSvc = require('./jetpack/prefSvc');

const prefs = prefSvc.Branch(`extensions.${self.preferencesBranch}.`);

// this is complicated
const { setInterval } = require('sdk/timers');

// complicated
const tabs = require('sdk/tabs');

const { emit } = require('sdk/event/core');

module.exports = {
  merge: merge,
  prefs: prefs,
  prefSvc: prefSvc,
  setInterval: setInterval,
  tabs: tabs,
  emit: emit,
  self: self,
  uninstall: uninstall
};
