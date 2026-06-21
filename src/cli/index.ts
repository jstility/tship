#!/usr/bin/env node
/**
 * CLI entry point.
 * Registers all subcommands and starts the command-line interface.
 * Reads description and version from package.json.
 * @module cli
 */

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCommand } from "./commands/build.js";
import { watchCommand } from "./commands/watch.js";
import { initCommand } from "./commands/init.js";
import { infoCommand } from "./commands/info.js";

// Resolve the path to package.json from the current file
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(currentDirectory, "..", "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

const program = new Command();

program
  .name("tship")
  .description(packageJson.description)
  .version(packageJson.version);

// Register each command
buildCommand(program);
watchCommand(program);
initCommand(program);
infoCommand(program);

// Parse the command line arguments
program.parse(process.argv);
