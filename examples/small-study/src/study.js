// put the config in the scope so that background can see it.
const STUDYCONFIG = this.STUDYCONFIG = {
  // activeExperimentsTag
  activeExperimentName: "demoStudy",
  // uses shield|pioneer pipeline, watches those permissions
  pattern: "shield",
  telemetry: {
    send: true, // assumed false. Actually send pings?
    removeTestingFlag: false, // Marks pings as testing, set true for actual release
  },
  endings: {
    /** standard endings */
    "user-disable": {
      baseUrl: "http://www.example.com/?reason=user-disable",
    },
    ineligible: {
      baseUrl: "http://www.example.com/?reason=ineligible",
    },
    expired: {
      baseUrl: "http://www.example.com/?reason=expired",
    },
    dataPermissionsRevoked: {
      baseUrl: null,
      study_state: "ended-neutral",
    },

    /** User defined endings */
    "some-study-defined-ending": {
      study_state: "ended-neutral",
      baseUrl: null,
    },
  },
  logLevel: 10,
  /* Study branches and sample weights, overweighing feature branches */
  weightedVariations: [
    {
      name: "feature-active",
      weight: 1.5,
    },
    {
      name: "feature-passive",
      weight: 1.5,
    },
    {
      name: "control",
      weight: 1,
    },
  ],
  variation: "feature-active", // optional, overrides
};

// This is a Study template.
class BaseStudy {
  async isEligible() {
    const dataPermissions = await browser.study.dataPermissions();
    // could have other reasons to be eligible, such as addons or whatever
    return dataPermissions.shield;
  }

  async function activate() {
    // 1. configure.  Now we can send telemetry, because we have a variation
    await browser.study.setup(STUDYCONFIG);

    // 2.  If first run, is eligible for install?  if not, die.
    const firstRun = ! await browser.storage.local.get("installed");
    if (firstRun) {
      await browser.storage.local.set({ installed: true });
      const eligible = await this.isEligible();
      if (!eligible) {
        return await browser.study.endStudy("ineligible");
      }
      return browser.study.install();
    }
    // 3. if you got here, startup
    return browser.study.startup();
  }

}


const instance = BaseStudy();
instance.activate().then(() => browser.runtime.sendMessage({ name: "study:ready" }));

/*
// handle uninstall
browser.runtime.onUninstall(work);
browser.runtime.onUninstall(moreWork);
browser.runtime.onUninstall(evenMoreWork);


pretend:  "userUnsetCloudStoragePref"
your.api.watchForUserUnsetCloudStoragePref(()=>{
  browser.study.endStudy('user-unset-pref');
}

browser.ui.listenForMessagages((thePacket)=>{
  which = thePacket.name;
  switch (which) {
    case userUnsetCloudStoragePref:
      browser.study.endStudy('user-unset-pref');
      break;
    case telemetry:
      browser.study.sendTelemetry(thePacket.data);
      break;
  }
}


browser.prefs.get('shield.xname.expireAt',0);
browser.study.expireAt()
*/


