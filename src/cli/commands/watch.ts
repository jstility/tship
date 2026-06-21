/**
 * watch command – recompiles on file changes using chokidar, or falls back to tsc --watch.
 * @module cli/commands/watch
 */

import type { Command } from "commander";
import * as fs from "node:fs";
import path from "node:path";
import { resolveConfig } from "../../core/config.js";
import { emitAllFormats } from "../../core/emitter.js";
import { logInfo, logError, logSuccess, getErrorMessage } from "../utils.js";

/**
 * Register the `watch` command on the given Commander program.
 *
 * @param {Command} program - The Commander program instance
 * @returns {void}
 */
export function watchCommand(program: Command): void {
  program
    .command("watch")
    .description("Build and watch for changes")
    .option("-p, --project <path>", "Path to tsconfig.json")
    .action(async (options) => {
      const currentWorkingDirectory = process.cwd();
      const resolvedConfiguration = await resolveConfig(currentWorkingDirectory, { project: options.project });

      if (!resolvedConfiguration.tshipMode) {
        logInfo("tship configuration not found. Using tsc --watch...");
        const { spawn } = await import("node:child_process");
        const childProcess = spawn("npx", ["tsc", "--watch", "-p", resolvedConfiguration.tsconfigPath], {
          stdio: "inherit",
          shell: true
        });
        childProcess.on("exit", (code) => process.exit(code ?? 0));
        return;
      }

      logInfo("Starting watch mode...");

      try {
        const outputs = await emitAllFormats(resolvedConfiguration);
        logSuccess("Initial build completed.");
        for (const [format, outputPath] of Object.entries(outputs)) {
          logInfo(`${format.toUpperCase()} → ${path.relative(currentWorkingDirectory, outputPath)}`);
        }
      } catch (error: unknown) {
        logError(`Initial build failed: ${getErrorMessage(error)}`);
      }

      const chokidar = await import("chokidar");

      const watchPaths = [
        resolvedConfiguration.rootDir,
        resolvedConfiguration.tsconfigPath,
        path.join(currentWorkingDirectory, "tship.config.ts"),
        path.join(currentWorkingDirectory, "tship.config.js"),
        path.join(currentWorkingDirectory, "tship.config.mjs")
      ].filter((watchPath) => fs.existsSync(watchPath));

      const fileWatcher = chokidar.watch(watchPaths, {
        ignored: [
          /(^|[/\\])\./,
          /node_modules/,
          /\.tsbuildinfo$/
        ],
        persistent: true,
        ignoreInitial: true
      });

      const rebuild = async () => {
        logInfo("Change detected, rebuilding...");
        try {
          await emitAllFormats(resolvedConfiguration);
          logSuccess("Rebuild completed.");
        } catch (error: unknown) {
          logError(`Rebuild failed: ${getErrorMessage(error)}`);
        }
      };

      fileWatcher.on("add", rebuild);
      fileWatcher.on("change", rebuild);
      fileWatcher.on("unlink", rebuild);

      logInfo("Watching for changes. Press Ctrl+C to stop.");
    });
}
