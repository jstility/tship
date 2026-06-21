/**
 * Wrapper around the TypeScript Compiler API.
 * Creates a `ts.Program` based on resolved configuration and format-specific overrides.
 * @module compiler
 */

import ts from "typescript";
import * as path from "node:path";
import type { CompilerOptions } from "typescript";
import type { ResolvedConfig } from "./types.js";

/**
 * Extract the list of source files from the resolved configuration.
 * Re-parses the tsconfig to respect `include`, `exclude`, and `files` fields.
 *
 * @param {ResolvedConfig} config - The resolved tship configuration
 * @returns {string[]} Array of file paths to be compiled
 */
function resolveSourceFileList(config: ResolvedConfig): string[] {
  const { config: parsedTsconfigJson } = ts.readConfigFile(
    config.tsconfigPath,
    ts.sys.readFile
  );
  if (!parsedTsconfigJson) return [];
  const parsedConfig = ts.parseJsonConfigFileContent(
    parsedTsconfigJson,
    ts.sys,
    path.dirname(config.tsconfigPath)
  );
  return parsedConfig.fileNames ?? [];
}

/**
 * Create a TypeScript Program using the base configuration
 * merged with the given overrides (e.g. different module kind per format).
 *
 * @param {ResolvedConfig} config - The fully resolved tship configuration
 * @param {CompilerOptions} overrides - `CompilerOptions` to apply on top of the base config
 * @returns {ts.Program} A `ts.Program` ready for emit
 * @throws {Error} If no source files are found in the project
 */
export function createProgram(
  config: ResolvedConfig,
  overrides: CompilerOptions
): ts.Program {
  const compilerOptions: CompilerOptions = {
    ...config.compilerOptions,
    ...overrides,
    rootDir: config.rootDir,
    baseUrl: config.compilerOptions.baseUrl ?? config.rootDir
  };

  const compilerHost = ts.createCompilerHost(compilerOptions);
  const fileNames = resolveSourceFileList(config);

  if (fileNames.length === 0) {
    throw new Error(
      "No source files found. Check your tsconfig.json include/exclude settings."
    );
  }

  return ts.createProgram(fileNames, compilerOptions, compilerHost);
}
