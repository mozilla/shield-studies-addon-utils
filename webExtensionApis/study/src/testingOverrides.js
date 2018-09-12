const { Preferences } = ChromeUtils.import(
  "resource://gre/modules/Preferences.jsm",
  {},
);

export function getTestingOverrides(widgetId) {
  const testingOverrides = {};
  testingOverrides.variationName =
    Preferences.get(`extensions.${widgetId}.test.variationName`) || null;
  testingOverrides.firstRunTimestamp =
    Preferences.get(`extensions.${widgetId}.test.firstRunTimestamp`) || null;
  testingOverrides.expired =
    Preferences.get(`extensions.${widgetId}.test.expired`) || null;
  return testingOverrides;
}

export function listPreferences(widgetId) {
  return [
    `extensions.${widgetId}.test.variationName`,
    `extensions.${widgetId}.test.firstRunTimestamp`,
    `extensions.${widgetId}.test.expired`,
  ];
}
