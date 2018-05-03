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

/** Document events and functions with the same code, to stdout
 *
 * @param {object} thing schema.json part to document.
 * @param {number} i which of the things
 * @param {object} vars varargs
 * @param {string} whichThing choice of 'fn|evt|property'
 *
 * @returns {undefined}
 */
function dEvtFn(thing, i, vars, whichThing) {
  for (const j in thing) {
    const part = thing[j];

    switch (whichThing) {
      case "fn": {
        const pnames = [];
        for (const k of part.parameters) {
          pnames.push(k.name);
        }
        w(`### \`${vars.ns}.${part.name}( ${pnames.join(", ")} )\` `);
        break;
      }
      case "evt": {
        w(`### \`${vars.ns}.${part.name} () \` Event`);
        break;
      }
      case "property": {
        w(`### \`${vars.ns}.${part.name}\``);
      }
    }

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
    dEvtFn(part.functions, i, vars, "fn");
  } else {
    w("(None)");
  }

  w(`## Events`);
  if (part.events) {
    dEvtFn(part.events, i, vars, "evt");
  } else {
    w("(None)");
  }

  w(`## Properties TBD`);

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
