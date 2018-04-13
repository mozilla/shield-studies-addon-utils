/*
this.prefs = class extends ExtensionAPI {
  getAPI(context) {
    return {
      prefs: {
        async get(preelemame) {
          return "getting";
        },
        async set(preelemame, value) {
          return "set";
        }
      }
    };
  }
}
*/

const FILEHEADER=
`/* eslint-disable */

ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");

// eslint-disable-next-line no-undef
const { EventManager } = ExtensionCommon;
// eslint-disable-next-line no-undef
const { EventEmitter } = ExtensionUtils;
`

function schema2shim(schemaApiJSON) {

  console.log(FILEHEADER);

  for (var i in schemaApiJSON) {
    let part = schemaApiJSON[i];
    let ns = part.namespace;
    let functionStrings = [];
    let eventStrings = [];
    // functions
    for (var j in part.functions) {
      let elem = part.functions[j];
      let args = (elem.parameters || []).map(x => x.name).join(", ");
      functionStrings.push(`
      /* ${elem.description || "@TODO no description given" } */
      ${["", "async "][Boolean(elem.async)*1]}${elem.name} ( ${args} ) {
        console.log(called, "${elem.name}", ${args});
        return ${JSON.stringify(elem.defaultReturn)};
      }`);
    }
    // events
    for (var j in part.events) {
      let elem = part.events[j];
      let args = (elem.parameters || []).map(x => x.name).join(", ");
      eventStrings.push(`
      // https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/events.html
      /* ${elem.description } */
      ${elem.name}: new EventManager(
        context,
        "${ns}.${elem.name}", fire => {
        const callback = value => {
          fire.async(value);
        };
        // RegisterSomeInternalCallback(callback);
        return () => {
          // UnregisterInternalCallback(callback);
        };
      }).api()
      `)
    }

    // put it all together
    console.log(`
this.${ns} = class extends ExtensionAPI {
  getAPI(context) {
    return {
      ${functionStrings.join("\n")}

      ${eventStrings.join("\n")}
    }
  }
}`);
  }
}
const path = require("path");
schema2shim(require(path.resolve(process.argv[2])));
