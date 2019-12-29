<!-- START doctoc generated TOC please keep comment here to allow auto update -->

<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

**Contents**

* [Development on the Utils](#development-on-the-utils)
  * [Scripts](#scripts)
  * [Useful testing helpers.](#useful-testing-helpers)
* [Continuous Integration](#continuous-integration)
  * [Install cli to test Circle CI locally](#install-cli-to-test-circle-ci-locally)
  * [Validate Circle CI configuration](#validate-circle-ci-configuration)
  * [Run Circle CI locally (requires Docker)](#run-circle-ci-locally-requires-docker)
* [NPM release routine](#npm-release-routine)
* [Misc](#misc)
  * [Version history (continued from main readme)](#version-history-continued-from-main-readme)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Development on the Utils

## Scripts

* `copyStudyUtils` shell command copying these files in your study add-on.

## Useful testing helpers.

* `KEEPOPEN=1000 npm run test` keeps Firefox open
* `SKIPLINT=1 npm run test` skips linting
* `npm run test-only` skips build steps.

## Troubleshooting error messages during execution of functional tests

Sometimes Selenium just comes back with `JavascriptError: Error: An unexpected error occurred`. In these cases (and others) it may be useful to check the contents of `test/results/logs/geckodriver.log` for hints of what code was last attempted to be executed, then manually attempt to run that same lines of code in the browser console / add-on toolbox console. Unfortunately, web extension experiments are notorious for failing silently or with minimal information about the actual error. Use plenty of try/catch clauses and logging to track down what code is causing an error. Many times it may be incorrect invocations of web extension experiment API methods (or other methods) that may be causing poorly explained error messages.

# Continuous Integration

[Circle CI](https://circleci.com/) is used for continuous integration. Configured via `./.circleci/config.yml`.

Full docs available at https://circleci.com/docs/2.0/local-cli/

## Install cli to test Circle CI locally

```shell
curl -o /usr/local/bin/circleci https://circle-downloads.s3.amazonaws.com/releases/build_agent_wrapper/circleci && chmod +x /usr/local/bin/circleci
```

## Validate Circle CI configuration

```shell
circleci config validate -c .circleci/config.yml
```

## Run Circle CI locally (requires Docker)

To prevent re-use of the local `node_modules` directory (which may contain locally compiled binaries which will cause troubles inside the Docker environment), clone your repository into a clean directory then run CircleCI inside that directory:

```shell
git clone . /tmp/$(basename $PWD)
cd /tmp/$(basename $PWD)
circleci build
```

Note: Steps related to caching and uploading/storing artifacts will report as failed locally. This is not necessarily a problem, they are designed to fail since the operations are not supported locally by the CircleCI build agent.

# NPM release routine

npx publish-please --dry-run
npx publish-please

# Misc

## Version history (continued from main readme)

* v4.1: Improved utils for common cases
* v4: First `.jsm` release for shipping studies as [legacy add-ons](https://developer.mozilla.org/Add-ons/Legacy_add_ons). Used packet format for PACKET version 3. (Jetpack / addon-sdk is not at all supported since v4 of this utils library)
* v3: Attempt to formalize on `shield-study` PACKET version 3. Jetpack based. Prototype used for `raymak/page-reload`. All work abandoned, and no formal npm release in this series. Work done at `v3-shield-packet-format` branch. LAST JETPACK (addon-sdk) RELEASE.
* v2: Code refactor to es6 `class` with event models. Added cli tooling. Packet format is still arbitrary and per-study. Jetpack based. Last used in studies in Q2 2017.
* v1: Initial work and thinking. Telemetry packets are rather arbitrary. Jetpack based.
