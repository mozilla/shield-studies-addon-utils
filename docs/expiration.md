# Expiration in Studies

## Background:  Expiration is hard to provably get right.

- study expiration is complicated, and hard to get right.
- Expire can race with other endings.

  :: Shield handles this by recording 'first ending' only.

## IMPORTANT engineering linting to make expiration work:

Note: If you don't like how we do it, write and test your own.  It's okay.  Tell us if you do, so we can use yours instead!

- `expires.days` key in `browser.study.setup.
- `alarms` in permissions in `manifest.json`
-  Your `browser.study.onEndStudy` handler BEFORE you call `browser.study.setup`
-  During your `browser.study.onReady` listener, you must setup your own alarms

```js
// alarm on expire.  Start feature
async function handleOnReady (studyInfo) {
    const { delayInMinutes } = studyInfo;
    if (delayInMinutes !== undefined) {
      const alarmName = `${browser.runtime.id}:studyExpiration`;
      const alarmListener = async alarm => {
        if (alarm.name === alarmName) {
          browser.alarms.onAlarm.removeListener(alarmListener);
          await browser.study.endStudy("expired");
        }
      };
      browser.alarms.onAlarm.addListener(alarmListener);
      browser.alarms.create(alarmName, {
        delayInMinutes,
      });
    }

    // start your feature with the correct configuration
    myFeature.startup(studyInfo.variation.name);
}
```

Example:

```js
// listeners first.
browser.study.onEndStudy.addListener(handleStudyEnding);
browser.study.onReady.addListener(handleOnReady);

// call setup, which trigger those listers
await browser.study.setup(studySetup);
```

## About `studyInfo.delayInMinutes`.

### Goals

- Expects to be used by `browser.alarms.create`. Follows invariants for that function.
    - Therefore it must be strictly *> 0*.  
    - Negative values and 0 will *never fire* the alarm.

- Attempts to "get the math right" to figure out how much time *is left* for your study.
- operationalizes `time until expire == (now() - time client first installed) || NEVER ` 


### Mechanics
- It will always have a value > 0.
- for "never expires", it will have an enormous positive value.
- Now Is *always*  `Date.now()`
- per Engineering Notes earlier, it is up to the study to react to the ending, cleanup, and uninstall.


### About `delayInMinutes` (calculation and semantics)

General QA and verification

- remember that these are alarms are usually set *once* at addon startup.  They should not react to changes mid-session.
- `shieldStudies.logLevel = all`, will print a lot about "expires", including what the answers and logic *would be*.
- changing system clocks should work realistically.  If you do that, you wi

Case 1:  **Never expire**:

- Indicate you want this by:
  `"expire": {"days": null}` NOT the `studySetup`.

- `delayInMinutes` returns `Number.MAX_SAFE_INTEGER` as Days.  This is huge value.

Case 2:  Your study expires during this session

Expected:  
- After the "time until expire", the alarm will fire, and the addon will handle it.

Case 3:  Your study expired between Firefox sessions.

Example:  It was a seven day study.  The user enrolled 9 days ago on their work machine.  They then went on vacation, and this is first time using Firefox since.  You expect the study to expire right after startup.

Expected behaviour:  after setup, it will soon fire an 'expired' ending.

- `studySetup` has `expire: {days: 7}`

QA can (current) simulate this by:
1.  install the addon once.
2.  change the pref (mid-session), after `setup()` has been called.
3.  restart firefox. 


### Why is QA challenging?

- Studies are expected to setup *exectly once* per session.
- It's easy to 'fake' expiration.  Those tests do not feel convincing.
- Timestamps are hard.

### Known issues

- WONTFIX: Expiration depends on the System Time on a client machine.  This may affect up to .25% of users, and more in some Geos / locales / hardware profiles. 
- WONTFIX: Prefs are dangerous / weird.  Users who clear preferences between sessions will always appear to be in first run.


### Normandy Revoke vs. Study Expiration**

- Normandy can *revoke* studies.  When it revokes, *all* clients with the addon will uninstall the addon (See #246).  Due to complex reasons, this appears to the study as an uninstall.   This action is meant as a final cleanup of any lingering studies, or to handle bugs in the field.  Think of it as "all addons should now self-destruct NOW".

- Study Expiration is provided by the `shield-studies-addon-utils` library.  All the code lives inside the addon.  All actions are done by the addon.   This action is meant as: "your task is done.  Stop collecting data.  Cleanup, then retire, and disappear into the night."


### TODO,

describe: shieldStudy.expireSeconds pref
