"use strict";

/* global  __SCRIPT_URI_SPEC__, Feature, studyUtils, config */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "(startup|shutdown|install|uninstall)" }]*/

async function getTelemetryPings(options) {
  // type is String or Array
  const { n, timestamp, headersOnly } = options;
  let { type } = options;
  Components.utils.import("resource://gre/modules/TelemetryArchive.jsm");
  // {type, id, timestampCreated}
  let pings = await TelemetryArchive.promiseArchivedPingList();
  if (type) {
    if (!(type instanceof Array)) {
      type = [type]; // Array-ify if it's a string
    }
  }
  if (type) pings = pings.filter(p => type.includes(p.type));
  if (timestamp) pings = pings.filter(p => p.timestampCreated > timestamp);

  pings.sort((a, b) => b.timestampCreated - a.timestampCreated);
  if (n) pings = pings.slice(0, n);
  const pingData = headersOnly
    ? pings
    : pings.map(ping => TelemetryArchive.promiseArchivedPingById(ping.id));
  return Promise.all(pingData);
}

async function pingsReport() {
  async function getPings() {
    const ar = ["shield-study", "shield-study-addon"];
    return getTelemetryPings({ type: ar });
  }

  const pings = (await getPings()).reverse();
  if (pings.length === 0) {
    return { report: "No pings found" };
  }
  const p0 = pings[0].payload;
  // print common fields
  const report =
    `
// common fields

branch        ${p0.branch}        // should describe Question text
study_name    ${p0.study_name}
addon_version ${p0.addon_version}
version       ${p0.version}

` +
    pings
      .map(
        (p, i) => `${i} ${p.creationDate} ${p.payload.type}
${JSON.stringify(p.payload.data, null, 2)}

`,
      )
      .join("\n");

  return { report };
  // pings.forEach(p=>{
  //  console.log(p.creationDate, p.payload.type);
  //  console.log(JSON.stringify(p.payload.data,null,2))
  // })
}

async function listenFromWebExtension(msg, sender, sendResponse) {
  // await pingsReport();
  console.log(`got ${msg}`);
  // pingsReport().then(
  //  r=>{
  //    console.log(`sendResponse! ${JSON.stringify({report: r})}`);
  //    sendResponse({report: r})
  // }
  // );

  // NOT FINE.
  // const a = await Promise.resolve({"report": "A report"})
  // sendResponse(a);
  // sendResponse(Promise.resolve({"report": "A report"}));
  sendResponse(Promise.resolve(pingsReport()));
  // sendResponse(pingsReport().then(r=>{"report": r}));
  return false;
}

async function startup(addonData) {
  console.log("starting up debugger");
  const webExtension = addonData.webExtension;
  webExtension.startup().then(api => {
    const { browser } = api;
    // messages intended for shieldn:  {shield:true,msg=[info|endStudy|telemetry],data=data}
    browser.runtime.onMessage.addListener(listenFromWebExtension);
    //  other message handlers from your addon, if any
  });
}
