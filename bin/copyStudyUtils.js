#!/usr/bin/env node

const path = require("path");
const fs = require('fs-extra');


const files = [
   //"testUtils",
   "prefs/api.js",
   "prefs/schema.json",
   "study/api.js",
   "study/schema.json"
];

const customHelp = `
  # Additional hints

  ## cleanup
  rm -rf <privilegedDirName>/{study,prefs}
`;

function correctOutputDir(aPath) {
  if (path.isAbsolute(aPath)) return aPath
  return path.join(process.cwd(),aPath);
}

function copyStudyUtilsToWebExtension (privilegedDirname, options) {
  // copy the files, overwriting if necessary
  // NO fancy removal.
  const outputDir = correctOutputDir(privilegedDirname);
  fs.ensureDirSync(privilegedDirname);
  for (fn of files) {
    let fullSrc = path.join(__dirname, '../webExtensionApis');
    fs.copySync(path.join(fullSrc,fn), path.join(outputDir, fn));

  }
  if (options.example) {
    printTemplate(privilegedDirname)
  }
}

function printTemplate(dirname) {
  const template = `
  // Remember to modify the schema and script paths!

  "experiment_apis": {
    "study": {
      "schema": "${dirname}/study/schema.json",
      "parent": {
        "scopes": ["addon_parent"],
        "script": "${dirname}/study/fakeApi.js",
        "paths": [["study"]]
      }
    },
    "prefs": {
      "schema": "${dirname}/prefs/schema.json",
      "parent": {
        "scopes": ["addon_parent"],
        "script": "${dirname}/prefs/fakeApi.js",
        "paths": [["prefs"]]
      }
    }
  },
`;
  console.log(template);
}

var program = require('commander');

program
 .arguments('<privilegedDirname>', 'root directory in you addon for privileged code')
 .option('--example', 'print example `experiment_apis to stdout, to augment your `manifest.json`')
 .action(copyStudyUtilsToWebExtension);
program.on('--help', function(){
  console.log(customHelp);
});
program.parse(process.argv);
