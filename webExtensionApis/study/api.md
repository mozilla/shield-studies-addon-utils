# Namespace: `browser.study`

Interface for Shield and Pioneer studies.

## Functions

### `browser.study.setup( studySetup )`

Attempt an setup/enrollment, with these effects:

* sets 'studyType' as Shield or Pioneer

  * affects telemetry
  * (5.2+ TODO) watches for dataPermission changes that should _always_
    stop that kind of study

* Use or choose variation

  * `testing.variation` if present
  * OR (internal) deterministicVariation
    from `weightedVariations`
    based on hash of

    * activeExperimentName
    * clientId

* During firstRun[1] only:

  * set firstRunTimestamp pref value
  * send 'enter' ping
  * if `allowEnroll`, send 'install' ping
  * else endStudy("ineligible") and return

* Every Run
  * setActiveExperiment(studySetup)
  * monitor shield | pioneer permission endings
  * suggests alarming if `expire` is set.

Returns:

* studyInfo object (see `getStudyInfo`)

Telemetry Sent (First run only)

    - enter
    - install

Fires Events

(At most one of)

* study:onReady OR
* study:onEndStudy

Preferences set

* `shield.${runtime.id}.firstRunTimestamp`

Note:

1.  allowEnroll is ONLY used during first run (install)

**Parameters**

* `studySetup`
  * type: studySetup
  * $ref:
  * optional: false

### `browser.study.endStudy( anEndingAlias )`

Signal to browser.study that it should end.

Usage scenarios:

* add-ons defined
  * positive endings (tried feature)
  * negative endings (client clicked 'no thanks')
  * expiration / timeout (feature should last for 14 days then uninstall)

Logic:

* If study has already ended, do nothing.
* Else: END

END:

* record internally that study is ended.
* disable all methods that rely on configuration / setup.
* clear all prefs stored by `browser.study`
* fire telemetry pings for:

  * 'exit'
  * the ending, one of:

    "ineligible",
    "expired",
    "user-disable",
    "ended-positive",
    "ended-neutral",
    "ended-negative",

* augment all ending URLs with query URLs
* fire 'study:end' event to `browser.study.onEndStudy` handlers.

Add-on should then do

* open returned URLs
* feature specific cleanup
* uninstall the add-on

Note:

1.  calling this function multiple time is safe.
    `browser.study` will choose the

**Parameters**

* `anEndingAlias`
  * type: anEndingAlias
  * $ref:
  * optional: false

### `browser.study.getStudyInfo( )`

current study configuration, including

* variation
* activeExperimentName
* delayInMinutes
* firstRunTimestamp
* isFirstRun

But not:

* telemetry clientId

Throws Error if called before `browser.study.setup`

**Parameters**

### `browser.study.getDataPermissions( )`

Object of current dataPermissions (shield enabled true/false, pioneer enabled true/false)

**Parameters**

### `browser.study.sendTelemetry( payload )`

Send Telemetry using appropriate shield or pioneer methods.

Note: The payload must adhere to the `data.attributes` property in the [`shield-study-addon`](https://github.com/mozilla-services/mozilla-pipeline-schemas/blob/dev/templates/include/telemetry/shieldStudyAddonPayload.3.schema.json) schema. That is, it must be a flat object with string keys and string values.

Note:

* no conversions / coercion of data happens.
* undefined what happens if validation fails

TBD fix the parameters here.

**Parameters**

* `payload`
  * type: payload
  * $ref:
  * optional: false

### `browser.study.calculateTelemetryPingSize( payload )`

Calculate Telemetry using appropriate shield or pioneer methods.

shield:

* Calculate the size of a ping

pioneer:

* Calculate the size of a ping that has Pioneer encrypted data

**Parameters**

* `payload`
  * type: payload
  * $ref:
  * optional: false

### `browser.study.searchSentTelemetry( searchTelemetryQuery )`

Search locally stored telemetry pings using these fields (if set)

n:
if set, no more than `n` pings.
type:
Array of 'ping types' (e.g., main, crash, shield-study-addon) to filter
minimumTimestamp:
only pings after this timestamp.
headersOnly:
boolean. If true, only the 'headers' will be returned.

Pings will be returned sorted by timestamp with most recent first.

Usage scenarios:

* enrollment / eligiblity using recent Telemetry behaviours or client environment
* add-on testing scenarios

**Parameters**

* `searchTelemetryQuery`
  * type: searchTelemetryQuery
  * $ref:
  * optional: false

### `browser.study.getTestingOverrides( )`

Returns an object with the following keys:
variationName - to be able to test specific variations
firstRunTimestamp - to be able to test the expiration event
expired - to be able to test the behavior of an already expired study
Used to override study testing flags in getStudySetup().
The values are set by the corresponding preference under the `extensions.${widgetId}.test.*` preference branch.

**Parameters**

### `browser.study.validateJSON( someJson, jsonschema )`

Using AJV, do jsonschema validation of an object. Can be used to validate your arguments, packets at client.

**Parameters**

* `someJson`

  * type: someJson
  * $ref:
  * optional: false

* `jsonschema`
  * type: jsonschema
  * $ref:
  * optional: false

## Events

### `browser.study.onReady ()` Event

Fires when the study is 'ready' for the feature to startup.

**Parameters**

* `studyInfo`
  * type: studyInfo
  * $ref:
  * optional: false

### `browser.study.onEndStudy ()` Event

Listen for when the study wants to end.

Act on it by

* opening surveyUrls
* tearing down your feature
* uninstalling the add-on

**Parameters**

* `ending`
  * type: ending
  * $ref:
  * optional: false

## Properties TBD

## Data Types

### [0] NullableString

```json
{
  "id": "NullableString",
  "$schema": "http://json-schema.org/draft-04/schema",
  "oneOf": [
    {
      "type": "null"
    },
    {
      "type": "string"
    }
  ],
  "choices": [
    {
      "type": "null"
    },
    {
      "type": "string"
    }
  ],
  "testcases": [null, "a string"]
}
```

### [1] NullableBoolean

```json
{
  "id": "NullableBoolean",
  "$schema": "http://json-schema.org/draft-04/schema",
  "oneOf": [
    {
      "type": "null"
    },
    {
      "type": "boolean"
    }
  ],
  "choices": [
    {
      "type": "null"
    },
    {
      "type": "boolean"
    }
  ],
  "testcases": [null, true, false],
  "failcases": ["1234567890", "foo", []]
}
```

### [2] NullableInteger

```json
{
  "id": "NullableInteger",
  "$schema": "http://json-schema.org/draft-04/schema",
  "oneOf": [
    {
      "type": "null"
    },
    {
      "type": "integer"
    }
  ],
  "choices": [
    {
      "type": "null"
    },
    {
      "type": "integer"
    }
  ],
  "testcases": [null, 1234567890],
  "failcases": ["1234567890", []]
}
```

### [3] NullableNumber

```json
{
  "id": "NullableNumber",
  "$schema": "http://json-schema.org/draft-04/schema",
  "oneOf": [
    {
      "type": "null"
    },
    {
      "type": "number"
    }
  ],
  "choices": [
    {
      "type": "null"
    },
    {
      "type": "number"
    }
  ],
  "testcases": [null, 1234567890, 1234567890.123],
  "failcases": ["1234567890", "1234567890.123", []]
}
```

### [4] studyTypesEnum

```json
{
  "id": "studyTypesEnum",
  "$schema": "http://json-schema.org/draft-04/schema",
  "type": "string",
  "enum": ["shield", "pioneer"],
  "testcases": ["shield", "pioneer"],
  "failcases": ["foo"]
}
```

### [5] weightedVariationObject

```json
{
  "id": "weightedVariationObject",
  "$schema": "http://json-schema.org/draft-04/schema",
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
  "required": ["name", "weight"],
  "testcase": {
    "name": "feature-active",
    "weight": 1.5
  }
}
```

### [6] weightedVariationsArray

```json
{
  "id": "weightedVariationsArray",
  "$schema": "http://json-schema.org/draft-04/schema",
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
    "required": ["name", "weight"]
  },
  "testcase": [
    {
      "name": "feature-active",
      "weight": 1.5
    },
    {
      "name": "feature-inactive",
      "weight": 1.5
    }
  ]
}
```

### [7] anEndingRequest

```json
{
  "id": "anEndingRequest",
  "$schema": "http://json-schema.org/draft-04/schema",
  "type": "object",
  "properties": {
    "fullname": {
      "$ref": "NullableString",
      "optional": true
    },
    "category": {
      "oneOf": [
        {
          "type": "null"
        },
        {
          "type": "string",
          "enum": ["ended-positive", "ended-neutral", "ended-negative"]
        }
      ],
      "choices": [
        {
          "type": "null"
        },
        {
          "type": "string",
          "enum": ["ended-positive", "ended-neutral", "ended-negative"]
        }
      ],
      "optional": true
    },
    "baseUrls": {
      "oneOf": [
        {
          "type": "null"
        },
        {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      ],
      "choices": [
        {
          "type": "null"
        },
        {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      ],
      "optional": true,
      "default": []
    },
    "exacturls": {
      "oneOf": [
        {
          "type": "null"
        },
        {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      ],
      "choices": [
        {
          "type": "null"
        },
        {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      ],
      "optional": "true\ndefault: []"
    }
  },
  "additionalProperties": true,
  "testcases": [
    {
      "baseUrls": ["some.url"],
      "fullname": "anEnding",
      "category": "ended-positive"
    },
    {},
    {
      "baseUrls": ["some.url"]
    },
    {
      "baseUrls": [],
      "fullname": null,
      "category": null
    }
  ],
  "failcases": [
    {
      "baseUrls": null,
      "category": "not okay"
    }
  ]
}
```

### [8] onEndStudyResponse

```json
{
  "id": "onEndStudyResponse",
  "$schema": "http://json-schema.org/draft-04/schema",
  "type": "object",
  "properties": {
    "fields": {
      "type": "object",
      "additionalProperties": true
    },
    "urls": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  }
}
```

### [9] studyInfoObject

```json
{
  "id": "studyInfoObject",
  "$schema": "http://json-schema.org/draft-04/schema",
  "type": "object",
  "additionalProperties": true,
  "properties": {
    "variation": {
      "$ref": "weightedVariationObject"
    },
    "firstRunTimestamp": {
      "$ref": "NullableInteger"
    },
    "activeExperimentName": {
      "type": "string"
    },
    "delayInMinutes": {
      "$ref": "NullableNumber"
    },
    "isFirstRun": {
      "type": "boolean"
    }
  },
  "required": [
    "variation",
    "firstRunTimestamp",
    "activeExperimentName",
    "isFirstRun"
  ]
}
```

### [10] dataPermissionsObject

```json
{
  "id": "dataPermissionsObject",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "shield": {
      "type": "boolean"
    },
    "pioneer": {
      "type": "boolean"
    }
  },
  "required": ["shield", "pioneer"]
}
```

### [11] studySetup

```json
{
  "id": "studySetup",
  "$schema": "http://json-schema.org/draft-04/schema",
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
      },
      "optional": true,
      "additionalProperties": false
    },
    "endings": {
      "type": "object",
      "additionalProperties": {
        "$ref": "anEndingRequest"
      }
    },
    "weightedVariations": {
      "$ref": "weightedVariationsArray"
    },
    "telemetry": {
      "type": "object",
      "properties": {
        "send": {
          "type": "boolean"
        },
        "removeTestingFlag": {
          "type": "boolean"
        },
        "internalTelemetryArchive": {
          "optional": true,
          "$ref": "NullableBoolean"
        }
      }
    },
    "testing": {
      "type": "object",
      "properties": {
        "variationName": {
          "$ref": "NullableString",
          "optional": true
        },
        "firstRunTimestamp": {
          "$ref": "NullableInteger",
          "optional": true
        },
        "expired": {
          "choices": [
            {
              "type": "null"
            },
            {
              "type": "boolean"
            }
          ],
          "oneOf": [
            {
              "type": "null"
            },
            {
              "type": "boolean"
            }
          ],
          "optional": true
        }
      },
      "additionalProperties": false,
      "optional": true
    }
  },
  "required": [
    "activeExperimentName",
    "studyType",
    "endings",
    "weightedVariations",
    "telemetry"
  ],
  "additionalProperties": true,
  "testcases": [
    {
      "activeExperimentName": "aStudy",
      "studyType": "shield",
      "expire": {
        "days": 10
      },
      "endings": {
        "anEnding": {
          "baseUrls": ["some.url"]
        }
      },
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
    },
    {
      "activeExperimentName": "aStudy",
      "studyType": "shield",
      "expire": {
        "days": 10
      },
      "endings": {
        "anEnding": {
          "baseUrls": ["some.url"]
        }
      },
      "weightedVariations": [
        {
          "name": "feature-active",
          "weight": 1.5
        }
      ],
      "telemetry": {
        "send": false,
        "removeTestingFlag": false,
        "internalTelemetryArchive": false
      },
      "testing": {
        "variationName": "something",
        "firstRunTimestamp": 1234567890,
        "expired": true
      }
    },
    {
      "activeExperimentName": "aStudy",
      "studyType": "pioneer",
      "endings": {
        "anEnding": {
          "baseUrls": ["some.url"]
        }
      },
      "weightedVariations": [
        {
          "name": "feature-active",
          "weight": 1.5
        }
      ],
      "telemetry": {
        "send": false,
        "removeTestingFlag": true,
        "internalTelemetryArchive": true
      },
      "testing": {
        "variationName": "something",
        "firstRunTimestamp": 1234567890,
        "expired": true
      }
    },
    {
      "activeExperimentName": "shield-utils-test-addon@shield.mozilla.org",
      "studyType": "shield",
      "telemetry": {
        "send": true,
        "removeTestingFlag": false
      },
      "endings": {
        "user-disable": {
          "baseUrls": ["http://www.example.com/?reason=user-disable"]
        },
        "ineligible": {
          "baseUrls": ["http://www.example.com/?reason=ineligible"]
        },
        "expired": {
          "baseUrls": ["http://www.example.com/?reason=expired"]
        },
        "some-study-defined-ending": {
          "category": "ended-neutral"
        },
        "some-study-defined-ending-with-survey-url": {
          "baseUrls": [
            "http://www.example.com/?reason=some-study-defined-ending-with-survey-url"
          ],
          "category": "ended-negative"
        }
      },
      "weightedVariations": [
        {
          "name": "feature-active",
          "weight": 1.5
        },
        {
          "name": "feature-passive",
          "weight": 1.5
        },
        {
          "name": "control",
          "weight": 1
        }
      ],
      "expire": {
        "days": 14
      },
      "testing": {},
      "allowEnroll": true
    }
  ]
}
```

### [12] telemetryPayload

```json
{
  "id": "telemetryPayload",
  "$schema": "http://json-schema.org/draft-04/schema",
  "type": "object",
  "additionalProperties": true,
  "testcase": {
    "foo": "bar"
  }
}
```

### [13] searchTelemetryQuery

```json
{
  "id": "searchTelemetryQuery",
  "$schema": "http://json-schema.org/draft-04/schema",
  "type": "object",
  "properties": {
    "type": {
      "type": ["array"],
      "items": {
        "type": "string"
      },
      "optional": true
    },
    "n": {
      "type": "integer",
      "optional": true
    },
    "minimumTimestamp": {
      "type": "number",
      "optional": true
    },
    "headersOnly": {
      "type": "boolean",
      "optional": true
    }
  },
  "additionalProperties": false,
  "testcase": {
    "type": ["shield-study-addon", "shield-study"],
    "n": 100,
    "minimumTimestamp": 1523968204184,
    "headersOnly": false
  }
}
```

### [14] anEndingAnswer

```json
{
  "id": "anEndingAnswer",
  "$schema": "http://json-schema.org/draft-04/schema",
  "type": "object",
  "additionalProperties": true
}
```

# Namespace: `browser.study.logger`

For study developers to be able to log messages which are hidden by default but can
be displayed via a preference (not currently possible with avoid console.{info,log,debug,warn,error}).
Log messages will be prefixed with the add-on's widget id and the log level is controlled by the
`shieldStudy.logLevel` preference.
Note that since there is no way to handle an arbitrarily variable number of arguments in the schema,
all values to log needs to be sent as a single variable.
Usage example: await browser.study.logger.log("foo");
Usage example (multiple things to log): await browser.study.logger.log(["foo", bar]);

## Functions

### `browser.study.logger.info( values )`

Corresponds to console.info

**Parameters**

* `values`
  * type: values
  * $ref:
  * optional: false

### `browser.study.logger.log( values )`

Corresponds to console.log

**Parameters**

* `values`
  * type: values
  * $ref:
  * optional: false

### `browser.study.logger.debug( values )`

Corresponds to console.debug

**Parameters**

* `values`
  * type: values
  * $ref:
  * optional: false

### `browser.study.logger.warn( values )`

Corresponds to console.warn

**Parameters**

* `values`
  * type: values
  * $ref:
  * optional: false

### `browser.study.logger.error( values )`

Corresponds to console.error

**Parameters**

* `values`
  * type: values
  * $ref:
  * optional: false

## Events

(None)

## Properties TBD

## Data Types

(None)

# Namespace: `browser.studyDebug`

Interface for Test Utilities

## Functions

### `browser.studyDebug.throwAnException( message )`

Throws an exception from a privileged function - for making sure that we can catch these in our web extension

**Parameters**

* `message`
  * type: message
  * $ref:
  * optional: false

### `browser.studyDebug.throwAnExceptionAsync( message )`

Throws an exception from a privileged async function - for making sure that we can catch these in our web extension

**Parameters**

* `message`
  * type: message
  * $ref:
  * optional: false

### `browser.studyDebug.firstSeen( )`

**Parameters**

### `browser.studyDebug.setActive( )`

**Parameters**

### `browser.studyDebug.startup( details )`

**Parameters**

* `details`
  * type: details
  * $ref:
  * optional: false

### `browser.studyDebug.setFirstRunTimestamp( timestamp )`

Set the pref for firstRunTimestamp, to simulate:

* 2nd run
* other useful tests around expiration and states.

**Parameters**

* `timestamp`
  * type: timestamp
  * $ref:
  * optional: false

### `browser.studyDebug.reset( )`

Reset the studyUtils \_internals, for debugging purposes.

**Parameters**

### `browser.studyDebug.getInternals( )`

Return `_internals` of the studyUtils object.

Use this for debugging state.

About `this._internals`:

* variation: (chosen variation, `setup` )
* isEnding: bool `endStudy`
* isSetup: bool `setup`
* isFirstRun: bool `setup`, based on pref
* studySetup: bool `setup` the config
* seenTelemetry: array of seen telemetry. Fully populated only if studySetup.telemetry.internalTelemetryArchive is true
* prefs: object of all created prefs and their names

**Parameters**

### `browser.studyDebug.getInternalTestingOverrides( )`

Returns an object with the following keys:
studyType - to be able to test add-ons with different studyType configurations
Used to override study testing flags in getStudySetup().
The values are set by the corresponding preference under the `extensions.${widgetId}.test.*` preference branch.

**Parameters**

## Events

(None)

## Properties TBD

## Data Types

(None)
