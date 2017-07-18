var path = require('path');
const webpack = require('webpack'); //to access built-in plugins

module.exports = {
  entry: './src/StudyUtils.in.jsm',
  output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'StudyUtils.jsm',
      libraryTarget: 'this' // Possible value - amd, commonjs, commonjs2, commonjs-module, this, var
  }
};
