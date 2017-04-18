/** index.js **/
const self = require("sdk/self");
require("./study").study.startup(self.loadReason);

// just for fun
['about:telemetry','about:addons'].map((u)=> require("sdk/tabs").open(u));
