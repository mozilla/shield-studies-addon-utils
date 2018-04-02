/* eslint-env node */
const path = require("path");

module.exports = {
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname),
    filename: "api.js",
    libraryTarget: "this", // Possible value - amd, commonjs, commonjs2, commonjs-module, this, var
  },
};
