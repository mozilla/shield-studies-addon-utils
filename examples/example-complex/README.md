# Example Shield Study Addon.

[tutorial link](https://github.com/mozilla/shield-studies-addon-utils/blob/master/howToShieldStudy.md)

## Features:

- a few variations
- some overriden functions

## install:

```npm install -g shield-study-cli```

```npm install```

##run:

```
$ shield run . 'kittens' --debug  -- -b Aurora
```

Sample session

```
4949 glind ~/gits/shield-studies-addon-utils/examples/example-complex [git:v3-shield-packet-format?+]$ shield run . 'kittens' --debug  -- -b Aurora
shield [INFO] --prefs:
{}
shield [INFO] setting variation to: kittens
shield [INFO] firstrun: simulate firstrun as NOW
shield [INFO] setting `shield.debug`
shield [INFO] combined prefs: /var/folders/0z/4g3t_26s3gv835xswsslbn400000gq/T/1879eb02-e5bb-4d09-ba0a-5a7cbe81048f.json
{
  "toolkit.telemetry.enabled": "false",
  "browser.selfsuppport.enabled": false,
  "general.warnOnAboutConfig": false,
  "extensions.@example-complex-theme-shield-study.shield.variation": "kittens",
  "shield.debug": true
}
shield [INFO] jpm args:
[ 'node',
  '/Users/glind/gits/shield-study-cli/node_modules/jpm/bin/jpm',
  'run',
  '--addon-dir',
  '.',
  '--prefs',
  '/var/folders/0z/4g3t_26s3gv835xswsslbn400000gq/T/1879eb02-e5bb-4d09-ba0a-5a7cbe81048f.json',
  '-b',
  'Aurora' ]
JPM [info] Starting jpm run on Example Complex Theme Shield Study
JPM [info] Using custom preferences /var/folders/0z/4g3t_26s3gv835xswsslbn400000gq/T/1879eb02-e5bb-4d09-ba0a-5a7cbe81048f.json
JPM [info] Creating a new profile
console.log: example-complex-theme-shield-study: made a Telemetry!
console.log: example-complex-theme-shield-study: {"name":"@example-complex-theme-shield-study","days":14,"surveyUrls":{"end-of-study":"http://example.com/some/url","user-ended-study":"http://example.com/some/url","ineligible":null},"variations":{}}
console.log: example-complex-theme-shield-study: is Sender? ComplexStudy {"config":{"name":"@example-complex-theme-shield-study","variations":{},"surveyUrls":{"end-of-study":"http://example.com/some/url","user-ended-study":"http://example.com/some/url","ineligible":null},"days":14,"firstrun":1492548738000,"variation":"kittens"},"flags":{},"states":[]}
console.log: example-complex-theme-shield-study: state: "maybe-installing". previous:
console.log: example-complex-theme-shield-study: TELEMETRY ["shield-study",{"version":3,"study_name":"@example-complex-theme-shield-study","branch":"kittens","addon_version":"1.0.0","shield_version":"3.0.0","type":"shield-study","data":{"study_state":"enter"}}]
console.log: example-complex-theme-shield-study: state: "installed". previous: maybe-installing
console.log: example-complex-theme-shield-study: TELEMETRY ["shield-study",{"version":3,"study_name":"@example-complex-theme-shield-study","branch":"kittens","addon_version":"1.0.0","shield_version":"3.0.0","type":"shield-study","data":{"study_state":"installed"}}]
console.log: example-complex-theme-shield-study: state: "modifying". previous: maybe-installing,installed
console.log: example-complex-theme-shield-study: TELEMETRY ["shield-study",{"version":3,"study_name":"@example-complex-theme-shield-study","branch":"kittens","addon_version":"1.0.0","shield_version":"3.0.0","type":"shield-study","data":{"study_state":"active"}}]
console.log: example-complex-theme-shield-study: kittens ./kittens.png
console.log: example-complex-theme-shield-study: feature is kittens
console.log: example-complex-theme-shield-study: state: "running". previous: maybe-installing,installed,modifying
console.log: example-complex-theme-shield-study: {"disabled":false,"label":"#team-kittens","icon":"./kittens.png","badge":0,"badgeColor":"#00AAAA","id":"feature-button"}
console.log: example-complex-theme-shield-study: TELEMETRY ["shield-study-addon",{"version":3,"study_name":"@example-complex-theme-shield-study","branch":"kittens","addon_version":"1.0.0","shield_version":"3.0.0","type":"shield-study-addon","data":{"attributes":{"evt":"buttonClick","clicks":"1"}}}]
```


