/**
 * Core type definitions for tship configuration and internal state.
 * @module types
 */

import type { CompilerOptions, Diagnostic } from "typescript";

/**
 * Supported output module formats.
 */
export type ModuleFormat = "cjs" | "esm";

/**
 * Default output file extensions per format.
 * CJS uses `.cjs` / `.d.cts`, ESM uses `.mjs` / `.d.mts`.
 */
export const FORMAT_EXTENSIONS: Record<ModuleFormat, { js: string; dts: string }> = {
  cjs: { js: ".cjs", dts: ".d.cts" },
  esm: { js: ".mjs", dts: ".d.mts" }
};

/**
 * User-facing configuration for tship.
 * Can be placed inside `tsconfig.json` as the `"tship"` property,
 * or exported from a `tship.config.ts` file.
 */
export interface TshipConfig {
  // Output formats to produce (default: `["esm"]`)
  formats?: ModuleFormat[];
  // Custom output directories per format (relative to project root)
  outDirs?: Partial<Record<ModuleFormat, string>>;
  // Single output directory for all formats. If set, `outDirs` is ignored.
  outDir?: string;
  // Automatically generate or update the `"exports"` field in `package.json`
  autoExports?: boolean | AutoExportsOptions;
  // Custom plugins to hook into the build pipeline
  plugins?: TshipPlugin[];
  // Path to the `tsconfig.json` file (used when configuration is in `tship.config.ts`)
  project?: string;
  // Override `module` for CJS builds. Must be `"CommonJS"` or leave `undefined`.
  cjsModule?: string;
  // Override `moduleResolution` for CJS builds. Must be `"Node10"` or leave `undefined`.
  cjsModuleResolution?: string;
  // Override `module` for ESM builds. For example `"ESNext"`, `"NodeNext"`.
  esmModule?: string;
  // Override `moduleResolution` for ESM builds. For example `"NodeNext"`.
  esmModuleResolution?: string;
}

/**
 * Options for automatic `package.json` exports generation.
 */
export interface AutoExportsOptions {
  // Generate conditional exports for each format.
  generate?: boolean;
  // Add a `typesVersions` field for compatibility with older TypeScript versions.
  typesVersions?: boolean;
}

/**
 * Fully resolved configuration after merging all sources (CLI, file, tsconfig).
 */
export interface ResolvedConfig {
  // Root directory for source files (`compilerOptions.rootDir`).
  rootDir: string;
  // Directory containing `tsconfig.json` (project root).
  projectDir: string;
  // Absolute path to the `tsconfig.json` used.
  tsconfigPath: string;
  // Compiler options as parsed by the TypeScript API.
  compilerOptions: CompilerOptions;
  // Whether tship features (multi-format, rename, exports) are active.
  tshipMode: boolean;
  // Complete tship configuration with defaults applied (if `tshipMode` is true).
  tship: Required<TshipConfig> & {
    outDirs: Record<ModuleFormat, string>;
    autoExports: AutoExportsOptions;
  };
  // Diagnostics produced during configuration resolution.
  diagnostics: Diagnostic[];
}

/**
 * Plugin interface. Implement this to hook into the build pipeline.
 */
export interface TshipPlugin {
  // Unique name for the plugin.
  name: string;
  // Called after a single format has been emitted, before post-processing.
  onPostEmit?: (ctx: PostEmitContext) => void | Promise<void>;
  // Called after all formats have been processed successfully.
  onBuildEnd?: (ctx: BuildEndContext) => void | Promise<void>;
}

/**
 * Context provided to the `onPostEmit` hook.
 */
export interface PostEmitContext {
  // The format that was just emitted.
  format: ModuleFormat;
  // Output directory for that format.
  outDir: string;
  // List of all file paths in the output directory (recursive).
  files: string[];
  // Project root directory.
  rootDir: string;
}

/**
 * Context provided to the `onBuildEnd` hook.
 */
export interface BuildEndContext {
  // All formats that were built.
  formats: ModuleFormat[];
  // Mapping from format to its output directory.
  outputs: Record<ModuleFormat, string>;
  // Total build duration in milliseconds.
  duration: number;
}
