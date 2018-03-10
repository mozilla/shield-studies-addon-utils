module.exports = {
  "shield-study": require("shield-study-schemas/schemas-client/shield-study.schema.json"), // eslint-disable-line max-len
  "shield-study-addon": require("shield-study-schemas/schemas-client/shield-study-addon.schema.json"), // eslint-disable-line max-len
  "shield-study-error": require("shield-study-schemas/schemas-client/shield-study-error.schema.json"), // eslint-disable-line max-len
  studySetup: require("./schema.studySetup.json"),
  webExtensionMsg: require("./schema.webExtensionMsg.json"),
  weightedVariations: require("./schema.weightedVariations.json"),
};
