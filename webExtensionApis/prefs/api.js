"use strict";

ChromeUtils.import("resource://gre/modules/Services.jsm");

const BASE_PREF = "extensions.original-bootstrap-addon-id.";

function get(key, type = "char") {
  key = BASE_PREF + key;

  switch (type) {
    case "char":
      return Services.prefs.getCharPref(key);
    case "bool":
      return Services.prefs.getBoolPref(key);
    case "int":
      return Services.prefs.getIntPref(key);
  }

  throw new Error(`Unknown type: ${type}`);
}

function set(key, type, value) {
  key = BASE_PREF + key;

  switch (type) {
    case "char":
      return Services.prefs.setCharPref(key, value);
    case "bool":
      return Services.prefs.setBoolPref(key, value);
    case "int":
      return Services.prefs.setIntPref(key, value);
  }
  throw new Error(`Unknown type: ${type}`);
}

/* https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/functions.html */
this.prefs = class extends ExtensionAPI {
  getAPI(context) {
    return {
      prefs: {
        async get(prefName) {
          return "getting";
        },
        async set(prefName, value) {
          return "set";
        }
      }
    };
  }
}
