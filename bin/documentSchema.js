/* eslint-env node */

// convert wee schema to markdown

/* Nits:
  - assumes it's all in `browser` ns.
  - assume descriptions don't clobber the markdown
*/

const path = require("path");
const proposed = require(path.resolve(process.argv[2]));

function pre(string = "", space = 2) {
  let spacer = [];
  while (space--) {
    spacer.push(" ");
  }
  spacer = spacer.join("");
  return string
    .split("\n")
    .map(x => spacer + x)
    .join("\n");
}

function w(...theArgs) {
  console.log(...theArgs);
  console.log("");
}

function dEvtFn(thing, i, vars) {
  for (const j in thing) {
    const part = thing[j];
    w(`### \`${vars.ns}.${part.name}\``);
    w(`${pre(part.description, 2)}`);

    w(`**Parameters**`);
    for (const k in part.parameters) {
      const param = part.parameters[k];

      w(`- \`${param.name}\`
  - type: ${param.name || ""}
  - $ref: ${param.ref || ""}
  - optional: ${param.optional || "false"}`);
    }
    if (!part.parameters) {
      w("(None)");
    }
  }
}

function documentSchemas(part) {
  for (const i in part) {
    w(`### [${i}] ${part[i].id}`);
    w(`
\`\`\`json
${JSON.stringify(part[i], null, 2)}
\`\`\`
`);
  }
}

function documentNS(part, i) {
  w(`# Namespace: \`browser.${part.namespace}\``);

  w(`${part.description}`);

  const vars = {
    ns: `browser.${part.namespace}`,
  };

  w(`## Functions`);
  if (part.functions) {
    dEvtFn(part.functions, i, vars);
  } else {
    w("(None)");
  }

  w(`## Events`);
  if (part.events) {
    dEvtFn(part.events, i, vars);
  } else {
    w("(None)");
  }

  w(`## Data Types`);
  if (part.types) {
    documentSchemas(part.types);
  } else {
    w("(None)");
  }
}

for (const i in proposed) {
  documentNS(proposed[i], i);
}
