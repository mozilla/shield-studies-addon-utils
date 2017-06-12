var path = require('path');

module.exports = {
  entry: './src/ShieldStudy.in.jsm',
  output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'ShieldStudy.jsm',
      libraryTarget: 'this' // Possible value - amd, commonjs, commonjs2, commonjs-module, this, var
  }
};
