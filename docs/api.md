# Namespace: `browser.study`

Interface for Shield and Pioneer studies.

## Functions

### `browser.study.setup`

  Attempt an setup/enrollment, with these effects:
  
  - sets 'studyType' as Shield or Pioneer
    - affects telemetry
    - watches for dataPermission changes that should *always*
      stop that kind of study
  
  - Use or choose variation
    - `testing.variation` if present
    - OR deterministicVariation
      for the studyType using `weightedVariations`
  
  - During firstRun[1] only:
    - set firstRunTimestamp pref value
    - send 'enter' ping
    - if `allowEnroll`, send 'install' ping
    - else endStudy("ineligible") and return
  
  - Every Run
    - setActiveExperiment(studySetup)
    - monitor shield | pioneer permission endings
    - suggests alarming if `expire` is set.
  
  Returns:
  - studyInfo object (see `getStudyInfo`)
  
  Telemetry Sent (First run only)
  
    - enter
    - install
  
  Fires Events
  
  (At most one of)
  - study:onReaday  OR
  - study:onEndStudy
  
  Preferences set
  - `shield.${runtime.id}.firstRunTimestamp`
  
  Note:
  1. allowEnroll is ONLY used during first run (install)
  

**Parameters**

- `studySetup`
  - type: studySetup
  - $ref: 
  - optional: false

### `browser.study.endStudy`

  Signal to browser.study that it should end.
  
  Usage scenarios:
  - addons defined
    - postive endings (tried feature)
    - negative endings (client clicked 'no thanks')
    - expiration / timeout (feature should last for 14 days then uninstall)
  
  Logic:
  - If study has already ended, do nothing.
  - Else: END
  
  END:
  - record internally that study is ended.
  - disable all methods that rely on configuration / setup.
  - clear all prefs stored by `browser.study`
  - fire telemetry pings for:
    - 'exit'
    - the ending, one of:
  
      "ineligible",
      "expired",
      "user-disable",
      "ended-positive",
      "ended-neutral",
      "ended-negative",
  
  - augment all ending urls with query urls
  - fire 'study:end' event to `browser.study.onEndStudy` handlers.
  
  Addon should then do
  - open returned urls
  - feature specific cleanup
  - uninstall the addon
  
  Note:
  1.  calling this function multiple time is safe.
  `browser.study` will choose the
  

**Parameters**

- `anEndingAlias`
  - type: anEndingAlias
  - $ref: 
  - optional: false

- `anEndingObject`
  - type: anEndingObject
  - $ref: 
  - optional: true

### `browser.study.getStudyInfo`

  current study configuration, including
  - variation
  - activeExperimentName
  - timeUntilExpire
  - firstRunTimestamp
  
  But not:
  - telemetry clientId
  
  Throws Error if called before `browser.study.setup`
  

**Parameters**

### `browser.study.getDataPermissions`

  object of current dataPermissions with keys shield, pioneer, telemetry, 'ok'

**Parameters**

### `browser.study.sendTelemetry`

  Send Telemetry using appropriate shield or pioneer methods.
  
  shield:
  - `shield-study-addon` ping, requires object string keys and string values
  
  pioneer:
  - TBD
  
  Note:
  - no conversions / coercion of data happens.
  
  Note:
  - undefined what happens if validation fails
  - undefined what happens when you try to send 'shield' from 'pioneer'
  
  TBD fix the parameters here.
  

**Parameters**

- `payload`
  - type: payload
  - $ref: 
  - optional: false

### `browser.study.searchSentTelemetry`

  Search locally stored telemetry pings using these fields (if set)
  
  n:
    if set, no more than `n` pings.
  type:
    Array of 'ping types' (e.g., main, crash, shield-study-addon) to filter
  mininumTimestamp:
    only pings after this timestamp.
  headersOnly:
    boolean.  If true, only the 'headers' will be returned.
  
  Pings will be returned sorted by timestamp with most recent first.
  
  Usage scenarios:
  - enrollment / eligiblity using recent Telemetry behaviours or client environment
  - addon testing scenarios
  

**Parameters**

- `searchTelemetryQuery`
  - type: searchTelemetryQuery
  - $ref: 
  - optional: false

### `browser.study.deterministicVariation`

  Choose a element from `weightedVariations` array
  based on various hashes of clientId
  
  - shield:  TBD
  - pioneer: TBD
  

**Parameters**

- `weightedVariations`
  - type: weightedVariations
  - $ref: 
  - optional: false

- `algorithm`
  - type: algorithm
  - $ref: 
  - optional: false

### `browser.study.surveyUrl`

  Format url with study covariate queryArgs appended / mixed in.
  
  Use this for constructing midpoint surveys.
  

**Parameters**

- `baseUrl`
  - type: baseUrl
  - $ref: 
  - optional: false

- `additionalFields`
  - type: additionalFields
  - $ref: 
  - optional: true

### `browser.study.validateJSON`

  Using AJV, do jsonschema validation of an object.  Can be used to validate your arguments, packets at client.

**Parameters**

- `someJson`
  - type: someJson
  - $ref: 
  - optional: false

- `jsonschema`
  - type: jsonschema
  - $ref: 
  - optional: false

### `browser.study.log`

  

**Parameters**

- `thingToLog`
  - type: thingToLog
  - $ref: 
  - optional: false

## Events

### `browser.study.onDataPermissionsChange`

  Fires whenever any 'dataPermission' changes, with the new dataPermission object.  Allows watching for shield or pioneer revocation.

**Parameters**

- `updatedPermissions`
  - type: updatedPermissions
  - $ref: 
  - optional: false

### `browser.study.onReady`

  Fires when the study is 'ready' for the feature to startup.

**Parameters**

- `studyInfo`
  - type: studyInfo
  - $ref: 
  - optional: false

### `browser.study.onEndStudy`

  Listen for when the study wants to end.
  
  Act on it by
  - opening surveyUrls
  - tearing down your feature
  - uninstalling the addon
  

**Parameters**

- `endingSteps`
  - type: endingSteps
  - $ref: 
  - optional: false

## Data Types

### [0] studyTypesEnum


```json
{
  "id": "studyTypesEnum",
  "type": "string",
  "enum": [
    "shield",
    "pioneer"
  ],
  "testcase": "shield"
}
```


### [1] weightedVariations


```json
{
  "id": "weightedVariations",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string"
      },
      "weight": {
        "type": "number",
        "minimum": 0
      }
    },
    "required": [
      "name",
      "weight"
    ]
  },
  "testcase": [
    {
      "name": "feature-active",
      "weight": 1.5
    }
  ]
}
```


### [2] anEndingObject


```json
{
  "id": "anEndingObject",
  "type": "object",
  "additionalProperties": true,
  "testcase": {
    "baseUrls": [
      "some.url"
    ],
    "endingName": "anEnding",
    "endingClass": "ended-positive"
  }
}
```


### [3] studySetup


```json
{
  "id": "studySetup",
  "type": "object",
  "properties": {
    "activeExperimentName": {
      "type": "string"
    },
    "studyType": {
      "$ref": "studyTypesEnum"
    },
    "expire": {
      "type": "object",
      "properties": {
        "days": {
          "type": "integer"
        }
      }
    },
    "endings": {
      "type": "object",
      "additionalProperties": true
    },
    "weightedVariations": {
      "$ref": "weightedVariations"
    },
    "logLevel": {
      "type": "integer",
      "minimum": 0
    },
    "telemetry": {
      "type": "object",
      "properties": {
        "send": {
          "type": "boolean"
        },
        "removeTestingFlag": {
          "type": "boolean"
        }
      }
    }
  },
  "required": [
    "activeExperimentName",
    "studyType",
    "endings",
    "weightedVariations",
    "logLevel",
    "telemetry"
  ],
  "additionalProperties": true,
  "testcase": {
    "activeExperimentName": "aStudy",
    "studyType": "shield",
    "expire": {
      "days": 10
    },
    "endings": {
      "anEnding": {
        "baseUrl": "some.url"
      }
    },
    "logLevel": 30,
    "weightedVariations": [
      {
        "name": "feature-active",
        "weight": 1.5
      }
    ],
    "telemetry": {
      "send": false,
      "removeTestingFlag": false
    }
  }
}
```


### [4] searchTelemetryQuery


```json
{
  "id": "searchTelemetryQuery",
  "type": "object",
  "properties": {
    "type": {
      "type": [
        "array"
      ],
      "items": {
        "type": "string"
      }
    },
    "n": {
      "type": "integer"
    },
    "mininumTimestamp": {
      "type": "number"
    },
    "headersOnly": {
      "type": "boolean"
    }
  },
  "testcase": {
    "type": [
      "shield-study-addon",
      "shield-study"
    ],
    "n": 100,
    "minimumTimestamp": 1523968204184,
    "headersOnly": false
  }
}
```

