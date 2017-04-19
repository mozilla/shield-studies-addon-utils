/* global study */



function telemetry (data) {
  console.log("module telemetry:", data);
  study.telemetry(data); // we did window.study in the other file
}

let times = 0;
function handleClick () {
  times += 1;
  console.log('got a click');
  telemetry({"evt": "click", times: times});
}

function init(branch) {
  browser.browserAction.setIcon({path: `icons/${branch}.png`});
  browser.browserAction.setTitle({title: branch});
  browser.browserAction.onClicked.addListener(handleClick);
}

exports.init = init;


