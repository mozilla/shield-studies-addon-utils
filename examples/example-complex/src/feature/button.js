/** important for studies...

  1.  The button has to see the study, so it can send telemtry

*/

const { ActionButton } = require("sdk/ui/button/action");
const telemetry = require("./telemetry");

// ideally this should be made a singleton, but I am lazy
class FeatureButton {
  constructor (branch) {
    this.branch = branch;
    this.initButton(branch);
  }

  initButton (branch) {
    console.log(branch, `./${branch}.png`);
    const that = this;
    this.button = ActionButton({
      id: "feature-button",
      label: `#team-${branch}`,
      icon: `./${branch}.png`,
      onClick: changed,
      badge: 0,
      badgeColor: "#00AAAA"
    });

    function changed(state) {
      that.button.badge = state.badge + 1;
      console.log(state);

      // HERE IS SOME SEMI-MAGIC
      // example-complex-theme-shield-study: {"disabled":false,"label":"#team-kittens","icon":"./kittens.png","badge":1,"badgeColor":"#00AAAA","id":"feature-button"}
      let toSend = {
        evt: "buttonClick",
        clicks: state.badge + 1
      };
      telemetry.send("buttonClick",toSend);
    }
  }
}

exports.FeatureButton = FeatureButton;
