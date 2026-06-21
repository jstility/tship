/**
 * info command – prints the resolved configuration and any diagnostics.
 * @module cli/commands/info
 */

import type { Command } from "commander";
import ts from "typescript";
import { resolveConfig } from "../../core/config.js";
import { logError, logInfo, getErrorMessage } from "../utils.js";

/**
 * Register the `info` command on the given Commander program.
 *
 * @param {Command} program - The Commander program instance
 * @returns {void}
 */
export function infoCommand(program: Command): void {
  program
    .command("info")
    .description("Show resolved configuration and diagnostics")
    .option("-p, --project <path>", "Path to tsconfig.json")
    .action(async (options) => {
      const currentWorkingDirectory = process.cwd();
      try {
        const resolvedConfiguration = await resolveConfig(currentWorkingDirectory, { project: options.project });

        console.log("Resolved Tship Configuration:");
        console.log(
          JSON.stringify(
            {
              tshipMode: resolvedConfiguration.tshipMode,
              rootDir: resolvedConfiguration.rootDir,
              projectDir: resolvedConfiguration.projectDir,
              formats: resolvedConfiguration.tshipMode ? resolvedConfiguration.tship.formats : "tsc (single compile)",
              outDirs: resolvedConfiguration.tshipMode ? resolvedConfiguration.tship.outDirs : resolvedConfiguration.compilerOptions.outDir ?? "dist",
              autoExports: resolvedConfiguration.tshipMode ? resolvedConfiguration.tship.autoExports : "disabled",
              compilerOptions: {
                module: resolvedConfiguration.compilerOptions.module,
                moduleResolution: resolvedConfiguration.compilerOptions.moduleResolution,
                outDir: resolvedConfiguration.compilerOptions.outDir
              }
            },
            null,
            2
          )
        );

        if (resolvedConfiguration.diagnostics.length > 0) {
          console.log("\nDiagnostics:");
          for (const diagnostic of resolvedConfiguration.diagnostics) {
            const category = ts.DiagnosticCategory[diagnostic.category];
            console.log(`  [${category}] ${diagnostic.messageText}`);
          }
        } else {
          logInfo("No configuration problems detected.");
        }
      } catch (error: unknown) {
        logError(getErrorMessage(error));
      }
    });
}
