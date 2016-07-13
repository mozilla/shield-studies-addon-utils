
let myfeature = {
  // some hair thing that mods the ui etc.
  start: function (someConfig) {
    console.log(`running with {someConfig}`);
    console.log(`setting prefs, modding, ui, whatever`);
  }.bind(this)
}


function cleanup() {
  console.log('resetting all the things back to how it should be after uninstall of feature')
}

module.exports = {
  start: start,
  cleanup: cleanup
}
