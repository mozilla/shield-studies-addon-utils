# Engineering Shield Study Add-ons

There are many moving parts in engineering a Shield Study Add-on. This document describes general Shield Study Add-on engineering and is aimed at add-on engineers. (To improve the utils in this repo, see [Development on the Utils](./development-on-the-utils.md) instead).

<!-- START doctoc generated TOC please keep comment here to allow auto update -->

<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

**Contents**

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Help and support

Thinking about building a Shield/Study Add-on? Go to #shield in Slack and discuss first (there may be quicker and cheaper ways to run your experiment without building an add-on). Building one already? Join #shield-engineering in Slack and ask away.

If you haven't checked out [the template](https://github.com/mozilla/shield-studies-addon-template) yet, do it. It contains a lot of best practices that helps study add-ons pass QA quicker.

## Links

* [Shield article on Mozilla Wiki](https://wiki.mozilla.org/Firefox/Shield)
* [Shield Studies article on Mozilla Wiki](https://wiki.mozilla.org/Firefox/Shield/Shield_Studies)
* [WebExtension Experiment documentation](https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/index.html)

## Writing tests for your study add-on

[The template](https://github.com/mozilla/shield-studies-addon-template) includes examples of unit tests and functional tests. After cloning the template, remove the example tests except https://github.com/mozilla/shield-studies-addon-template/blob/develop/test/functional/0-study_utils_integration.js, which is meant to remain in your study-specific add-on since it verifies that the study utils integration is working as expected.

Unit tests currently can ONLY test helper methods in static classes, like Feature in feature.js. The karma tests are run without any access to browser.\* web extension API:s (since we have no way for Karma to run in a privileged WebExtension context at the moment). Thus, make sure to only test static helper methods in unit tests. Other tests needs to be written as functional tests. (There IS a way to write functional tests that act like unit tests, probing the privileged web extension APIs more or less directly, but it is ugly: https://github.com/mozilla/shield-studies-addon-utils/issues/125#issuecomment-379180930)

## FAQ

> Q: Is there any way to install my testing extension before signing it? Because I want to observe the behavior of my extension when people start browser after first shutdown the browser.

A: Not yet, but @glind started some work-in-progress code on https://github.com/mozilla/shield-studies-addon-utils/pull/245 - feel free to expand on it and see if you can get it to work. it would be a valuable contribution for others - see https://github.com/mozilla/shield-studies-addon-utils/issues/143.

> Q: Since every time I receive "ADDON_UNINSTALL" after shutdown browser if I use "$web-ext run" to test my extension. I want to know whether the " browser.study.onEndStudy" would be triggered when user close the browser? or it just triggers the ExtensionAPI::onShutdown()?

A The " browser.study.onEndStudy" should not be triggered when the user closes the browser - only when the extension has expired or the study has ended in some other way. If this is not the case, please report an issue against https://github.com/mozilla/shield-studies-addon-utils.

> Q: I'm planning to send my custom ping back to server, do I need to apply any form or create any kind of scheme for my custom ping?

A: Use custom telemetry events if you have to roll your own pings. The fastest way for study add-ons however is to use `browser.study.sendTelemetry( payload )` to send telemetry (see this example: https://github.com/mozilla/shield-studies-addon-template/blob/develop/src/feature.js#L40-L42 - note that no telemetry is sent from privileged code - instead: use events to signal to the web extension layer to send the telemetry payloads). the telemetry will end up in shield study parquet. the compromise (for not having to submit a custom schema) is that the payload needs to be a flat object with string keys and string values.

## Other hints / guidelines

* Use empty constructors in feature.js. No study-specific code should be instantiated in feature.js constructor methods. Leave constructors empty and instead instantiate feature logic feature.configure(). This way, we can ensure that there are no side-effects of the study add-on unless the study is confirmed to be eligible to run for the client.
* We put all the privileged code in `src/privileged` to make it easy for QA
* The 'Firefox privileged' modules cannot use webExtension API:s (`browserAction`, `management`, etc.). Use a `background.js` script (using messages and events) to co-ordinate multiple privileged modules.
