#!/usr/bin/env bash

# fail on any error
set -o errexit

# always run from the repository root directory
script_path=`dirname $0`
cd "$script_path/../../"

# bundle the study web extension experiment
mkdir -p test-addon/src/privileged/study
cp webExtensionApis/study/api.js test-addon/src/privileged/study/api.js
cp webExtensionApis/study/schema.json test-addon/src/privileged/study/schema.json

# bundle the prefs web extension experiment
mkdir -p test-addon/src/privileged/prefs
cp webExtensionApis/prefs/api.js test-addon/src/privileged/prefs/api.js
cp webExtensionApis/prefs/schema.json test-addon/src/privileged/prefs/schema.json
