"use strict";

/* global ExtensionAPI, Preferences */

ChromeUtils.import("resource://gre/modules/Preferences.jsm");

/* https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/functions.html */
this.prefs = class extends ExtensionAPI {
  getAPI(context) {
    return {
      get: async function get(prefName, defaultValue) {
        return Preferences.get(prefName, defaultValue);
      },
      set: async function set(prefName, prefValue) {
        return Preferences.set(prefName, prefValue);
      },
    };
  }
};
