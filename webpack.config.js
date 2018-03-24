/* eslint-env node */
const path = require("path");

module.exports = {
  entry: "./src/StudyUtils.in.jsm",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "StudyUtils.jsm",
    libraryTarget: "this", // Possible value - amd, commonjs, commonjs2, commonjs-module, this, var
  },
};
