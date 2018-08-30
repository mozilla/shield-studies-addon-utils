const { Preferences } = ChromeUtils.import(
  "resource://gre/modules/Preferences.jsm",
  {},
);

export function getTestingOverrides(widgetId) {
  const testingOverrides = {};
  testingOverrides.variationName =
    Preferences.get(`extensions.${widgetId}.test.variationName`) || null;
  const firstRunTimestamp = Preferences.get(
    `extensions.${widgetId}.test.firstRunTimestamp`,
  );
  testingOverrides.firstRunTimestamp = firstRunTimestamp
    ? Number(firstRunTimestamp)
    : null;
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

export function getInternalTestingOverrides(widgetId) {
  const internalTestingOverrides = {};
  internalTestingOverrides.studyType =
    Preferences.get(`extensions.${widgetId}.test.studyType`) || null;
  return internalTestingOverrides;
}
