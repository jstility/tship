/**
 * init command – initializes tship configuration in an existing project.
 * @module cli/commands/init
 */

import type { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import { logSuccess, logInfo, logWarning } from "../utils.js";

// Template content for a new tship.config.ts file.
const CONFIG_TEMPLATE = `import { defineConfig } from '@jstility/tship';

export default defineConfig({
  // Output formats: "cjs", "esm", or both
  formats: ["esm"],
  // Custom output directories (defaults: dist/cjs, dist/esm)
  // outDirs: { cjs: "./dist/cjs", esm: "./dist/esm" },
  // Auto-generate package.json exports
  autoExports: {
    generate: true,
    typesVersions: true
  },
  // Plugins (if any)
  // plugins: []
});
`;

/**
 * Register the `init` command on the given Commander program.
 *
 * @param {Command} program - The Commander program instance
 * @returns {void}
 */
export function initCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize tship configuration in the current project")
    .option(
      "--tsconfig",
      "Add the tship property to tsconfig.json instead of creating a separate file"
    )
    .action(async (options) => {
      const currentWorkingDirectory = process.cwd();

      if (options.tsconfig) {
        const tsconfigPath = path.join(currentWorkingDirectory, "tsconfig.json");
        if (!fs.existsSync(tsconfigPath)) {
          logWarning("No tsconfig.json found. Please create one first.");
          return;
        }
        const tsconfigData = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));
        if (tsconfigData.tship) {
          logInfo("tship configuration already present in tsconfig.json.");
          return;
        }
        tsconfigData.tship = {
          formats: ["esm"],
          outDirs: { cjs: "dist/cjs", esm: "dist/esm" },
          autoExports: { generate: true, typesVersions: true }
        };
        fs.writeFileSync(
          tsconfigPath,
          JSON.stringify(tsconfigData, null, 2) + "\n"
        );
        logSuccess("Added tship configuration to tsconfig.json.");
      } else {
        const configFilePath = path.join(currentWorkingDirectory, "tship.config.ts");
        if (fs.existsSync(configFilePath)) {
          logWarning(
            "tship.config.ts already exists. Remove it first if you want to regenerate."
          );
          return;
        }
        fs.writeFileSync(configFilePath, CONFIG_TEMPLATE, "utf-8");
        logSuccess("Created tship.config.ts.");
      }

      logInfo("Make sure the output directories are listed in .gitignore (e.g., dist/).");
    });
}
