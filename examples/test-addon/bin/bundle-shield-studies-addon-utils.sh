#!/usr/bin/env bash

# fail on any error
set -o errexit

# always run from the repository root directory
script_path=`dirname $0`
cd "$script_path/../../"

# bundle the shieldUtils web extension experiment
mkdir -p test-addon/src/privileged/shieldUtils
cp webExtensionApis/shieldUtils/api.js test-addon/src/privileged/shieldUtils/api.js
cp webExtensionApis/shieldUtils/schema.json test-addon/src/privileged/shieldUtils/schema.json

# bundle the prefs web extension experiment
mkdir -p test-addon/src/privileged/prefs
cp webExtensionApis/prefs/api.js test-addon/src/privileged/prefs/api.js
cp webExtensionApis/prefs/schema.json test-addon/src/privileged/prefs/schema.json
