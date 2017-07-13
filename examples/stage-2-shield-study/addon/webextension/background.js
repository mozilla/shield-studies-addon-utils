"use strict";
function telemetry (data) {
  function throwIfInvalid (obj) {
    // simple, check is all keys and values are strings
    for (const k in obj) {
      if (typeof k !== 'string') throw new Error(`key ${k} not a string`);
      if (typeof obj[k] !== 'string') throw new Error(`value ${k} ${obj[k]} not a string`);
    }
    return true
  }
  throwIfInvalid(data);
  msgStudy("telemetry", data);
}

// template code for talking to `studyUtils` using `browser.runtime`
async function msgStudy(msg, data) {
  const allowed = ["endStudy", "telemetry", "info"];
  if (!allowed.includes(msg)) throw new Error(`shieldUtils doesn't know ${msg}, only knows ${allowed}`);
  try {
    const ans = await browser.runtime.sendMessage({shield: true, msg, data});
    return ans;
  } catch (e) {
    console.log("OHNO", e);
  }
}

class Feature {
  constructor({variation}) {
    console.log("init", variation.name);
    this.times = 0;
    // do variations specific work.
    // browser.browserAction.setIcon({path: `icons/${variation}.png`});
    browser.browserAction.setTitle({title: variation.name});
    browser.browserAction.onClicked.addListener(() => this.handleClick());
  }
  handleClick() {
    // note: doesn't persist across a session
    this.times += 1;
    console.log("got a click", this.times);
    browser.browserAction.setBadgeText({text: this.times.toString()});
    if (this.times == 1) {
      telemetry({"evt": "first-click-in-session"});
    }
    telemetry({"evt": "click", times: ""+this.times});

    // addon-initiated ending, 5 times in a session
    if (this.times >= 3) {
      msgStudy("endStudy", {reason: "too-popular"});
    }
  }
}

// initialize the feature, using our specific variation
// this isn't robust to race conditions at all,
// should keep retrying until it gets an answer
msgStudy("info").then(({variation}) => new Feature({variation}));
