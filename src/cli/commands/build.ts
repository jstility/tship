/**
 * build command – compiles the project in all configured formats, or falls back to tsc.
 * @module cli/commands/build
 */

import type { Command } from "commander";
import * as path from "node:path";
import { resolveConfig } from "../../core/config.js";
import { emitAllFormats } from "../../core/emitter.js";
import { runBuildEndPlugins } from "../../core/plugin.js";
import { cleanDirectories } from "../../core/clean.js";
import { logSuccess, logError, logInfo, getErrorMessage } from "../utils.js";
import type { ModuleFormat } from "../../core/types.js";

/**
 * Register the `build` command on the given Commander program.
 * Also sets `build` as the default command if no subcommand is given.
 *
 * @param {Command} program - The Commander program instance
 * @returns {void}
 */
export function buildCommand(program: Command): void {
  program
    .command("build")
    .description("Build the project (default if no command is given)")
    .option("-p, --project <path>", "Path to tsconfig.json")
    .option("--formats <formats>", "Comma-separated list of formats: cjs,esm")
    .option("--cjs-out <dir>", "Output directory for CJS")
    .option("--esm-out <dir>", "Output directory for ESM")
    .option("--clean", "Remove output directories before building")
    .action(async (options) => {
      const currentWorkingDirectory = process.cwd();

      const outputDirectoriesOverride: Record<string, string> = {};
      if (options.cjsOut) outputDirectoriesOverride.cjs = options.cjsOut;
      if (options.esmOut) outputDirectoriesOverride.esm = options.esmOut;

      const formats = options.formats
        ? (options.formats as string).split(",").map((format: string) => format.trim() as ModuleFormat)
        : undefined;

      let resolvedConfiguration;
      try {
        resolvedConfiguration = await resolveConfig(currentWorkingDirectory, {
          formats,
          outDirs: Object.keys(outputDirectoriesOverride).length > 0 ? outputDirectoriesOverride : undefined,
          project: options.project
        });
      } catch (error: unknown) {
        logError(getErrorMessage(error));
      }

      if (options.clean) {
        cleanDirectories(resolvedConfiguration!);
      }

      const buildStartTime = Date.now();
      try {
        const outputs = await emitAllFormats(resolvedConfiguration!);
        const buildDuration = Date.now() - buildStartTime;
        logSuccess(`Build completed in ${buildDuration}ms`);
        for (const [format, outputPath] of Object.entries(outputs)) {
          logInfo(`${format === "tsc" ? "TSC" : format.toUpperCase()} → ${path.relative(currentWorkingDirectory, outputPath)}`);
        }

        if (resolvedConfiguration!.tshipMode) {
          await runBuildEndPlugins(resolvedConfiguration!.tship.plugins, {
            formats: resolvedConfiguration!.tship.formats,
            outputs: outputs as Record<ModuleFormat, string>,
            duration: buildDuration
          });
        }
      } catch (error: unknown) {
        logError(`Build failed: ${getErrorMessage(error)}`);
      }
    });

  program.action(() => {
    program.parse(["node", "tship", "build", ...process.argv.slice(2)]);
  });
}
