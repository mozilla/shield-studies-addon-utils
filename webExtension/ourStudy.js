
const shield = require("./shield-v4.js");
const feature = require("./feature/")
const studyConfig = {
  name: self.id,
  days: 14,
  surveyUrls:  {
    'end-of-study': 'http://example.com/some/url',
    'user-ended-study': 'http://example.com/some/url',
    'ineligible':  null
  }
}

class ExampleStudy extends shield.ShieldStudy {
  chooseVariation () {
    return "kittens";
  }
}

// put it up in global, because we are going to webpack
let study = window.study = new ExampleStudy(studyConfig);

function listenForTelemetryFromContent (request, sender, sendResponse) {
  console.log(request, sender, sendResponse);
  if (request.telemetry) {
    study.telemetry(request.data);
  }
}

browser.runtime.onMessage.addListener(listenForTelemetryFromContent);


// this is the first time onlye
if (study.isEligible()) {
  let variation = study.chooseVariation();
  study.start();
  feature.init(variation);
  telemetryOn();
}

// other times we need to do other things



