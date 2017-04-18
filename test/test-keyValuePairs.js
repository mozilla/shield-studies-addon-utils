var { expect } = require('chai');

var kvpairs = require('../lib/keyValuePairs');

exports['test all the flatten works'] = function (assert)  {
  let src = {
    a: {
      mixedObject: {
        array: [1,2.3,'d',null,true],
        bool: true,
        string: 'a string',
        object: {
          a: 'nother'
        },
        null: null,
        float: 1.3,
        int: -13,
        undefined: undefined
      }
    }
  };
  let expected = {
    'a.mixedObject.array': '[1,2.3,"d",null,true]',
    'a.mixedObject.bool': 'true',
    'a.mixedObject.string': 'a string',
    'a.mixedObject.object.a': 'nother',
    'a.mixedObject.float': '1.3',
    'a.mixedObject.int': '-13'
  };
  let ans = kvpairs.stringStringMap(src);

  expect(ans).to.deep.equal(expected);
};

exports['test flatten non-objects give non-objects'] = function (assert)  {
  expect(kvpairs.flattenObject(1)).to.deep.equal(1);
  expect(kvpairs.flattenObject([1])).to.deep.equal([1]);
};


require('sdk/test').run(module.exports);

