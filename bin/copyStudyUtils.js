#!/usr/bin/env node

const path = require("path");
const fs = require("fs-extra");

const files = ["study/api.js", "study/schema.json"];

const customHelp = `
  # Additional hints

  ## cleanup
  rm -rf <privilegedDirName>/study
`;

function correctOutputDir(privilegedDirname) {
  if (path.isAbsolute(privilegedDirname)) return privilegedDirname;
  return path.join(process.cwd(), privilegedDirname);
}

function copyStudyUtilsToWebExtension(privilegedDirname, options) {
  // copy the files, overwriting if necessary
  // NO fancy removal.
  const outputDir = correctOutputDir(privilegedDirname);
  fs.ensureDirSync(privilegedDirname);
  for (const fn of files) {
    const fullSrc = path.join(__dirname, "../webExtensionApis");
    fs.copySync(path.join(fullSrc, fn), path.join(outputDir, fn), {
      overwrite: true,
    });
  }
  if (options.example) {
    printTemplate(privilegedDirname);
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
        "script": "${dirname}/study/api.js",
        "paths": [["study"]]
      }
    },
  },
`;
  process.stdout.write(template);
}

const program = require("commander");

program
  .arguments(
    "<privilegedDirname>",
    "root directory in your add-on for privileged code",
  )
  .option(
    "--example",
    "print example `experiment_apis to stdout, to augment your `manifest.json`",
  )
  .action(copyStudyUtilsToWebExtension);
program.on("--help", function() {
  process.stdout.write(customHelp);
});
program.parse(process.argv);
