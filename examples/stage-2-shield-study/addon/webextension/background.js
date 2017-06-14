"use strict";

// template code for talking to `studyUtils` using `browser.runtime`
async function msgStudy(msg, data) {
  const allowed = ["endStudy", "telemetry", "info"];
  if (!allowed.includes(msg)) throw new Error(`shieldUtils doesn't know ${msg}, only knows ${allowed}`);
  return await browser.runtime.sendMessage({shield: true, msg, data});
}

class Feature {
  constructor({variation}) {
    console.log("init", variation);
    this.times = 0;
    // do variations specific work.
    // browser.browserAction.setIcon({path: `icons/${variation}.png`});
    browser.browserAction.setTitle({title: variation});
    browser.browserAction.onClicked.addListener(() => this.handleClick());
  }
  handleClick() {
    this.times += 1;
    console.log("got a click", this.times);
    msgStudy("telemetry", {"evt": "click", times: this.times});

    // addon-initiated ending
    if (this.times > 5) {
      msgStudy("endStudy", {reason: "too-popular"});
    }
  }
}

// initialize the feature, using our specific variation
msgStudy("info").then(({variation}) => new Feature({variation}));

