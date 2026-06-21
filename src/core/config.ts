/**
 * Configuration resolution logic.
 * Supports `tship` property in `tsconfig.json` and standalone `tship.config.ts`.
 * Merges CLI overrides, file config, tsconfig, and defaults.
 * If tship configuration is absent or empty, falls back to plain `tsc` behavior.
 * @module config
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import type { TshipConfig, ResolvedConfig, ModuleFormat, AutoExportsOptions } from "./types.js";

const DEFAULT_FORMATS: ModuleFormat[] = ["esm"];

/**
 * Locate `tsconfig.json` in the given directory, walking up to the filesystem root.
 *
 * @param {string} searchDirectory - Directory to start searching from
 * @returns {string | null} Absolute path to `tsconfig.json`, or `null` if not found
 */
function findTsConfig(searchDirectory: string): string | null {
  const tsconfigPath = path.join(searchDirectory, "tsconfig.json");
  if (fs.existsSync(tsconfigPath)) return tsconfigPath;
  const parentDirectory = path.dirname(searchDirectory);
  if (parentDirectory === searchDirectory) return null;
  return findTsConfig(parentDirectory);
}

/**
 * Find a `tship.config` file in the given directory.
 * Supports `.ts`, `.js`, and `.mjs` extensions.
 *
 * @param {string} searchDirectory - Directory to search
 * @returns {string | null} Absolute path to the config file, or `null` if none exists
 */
function findConfigFile(searchDirectory: string): string | null {
  const configFilePatterns = [
    "tship.config.ts",
    "tship.config.js",
    "tship.config.mjs"
  ];
  for (const pattern of configFilePatterns) {
    const configFilePath = path.join(searchDirectory, pattern);
    if (fs.existsSync(configFilePath)) return configFilePath;
  }
  return null;
}

/**
 * Check if a `TshipConfig` object has at least one key that would
 * activate multi-format behavior.
 *
 * @param {TshipConfig} config - The tship configuration to check
 * @returns {boolean} True if the configuration contains at least one meaningful key
 */
function hasActiveTshipSettings(config: TshipConfig): boolean {
  if (!config) return false;
  return (
    config.formats !== undefined ||
    config.outDirs !== undefined ||
    config.outDir !== undefined ||
    config.autoExports !== undefined ||
    (Array.isArray(config.plugins) && config.plugins.length > 0) ||
    config.cjsModule !== undefined ||
    config.cjsModuleResolution !== undefined ||
    config.esmModule !== undefined ||
    config.esmModuleResolution !== undefined
  );
}

/**
 * Merge auto-export options from different sources.
 *
 * @param {boolean | AutoExportsOptions} [cliValue] - Value from CLI
 * @param {boolean | AutoExportsOptions} [fileValue] - Value from `tship.config.ts`
 * @param {boolean | AutoExportsOptions} [tsconfigValue] - Value from `tsconfig.json`
 * @returns {AutoExportsOptions} Resolved options
 */
function mergeAutoExportsOptions(
  cliValue?: boolean | AutoExportsOptions,
  fileValue?: boolean | AutoExportsOptions,
  tsconfigValue?: boolean | AutoExportsOptions
): AutoExportsOptions {
  const sources = [cliValue, fileValue, tsconfigValue];
  for (const source of sources) {
    if (typeof source === "object") {
      return {
        generate: source.generate ?? true,
        typesVersions: source.typesVersions ?? false
      };
    }
    if (typeof source === "boolean") {
      return {
        generate: source,
        typesVersions: false
      };
    }
  }
  return {
    generate: false,
    typesVersions: false
  };
}

/**
 * Resolve the final tship configuration by merging multiple sources.
 *
 * @param {string} cwd - Current working directory (project root)
 * @param {Partial<TshipConfig>} [cliOverrides] - Configuration values coming from CLI options
 * @returns {Promise<ResolvedConfig>} Fully resolved configuration and diagnostics
 * @throws {Error} If no `tsconfig.json` is found in the project directory or its parents
 */
export async function resolveConfig(
  cwd: string,
  cliOverrides?: Partial<TshipConfig>
): Promise<ResolvedConfig> {
  const diagnostics: ts.Diagnostic[] = [];

  const tsconfigPath = findTsConfig(cwd);
  if (!tsconfigPath) {
    throw new Error(
      "No tsconfig.json found. Run 'tship init' to create one."
    );
  }

  const projectDir = path.dirname(tsconfigPath);

  const { config: rawTsconfig, error } = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (error) diagnostics.push(error);

  const parsed = ts.parseJsonConfigFileContent(rawTsconfig ?? {}, ts.sys, projectDir);
  diagnostics.push(...(parsed.errors ?? []));

  const compilerOptions = parsed.options;
  const rootDir = compilerOptions.rootDir ?? parsed.options.rootDirs?.[0] ?? projectDir;

  const tsconfigTship = (rawTsconfig?.tship ?? {}) as TshipConfig;

  let fileConfig: TshipConfig = {};
  const configFile = findConfigFile(cwd);
  if (configFile) {
    try {
      const mod = await import(pathToFileURL(configFile).href);
      fileConfig = mod.default ?? mod;
    } catch (error: unknown) {
      const getErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);
      diagnostics.push({
        file: undefined,
        start: undefined,
        length: undefined,
        messageText: `Failed to load ${configFile}: ${getErrorMessage(error)}`,
        category: ts.DiagnosticCategory.Error,
        code: 0
      });
    }
  }

  const hasCliOverrides = !!cliOverrides && Object.keys(cliOverrides).length > 0;
  const hasFileConfig = Object.keys(fileConfig).length > 0;
  const hasTsconfigTship = hasActiveTshipSettings(tsconfigTship);

  const tshipMode = hasCliOverrides || hasFileConfig || hasTsconfigTship;

  if (!tshipMode) {
    return {
      rootDir,
      projectDir,
      tsconfigPath,
      compilerOptions,
      tshipMode: false,
      tship: {
        formats: [],
        outDirs: {
          cjs: "",
          esm: ""
        },
        outDir: "",
        autoExports: {
          generate: false,
          typesVersions: false
        },
        plugins: [],
        project: tsconfigPath,
        cjsModule: "",
        cjsModuleResolution: "",
        esmModule: "",
        esmModuleResolution: ""
      },
      diagnostics
    };
  }

  // TShip mode, resolve output directories
  const defaultBaseDirectory = compilerOptions.outDir ?? "dist";
  const defaultOutputDirectories: Record<ModuleFormat, string> = {
    cjs: `${defaultBaseDirectory}/cjs`,
    esm: `${defaultBaseDirectory}/esm`
  };

  const cliOutDirs = cliOverrides?.outDirs ?? {};
  const cliOutputDirectories: Record<string, string> = {};
  for (const [key, value] of Object.entries(cliOutDirs)) {
    if (value !== undefined) cliOutputDirectories[key] = value;
  }

  let resolvedOutputDirectories: Record<ModuleFormat, string>;

  const singleOutputDirectory =
    cliOverrides?.outDir ??
    fileConfig.outDir ??
    tsconfigTship.outDir;

  const hasCustomOutputDirectories =
    (tsconfigTship.outDirs && Object.keys(tsconfigTship.outDirs).length > 0) ||
    (fileConfig.outDirs && Object.keys(fileConfig.outDirs).length > 0) ||
    Object.keys(cliOutputDirectories).length > 0;

  if (singleOutputDirectory) {
    resolvedOutputDirectories = { cjs: singleOutputDirectory, esm: singleOutputDirectory };
  } else if (hasCustomOutputDirectories) {
    resolvedOutputDirectories = {
      ...defaultOutputDirectories,
      ...(tsconfigTship.outDirs ?? {}),
      ...(fileConfig.outDirs ?? {}),
      ...cliOutputDirectories
    } as Record<ModuleFormat, string>;
  } else if (compilerOptions.outDir) {
    resolvedOutputDirectories = { cjs: compilerOptions.outDir, esm: compilerOptions.outDir };
  } else {
    resolvedOutputDirectories = { ...defaultOutputDirectories };
  }

  const formats = cliOverrides?.formats ??
    fileConfig.formats ??
    tsconfigTship.formats ??
    [...DEFAULT_FORMATS];

  const autoExports = mergeAutoExportsOptions(
    cliOverrides?.autoExports,
    fileConfig.autoExports,
    tsconfigTship.autoExports
  );

  const plugins = [
    ...(tsconfigTship.plugins ?? []),
    ...(fileConfig.plugins ?? []),
    ...(cliOverrides?.plugins ?? [])
  ];

  const project = cliOverrides?.project ??
    fileConfig.project ??
    tsconfigTship.project ??
    tsconfigPath;

  const cjsModule = cliOverrides?.cjsModule ?? fileConfig.cjsModule ?? tsconfigTship.cjsModule ?? "";
  const cjsModuleResolution = cliOverrides?.cjsModuleResolution ?? fileConfig.cjsModuleResolution ?? tsconfigTship.cjsModuleResolution ?? "";
  const esmModule = cliOverrides?.esmModule ?? fileConfig.esmModule ?? tsconfigTship.esmModule ?? "";
  const esmModuleResolution = cliOverrides?.esmModuleResolution ?? fileConfig.esmModuleResolution ?? tsconfigTship.esmModuleResolution ?? "";

  return {
    rootDir,
    projectDir,
    tsconfigPath,
    compilerOptions,
    tshipMode: true,
    tship: {
      formats,
      outDirs: resolvedOutputDirectories,
      outDir: singleOutputDirectory ?? "",
      autoExports,
      plugins,
      project,
      cjsModule,
      cjsModuleResolution,
      esmModule,
      esmModuleResolution
    },
    diagnostics
  };
}
