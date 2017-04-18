'use strict';

/*istanbul ignore next */

// handle cross compartment constructors
function nameOf(thing) {
  if (thing === null) return 'null';
  if (thing === undefined) return 'undefined';

  return thing.constructor.name;
}

function isPojo(thing) {
  return nameOf(thing) === 'Object';
}

function flattenObject(ob) {
  let toReturn = {};
  let flatObject;
  if (!isPojo(ob)) return ob;  // atoms, arrays
  for (let i in ob) {
    /* istanbul ignore next */
    if (!ob.hasOwnProperty(i)) continue;
    if (!isPojo(ob[i])) {
      toReturn[i] = ob[i];
    } else {
      flatObject = flattenObject(ob[i]);
      for (let x in flatObject) {
        /* istanbul ignore next */
        if (!flatObject.hasOwnProperty(x)) continue;
        /* istanbul ignore next */
        toReturn[i + (isNaN(x) ? '.' + x : '')] = flatObject[x];
      }
    }
  }
  return toReturn;
}

function stringStringMap (ob) {
  let out = {};
  for (let i in ob) {
    if (ob[i] === null || ob[i] === undefined) {
      continue;
    }
    switch (nameOf(ob[i])) {
    case 'String':
      out[i] = ob[i];
      break;
    default:
      out[i] = JSON.stringify(ob[i]);
      break;
    }
  }
  return out;
}

exports.flattenObject = flattenObject;
exports.stringStringMap = (ob) => stringStringMap(flattenObject(ob));
