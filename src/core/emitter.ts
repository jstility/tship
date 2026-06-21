/**
 * Multi-format emit logic.
 * For each requested format, creates a TypeScript program, emits files,
 * and runs post-processing. Falls back to single compilation if `tshipMode` is false.
 * @module emitter
 */

import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";
import type { ResolvedConfig } from "./types.js";
import { createProgram } from "./compiler.js";
import { postProcessFormat } from "./postprocess.js";
import { runPostEmitPlugins } from "./plugin.js";

/**
 * Convert a string module kind to `ts.ModuleKind`, or `undefined` if not recognised.
 *
 * @param {string} [kind] - Module kind string (e.g. `"CommonJS"`)
 * @returns {ts.ModuleKind | undefined} The corresponding `ModuleKind` value
 */
function toModuleKind(kind?: string): ts.ModuleKind | undefined {
  if (!kind) return undefined;
  const kindMap: Record<string, ts.ModuleKind> = {
    CommonJS: ts.ModuleKind.CommonJS,
    ESNext: ts.ModuleKind.ESNext,
    NodeNext: ts.ModuleKind.NodeNext,
    ES2022: ts.ModuleKind.ES2022,
    ES2020: ts.ModuleKind.ES2020,
    Node16: ts.ModuleKind.Node16,
    Preserve: ts.ModuleKind.Preserve
  };
  return kindMap[kind];
}

/**
 * Convert a string module resolution to `ts.ModuleResolutionKind`, or `undefined` if not recognised.
 *
 * @param {string} [kind] - Resolution string (e.g. `"NodeNext"`)
 * @returns {ts.ModuleResolutionKind | undefined} The corresponding `ModuleResolutionKind` value
 */
function toModuleResolutionKind(kind?: string): ts.ModuleResolutionKind | undefined {
  if (!kind) return undefined;
  const kindMap: Record<string, ts.ModuleResolutionKind> = {
    Node10: ts.ModuleResolutionKind.Node10,
    Node16: ts.ModuleResolutionKind.Node16,
    NodeNext: ts.ModuleResolutionKind.NodeNext,
    Bundler: ts.ModuleResolutionKind.Bundler,
    Classic: ts.ModuleResolutionKind.Classic
  };
  return kindMap[kind];
}

/**
 * Recursively list all files in a directory.
 *
 * @param {string} dir - The directory to walk
 * @returns {string[]} Array of absolute file paths
 */
function walkDir(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walkDir(full) : [full];
  });
}

/**
 * Emit output for all formats specified in the configuration (`tshipMode`),
 * or fall back to a single TypeScript compilation that respects the original
 * `tsconfig` options (`declaration`, `sourceMap`, etc.).
 *
 * @param {ResolvedConfig} config - The fully resolved tship configuration
 * @returns {Promise<Record<string, string>>} A map of format (or `"tsc"`) to its absolute output directory
 * @throws {Error} If emit fails for a format or if no source files are found
 */
export async function emitAllFormats(
  config: ResolvedConfig
): Promise<Record<string, string>> {
  const outputs: Record<string, string> = {};

  if (config.tshipMode) {
    const outputDirectoryUsageCount = new Map<string, number>();
    for (const format of config.tship.formats) {
      const relativePath = config.tship.outDirs[format];
      if (!relativePath) {
        throw new Error(
          `Output directory not specified for format "${format}".`
        );
      }
      const absoluteOutputPath = path.resolve(config.projectDir, relativePath);
      outputs[format] = absoluteOutputPath;
      outputDirectoryUsageCount.set(absoluteOutputPath, (outputDirectoryUsageCount.get(absoluteOutputPath) ?? 0) + 1);
    }

    for (const format of config.tship.formats) {
      const absoluteOutputPath = outputs[format];
      fs.mkdirSync(absoluteOutputPath, { recursive: true });

      let resolvedModule: ts.ModuleKind;
      let resolvedModuleResolution: ts.ModuleResolutionKind;

      if (format === "cjs") {
        resolvedModule = toModuleKind(config.tship.cjsModule) ?? ts.ModuleKind.CommonJS;
        resolvedModuleResolution =
          toModuleResolutionKind(config.tship.cjsModuleResolution) ??
          ts.ModuleResolutionKind.Node10;

        if (resolvedModule !== ts.ModuleKind.CommonJS) {
          throw new Error(
            `Invalid CJS module "${config.tship.cjsModule}". Only "CommonJS" is allowed.`
          );
        }
        if (resolvedModuleResolution !== ts.ModuleResolutionKind.Node10) {
          throw new Error(
            `Invalid CJS moduleResolution "${config.tship.cjsModuleResolution}". Only "Node10" is allowed.`
          );
        }
      } else {
        resolvedModule = toModuleKind(config.tship.esmModule) ?? ts.ModuleKind.ESNext;
        resolvedModuleResolution =
          toModuleResolutionKind(config.tship.esmModuleResolution) ??
          ts.ModuleResolutionKind.NodeNext;
      }

      const overrides: ts.CompilerOptions = {
        module: resolvedModule,
        moduleResolution: resolvedModuleResolution,
        outDir: absoluteOutputPath,
        declarationDir: absoluteOutputPath
      };

      const program = createProgram(config, overrides);
      const { diagnostics, emitSkipped } = program.emit();

      if (diagnostics.length > 0) {
        const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
          getCurrentDirectory: () => config.projectDir,
          getCanonicalFileName: (f) => f ?? "",
          getNewLine: () => "\n"
        });
        console.error(formatted);
      }

      if (emitSkipped) {
        throw new Error(`Emit failed for format ${format}`);
      }

      const needsExtensionRename = (outputDirectoryUsageCount.get(absoluteOutputPath) ?? 0) > 1;
      await postProcessFormat(config, format, absoluteOutputPath, needsExtensionRename);

      const outputFiles = walkDir(absoluteOutputPath);
      await runPostEmitPlugins(config.tship.plugins, {
        format,
        outDir: absoluteOutputPath,
        files: outputFiles,
        rootDir: config.rootDir
      });
    }

    return outputs;
  }

  // TSC-only fallback
  const outDir = config.compilerOptions.outDir ?? "dist";
  const absoluteFallbackPath = path.resolve(config.projectDir, outDir);
  fs.mkdirSync(absoluteFallbackPath, { recursive: true });

  const program = createProgram(config, { outDir: absoluteFallbackPath });

  const { diagnostics, emitSkipped } = program.emit();
  if (diagnostics.length > 0) {
    const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => config.projectDir,
      getCanonicalFileName: (f) => f ?? "",
      getNewLine: () => "\n"
    });
    console.error(formatted);
  }
  if (emitSkipped) {
    throw new Error("Emit failed");
  }

  outputs["tsc"] = absoluteFallbackPath;
  return outputs;
}
