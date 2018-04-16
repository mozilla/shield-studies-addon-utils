const STUDYCONFIG = {
  // required STUDY key
  study: {
    /** Required for browser.study.configure():
     *
     * - studyName
     * - endings:
     *   - map of endingName: configuration
     * - telemetry
     *   - boolean send
     *   - boolean removeTestingFlag
     *
     * All other keys are optional.
     */

    // required keys: studyName, endings, telemetry

    // will be used activeExperiments tagging
    activeExperimentName: "buttonFeatureExperiment",

    /** **endings**
     * - keys indicate the 'endStudy' even that opens these.
     * - urls should be static (data) or external, because they have to
     *   survive uninstall
     * - If there is no key for an endStudy reason, no url will open.
     * - usually surveys, orientations, explanations
     */
    endings: {
      /** standard endings */
      dataPermissionsRevoked: {
        baseUrl: null,
        study_state: "ended-neutral",
      },
      "user-disable": {
        baseUrl: "http://www.example.com/?reason=user-disable",
      },
      ineligible: {
        baseUrl: "http://www.example.com/?reason=ineligible",
      },
      expired: {
        baseUrl: "http://www.example.com/?reason=expired",
      },

      /** User defined endings */
      "some-study-defined-ending": {
        study_state: "ended-neutral",
        baseUrl: null,
      },
    },
    telemetry: {
      send: true, // assumed false. Actually send pings?
      removeTestingFlag: false, // Marks pings as testing, set true for actual release
    },
  },

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
};

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
        return await browser.study.endStudy(...STUDYCONFIG.endings.ineligible);
      }
      await browser.storage.local.set({ installed: true });
      return browser.study.install();
    }
    // if you got here, startup
    return browser.study.startup();
  }
}

async function startupOnceSendTelemetryThenDie() {
  const instance = new BaseStudy();

  // 1. variation, it all needs the variation
  const userVariation = await browser.study.deterministicVariation(
    STUDYCONFIG.weightedVariations,
  );

  // 2. configure.  Now we can send telemetry, because we have a variation
  await browser.study.configure(variation, ...STUDYCONFIG.study);
  // check that it worked
  const { variation } = await browser.study.info();

  // 3.  eligible for install?  if not, die.
  await instance.startupSequence(userVariation);

  // 4. send a ping and know that it went
  const myPacket = { alive: "yes" };
  await instance.sendTelemetry(myPacket);
  const sentPackets = await browser.study.getTelemetry("shield-study-addon");
  console.log(sentPackets.length);

  // 5. force quit the study
  await browser.study.endStudy(...STUDYCONFIG["some-study-defined-ending"]);
}

startupOnceSendTelemetryThenDie();

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
