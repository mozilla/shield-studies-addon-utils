const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(
  this,
  "studyUtils",
  "resource://test-addon/StudyUtils.jsm"
);

this.install = function(data, reason) {};

this.startup = async function(data, reason) {};

this.shutdown = function(data, reason) {};

this.uninstall = function(data, reason) {};
