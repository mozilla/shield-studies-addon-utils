/* eslint-env node */

const defaultConfig = {
  // Global options:
  sourceDir: "./src/",
  artifactsDir: "./dist/",
  ignoreFiles: [".DS_Store"],
  // Command options:
  build: {
    overwriteDest: true,
  },
  run: {
    firefox: "firefoxdeveloperedition",
    browserConsole: true,
    startUrl: ["about:debugging"],
    pref: ["shieldStudy.logLevel='All'"],
  },
};

module.exports = defaultConfig;
