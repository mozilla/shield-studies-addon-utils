const PLACEHOLDER = `

PLACEHOLDER PING REPORT

A full new report that
has a bunch of pings and stuff

`;

function printReport(text) {
  console.log(`about to replace: ${text}`);
  document.querySelector("#timestamp").textContent = `${new Date()}`;
  document.querySelector("#qa").textContent = text;
}

async function tryReportFromFirefox() {
  console.log(`has browser runtime? ${browser.runtime}`);
  if (browser.runtime) {
    const reply = await browser.runtime.sendMessage("qa-report");
    console.log("got reply!", reply);
    if (reply) {
      printReport(reply.report);
      //console.log("response from legacy add-on: " + reply.content);
    }
  }
}

function startup() {
  printReport(PLACEHOLDER);
  console.log("asking firefox");
  tryReportFromFirefox();
}

/*

page starts up.
- attempt to get text from firefox
- once it arrives, insert it.
*/

document.addEventListener("DOMContentLoaded", startup);
