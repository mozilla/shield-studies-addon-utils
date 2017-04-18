/** index.js **/

/** This is the simple-version, initial

const feature = require('./src/feature/index')
console.log(Object.keys(feature.telemetry.telemetry));
feature.which('kittens');

*/

/** this version uses the full study code **/
const self = require("sdk/self");
require("./study").instantiated.startup(self.loadReason);
