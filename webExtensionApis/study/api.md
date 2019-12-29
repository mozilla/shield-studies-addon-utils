# Namespace: `browser.study`

Interface for Shield and Pioneer studies.

## Functions

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

### `browser.study.fullSurveyUrl( surveyBaseUrl, reason )`

Annotates the supplied survey base url with common survey parameters (study name, variation, updateChannel, fxVersion, add-on version and client id)

**Parameters**

* `surveyBaseUrl`

  * type: surveyBaseUrl
  * $ref:
  * optional: false

* `reason`
  * type: reason
  * $ref:
  * optional: false

## Events

(None)

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

### [5] dataPermissionsObject

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

### [6] telemetryPayload

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

### [7] searchTelemetryQuery

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

### `browser.studyDebug.recordSeenTelemetry( )`

Record seen study telemetry

**Parameters**

### `browser.studyDebug.getSeenTelemetry( )`

Return array of seen telemetry. Fully populated only if recordSeenTelemetry() has been run

**Parameters**

### `browser.studyDebug.resetSeenTelemetry( )`

Empty the array of seen telemetry

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
