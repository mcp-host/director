import type { AppRouter } from "@director.run/registry/routers/trpc/index";
import { whiteBold } from "@director.run/utilities/cli/colors";
import { makeTable } from "@director.run/utilities/cli/index";
import type { inferRouterOutputs } from "@trpc/server";
import chalk from "chalk";

type RegistryEntry = inferRouterOutputs<AppRouter>["entries"]["getEntryByName"];
type EntryParameter = RegistryEntry["parameters"][number];

export function printRegistryEntry(entry: RegistryEntry) {
  console.log(`
${whiteBold(entry.name.toUpperCase())}
${entry.description}

${chalk.white.underline("homepage:")} ${makeClickableUrl(entry.homepage)} 
${chalk.white.underline("created:")} ${entry.createdAt?.toLocaleString()}
${chalk.white.underline("official:")} ${entry.isOfficial ? "yes" : "no"}
${chalk.white.underline("readme:")} ${entry.readme ? "yes" : "no"}
${chalk.white.underline("enriched:")} ${entry.isEnriched ? "yes" : "no"}


${whiteBold("TRANSPORT")}
${JSON.stringify(entry.transport, null, 2)}
${printParameters(entry.parameters)}
${printTool(entry)}
`);
}

const printTool = (entry: RegistryEntry) => {
  if (!entry.tools) {
    return "";
  } else {
    const lines = [];
    lines.push("");
    lines.push(whiteBold("TOOLS"));

    entry.tools.forEach((tool) => {
      lines.push("");
      lines.push(whiteBold(tool.name));
      lines.push(tool.description);
      // lines.push(JSON.stringify(tool.inputSchema, null, 2));
    });
    return lines.join("\n");
  }
};

const makeClickableUrl = (url: string) => {
  // OSC 8 hyperlink format: \x1b]8;;URL\x1b\\TEXT\x1b]8;;\x1b\\
  return `\x1b]8;;${url}\x1b\\${url}\x1b]8;;\x1b\\`;
};

export const printReadme = (entry: RegistryEntry) => {
  console.log(entry.readme);
};

function printParameters(parameters: EntryParameter[] | null) {
  if (!parameters || parameters.length === 0) {
    return "";
  }
  const table = makeTable(["Name", "Type", "Required", "Description"]);
  parameters.forEach((parameter) => {
    table.push([
      parameter.name,
      parameter.type,
      parameter.required,
      parameter.description,
    ]);
  });
  return ["", chalk.white.bold("PARAMETERS"), table.toString()].join("\n");
}
