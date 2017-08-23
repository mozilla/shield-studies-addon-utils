/* shield under web extensions is just a library,
   MEANT to be webpacked/browserified */

//let study = new SubclassedStudy(config);

class ShieldStudy {
  constructor (config) {
    this.config = config;
  }
  isEligible () {
    return true;
  }

  chooseVariation () {
    /* do some rng or deterministic magic */
  }

  stored () {
    /*firstrun
    branchname*/
  }

  isFirstRun () {
    // can check if we have any local storage?
    return true;
  }

  doOnce() {
  }

  cleanup () {
    console.log("cleaing up")
  }

  checkForExpiration () {
    return false
  }

  telemetry (...args) {
    console.log("telemtry sent:", ...args);
  }

  start () {
    console.log('starting up!')
  }

  die (reason) {
    switch (reason) {
    case "ineligible":
    case "uninstall":
      break;
    default:
      break;
    }
  }
  go () {
    // try to do all the things?
    /*
    if this.isFirstRun
        checkEligible OR DIE
        pick and else a branch
      else
        revive a branch

      finally:
        mark the experiment branch
        start the clocks / timers
        return the branch

        and ask the feature to init it. // not our job
    */
  }
}

class PrefStudy extends ShieldStudy {
  constructor (config) {
    // does special thing with the prefs key
  }
  isEligible () {
    /*is the pref set*/
  }
}

/*

if (study.eligible()) {
  study.going().then(()=>
    yourfeature.startup(study.branch)
  )
}

"going" does this:
  spec stuff:
  - 1st startup
    - choose branch once
    - check eligible
  - Every startup
    - re-use branch
    - init the feature
*/

exports.ShieldStudy = ShieldStudy;
exports.PrefStudy = PrefStudy;

