// put the config in the scope so that background can see it.
const STUDYCONFIG = (this.STUDYCONFIG = {
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
});

// This is a study Study template.
class BaseStudy {
  async sendTelemetry(payload) {
    const pingSchema = {
      type: "object",
      // all keys and values must be strings to be valid `shield-study-addon` pings
      additionalProperties: {
        type: "string",
      },
    };
    const validation = browser.study.validateJSON(payload, pingSchema);
    if (!validation.isValid) {
      throw new Error("study packet is invalid", payload, validation.errors);
    }
    // sendTelemetry will also validate.
    return browser.study.sendTelemetry(payload, "shield-study-addon");
  }

  async isEligibleToInstall() {
    const dataPermissions = await browser.study.dataPermissions();
    // could have other reasons to be eligible, such as addons or whatever
    return dataPermissions.shield;
  }

  // TODO gets reasons
  // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/runtime/onInstalled
  async startupSequence() {
    // is first run?
    const installed = await browser.storage.local.get("installed");
    if (!installed) {
      const eligible = await this.isEligibleToInstall();
      if (!eligible) {
        return await browser.study.endStudy("ineligible");
      }
      await browser.storage.local.set({ installed: true });
      return browser.study.install();
    }
    // if you got here, startup
    return browser.study.startup();
  }
}

async function startup() {
  // 1. configure.  Now we can send telemetry, because we have a variation
  await browser.study.setup(STUDYCONFIG);
  // check that it chose a variation
  const { variation } = await browser.study.info();
  console.log(variation);

  // 2.  eligible for install?  if not, die.
  const instance = new BaseStudy();
  await instance.startupSequence();

  // 3. send a ping and know that it went
  const myPacket = { alive: "yes" };
  await instance.sendTelemetry(myPacket);
  const sentPackets = await browser.study.getTelemetry("shield-study-addon");
  console.log(sentPackets.length);

  // 4. force quit the study
  // await browser.study.endStudy("some-study-defined-ending");
}

startup().then(() => browser.runtime.sendMessage({ name: "study:ready" }));

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
