#!/usr/bin/env bash

# fail on any error
set -o errexit

# always run from the repository root directory
script_path=`dirname $0`
cd "$script_path/../../../"

# paths
WEBEXTAPIS_PATH="webExtensionApis"
ADDON_SRC_PATH="examples/small-study/src"

# bundle the study web extension experiment
mkdir -p $ADDON_SRC_PATH/privileged/study
cp -rp $WEBEXTAPIS_PATH/study/* $ADDON_SRC_PATH/privileged/study
