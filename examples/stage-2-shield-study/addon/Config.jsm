"use strict";

/* to use:

- this file has chrome privileges
- Cu.import will work for any 'general firefox things' (Services,etc)
  but NOT for addon-specific libs
*/

var EXPORTED_SYMBOLS = ["config"];

var slug = "shield-example-addon"; // matches chrome.manifest;

var config = {
  "study": {
    "studyName": "an experiment",
    "variation": "kittens", // optional, use to override/decide
    "weightedVariations": [
      {"name": "control",
        "weight": 1},
      {"name": "kittens",
        "weight": 1},
      {"name": "puppers",
        "weight": 2},
    ],
    /** **endings**
      * - keys indicate the 'endStudy' even that opens these.
      * - urls should be static (data) or external, because they have to
      *   survive uninstall
      * - If there is no key for an endStudy reason, no url will open.
      * - usually surveys, orientations, explanations
      */
    "endings": {
      /** standard endings */
      "ineligible": {
        "url": "http://www.example.com/?reason=ineligible",
      },
      "expired": {
        "url": "http://www.example.com/?reason=expired",
      },
      /** User defined endings */
      "too-popular": {
        // data uri made using `datauri-cli`
        "url": "data:text/html;base64,PGh0bWw+CiAgPGJvZHk+CiAgICA8cD5Zb3UgYXJlIHVzaW5nIHRoaXMgZmVhdHVyZSA8c3Ryb25nPlNPIE1VQ0g8L3N0cm9uZz4gdGhhdCB3ZSBrbm93IHlvdSBsb3ZlIGl0IQogICAgPC9wPgogICAgPHA+VGhlIEV4cGVyaW1lbnQgaXMgb3ZlciBhbmQgd2UgYXJlIFVOSU5TVEFMTElORwogICAgPC9wPgogIDwvYm9keT4KPC9odG1sPgo=",
        "study_state": "ended-positive",  // neutral is default
      },
    },
    "testing": true,  // marks pings as testing,
    "installPath": `lib/shield-study-utils/ShieldStudy.jsm`,
  },
  "isEligible": async function() {
    // get whatever prefs, addons, telemetry, anything!
    return true;
  },
  // addon-specific modules to load/unload during `startup`, `shutdown`
  "modules": [
  ],
  "log": {
    "level": 0,
  },
};
