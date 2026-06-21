/**
 * Post-processing after emit.
 * Renames output files to format-specific extensions (`.cjs`/`.mjs`, `.d.cts`/`.d.mts`),
 * rewrites import/require paths, updates `sourceMappingURL` references,
 * fixes source map contents, and optionally updates `package.json`
 * (`exports`, `main`, `module`, `types`, `typesVersions`).
 * @module postprocess
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ResolvedConfig, ModuleFormat } from "./types.js";
import { FORMAT_EXTENSIONS } from "./types.js";

/**
 * Recursively rename all files ending with `oldExtension` to `newExtension`.
 * If no files match, nothing happens.
 *
 * @param {string} dir - Directory to process
 * @param {string} oldExtension - Old extension (e.g. `".js"`)
 * @param {string} newExtension - New extension (e.g. `".mjs"`)
 * @returns {void}
 */
function renameAllFilesWithExtension(
  dir: string,
  oldExtension: string,
  newExtension: string
): void {
  if (!fs.existsSync(dir)) return;
  const directoryEntries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of directoryEntries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      renameAllFilesWithExtension(absolutePath, oldExtension, newExtension);
    } else if (entry.name.endsWith(oldExtension)) {
      const renamedPath = absolutePath.slice(0, -oldExtension.length) + newExtension;
      fs.renameSync(absolutePath, renamedPath);
    }
  }
}

/**
 * Replace references to `.js` with the format-specific extension (`.cjs` or `.mjs`)
 * inside import/export/require statements **and** dynamic import expressions.
 * Only modifies relative paths (starting with `./` or `../`).
 *
 * @param {string} dir - Directory to process recursively
 * @param {string} javascriptExtension - The JavaScript extension to use (e.g. `".mjs"`)
 * @returns {Promise<void>}
 */
async function replaceImportsExtensions(
  dir: string,
  javascriptExtension: string
): Promise<void> {
  if (!fs.existsSync(dir)) return;
  const directoryEntries = fs.readdirSync(dir, { withFileTypes: true });
  const extensionName = javascriptExtension.slice(1); // "mjs" or "cjs"

  /**
   * Replace all occurrences of `.js` with the new extension in the given content.
   * Handles static imports/exports, dynamic imports with assignment, await, and require.
   *
   * @param {string} fileContents - File content
   * @returns {string} Content with extensions replaced
   */
  const replaceJavaScriptExtension = (fileContents: string): string => {
    // Static import/export: `from "./file.js"` or `import "./file.js"`
    fileContents = fileContents.replace(
      /(from\s+["'])(\.[./][^"']*\.)js(["'])/g,
      (_, p1, p2, p3) => `${p1}${p2}${extensionName}${p3}`
    );
    // Dynamic import with assignment: `variable = import("./file.js")`
    fileContents = fileContents.replace(
      /(=\s*import\s*\(\s*["'])(\.[./][^"']*\.)js(["']\s*\))/g,
      (_, p1, p2, p3) => `${p1}${p2}${extensionName}${p3}`
    );
    // Dynamic import with await: `variable = await import("./file.js")`
    fileContents = fileContents.replace(
      /(await\s+import\s*\(\s*["'])(\.[./][^"']*\.)js(["']\s*\))/g,
      (_, p1, p2, p3) => `${p1}${p2}${extensionName}${p3}`
    );
    // require: `require("./file.js")`
    fileContents = fileContents.replace(
      /(require\s*\(\s*["'])(\.[./][^"']*\.)js(["']\s*\))/g,
      (_, p1, p2, p3) => `${p1}${p2}${extensionName}${p3}`
    );
    return fileContents;
  };

  for (const entry of directoryEntries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await replaceImportsExtensions(absolutePath, javascriptExtension);
    } else if (
      entry.name.endsWith(javascriptExtension) ||
      entry.name.endsWith(".d.cts") ||
      entry.name.endsWith(".d.mts")
    ) {
      let fileContents = fs.readFileSync(absolutePath, "utf-8");
      fileContents = replaceJavaScriptExtension(fileContents);
      fs.writeFileSync(absolutePath, fileContents, "utf-8");
    }
  }
}

/**
 * Update the `"file"` property inside source map JSON files
 * so that it matches the new extension.
 *
 * @param {string} dir - Directory to process
 * @param {string} oldExtension - Old extension (e.g. `".js"`)
 * @param {string} newExtension - New extension (e.g. `".mjs"`)
 * @returns {void}
 */
function updateSourceMapFileProperty(
  dir: string,
  oldExtension: string,
  newExtension: string
): void {
  if (!fs.existsSync(dir)) return;
  const directoryEntries = fs.readdirSync(dir, { withFileTypes: true });
  const mapFileExtension = `${newExtension}.map`;

  for (const entry of directoryEntries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      updateSourceMapFileProperty(absolutePath, oldExtension, newExtension);
    } else if (entry.name.endsWith(mapFileExtension)) {
      try {
        const sourceMapJson = JSON.parse(fs.readFileSync(absolutePath, "utf-8"));
        if (typeof sourceMapJson.file === "string" && sourceMapJson.file.endsWith(oldExtension)) {
          sourceMapJson.file = sourceMapJson.file.slice(0, -oldExtension.length) + newExtension;
          fs.writeFileSync(absolutePath, JSON.stringify(sourceMapJson), "utf-8");
        }
      } catch {
        // Not valid JSON, ignore
      }
    }
  }
}

/**
 * Fix `sourceMappingURL` comments in JavaScript and declaration files
 * to point to the renamed map files.
 *
 * @param {string} dir - Directory to process
 * @param {string} javascriptExtension - JavaScript extension (e.g. `".cjs"`)
 * @param {string} declarationExtension - Declaration extension (e.g. `".d.cts"`)
 * @returns {void}
 */
function updateSourceMapReferenceComments(
  dir: string,
  javascriptExtension: string,
  declarationExtension: string
): void {
  if (!fs.existsSync(dir)) return;
  const directoryEntries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of directoryEntries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      updateSourceMapReferenceComments(absolutePath, javascriptExtension, declarationExtension);
    } else if (entry.name.endsWith(javascriptExtension)) {
      let fileContents = fs.readFileSync(absolutePath, "utf-8");
      fileContents = fileContents.replace(
        /# sourceMappingURL=(.*)\.js\.map/g,
        `# sourceMappingURL=$1${javascriptExtension}.map`
      );
      fs.writeFileSync(absolutePath, fileContents, "utf-8");
    } else if (entry.name.endsWith(declarationExtension)) {
      let fileContents = fs.readFileSync(absolutePath, "utf-8");
      fileContents = fileContents.replace(
        /# sourceMappingURL=(.*)\.d\.ts\.map/g,
        `# sourceMappingURL=$1${declarationExtension}.map`
      );
      fs.writeFileSync(absolutePath, fileContents, "utf-8");
    }
  }
}

/**
 * Heuristically determine the main entry file (e.g. `index.cjs`) inside an output directory.
 * Looks for common entry point names, then falls back to any file with the target extension.
 *
 * @param {ResolvedConfig} _config - Resolved tship configuration (unused)
 * @param {ModuleFormat} format - Module format
 * @param {string} outDir - Absolute output directory
 * @returns {string | null} Absolute path to the main entry file, or `null` if none found
 */
function findPrimaryEntryFile(
  _config: ResolvedConfig,
  format: ModuleFormat,
  outDir: string
): string | null {
  const ext = FORMAT_EXTENSIONS[format].js;
  const commonEntryNames = ["index", "main"].map((name) => path.join(outDir, name + ext));
  for (const candidate of commonEntryNames) {
    if (fs.existsSync(candidate)) return candidate;
  }
  const matchingFiles = fs.readdirSync(outDir).filter((f) => f.endsWith(ext));
  if (matchingFiles.length > 0) return path.join(outDir, matchingFiles[0]);
  return null;
}

/**
 * Update the root `package.json` file with conditional exports, `typesVersions`,
 * and classic fields (`main`, `module`, `types`) based on the emitted output.
 *
 * @param {ResolvedConfig} config - Resolved tship configuration
 * @param {ModuleFormat} format - The module format just built
 * @param {string} outDir - Absolute output directory for that format
 * @returns {Promise<void>}
 */
async function updatePackageJsonExports(
  config: ResolvedConfig,
  format: ModuleFormat,
  outDir: string
): Promise<void> {
  const packageJsonPath = path.join(config.projectDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) return;

  const packageJsonData = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const extensions = FORMAT_EXTENSIONS[format];
  const mainEntry = findPrimaryEntryFile(config, format, outDir);
  if (!mainEntry) return;

  // Conditional exports
  packageJsonData.exports = packageJsonData.exports || {};
  packageJsonData.exports["."] = packageJsonData.exports["."] || {};

  const exportCondition = format === "cjs" ? "require" : "import";
  const relativeMainPath = `./${path.relative(config.projectDir, mainEntry).replace(/\\/g, "/")}`;
  packageJsonData.exports["."][exportCondition] = relativeMainPath;

  const declarationFilePath = mainEntry.replace(extensions.js, extensions.dts);
  if (fs.existsSync(declarationFilePath)) {
    packageJsonData.exports["."]["types"] = packageJsonData.exports["."]["types"] || {};
    if (typeof packageJsonData.exports["."]["types"] === "object") {
      packageJsonData.exports["."]["types"][exportCondition] = `./${path.relative(config.projectDir, declarationFilePath).replace(/\\/g, "/")}`;
    }
  }

  // Classic fields
  if (config.tship.autoExports.generate) {
    if (format === "cjs") {
      packageJsonData.main = relativeMainPath;
    } else if (format === "esm") {
      packageJsonData.module = relativeMainPath;
      if (fs.existsSync(declarationFilePath)) {
        packageJsonData.types = `./${path.relative(config.projectDir, declarationFilePath).replace(/\\/g, "/")}`;
      }
    }
  }

  // typesVersions for older TypeScript
  if (config.tship.autoExports.typesVersions) {
    packageJsonData.typesVersions = packageJsonData.typesVersions || {};
    packageJsonData.typesVersions["*"] = packageJsonData.typesVersions["*"] || {};
    const dtsRel = `./${path.relative(config.projectDir, declarationFilePath).replace(/\\/g, "/")}`;
    packageJsonData.typesVersions["*"][extensions.dts.slice(1)] = [dtsRel];
  }

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJsonData, null, 2) + "\n");
}

/**
 * Run all post-processing steps for a single format output directory.
 *
 * @param {ResolvedConfig} config - Resolved tship configuration
 * @param {ModuleFormat} format - The module format being processed
 * @param {string} outDir - Absolute path to the output directory
 * @param {boolean} shouldRename - Whether to rename extensions (`true` when outDir is shared)
 * @returns {Promise<void>}
 */
export async function postProcessFormat(
  config: ResolvedConfig,
  format: ModuleFormat,
  outDir: string,
  shouldRename: boolean
): Promise<void> {
  if (!shouldRename) {
    if (
      config.tship.autoExports.generate ||
      config.tship.autoExports.typesVersions
    ) {
      await updatePackageJsonExports(config, format, outDir);
    }
    return;
  }

  const extensions = FORMAT_EXTENSIONS[format];
  const javascriptExtension = extensions.js;
  const declarationExtension = extensions.dts;

  renameAllFilesWithExtension(outDir, ".js", javascriptExtension);
  renameAllFilesWithExtension(outDir, ".js.map", `${javascriptExtension}.map`);
  renameAllFilesWithExtension(outDir, ".d.ts", declarationExtension);
  renameAllFilesWithExtension(outDir, ".d.ts.map", `${declarationExtension}.map`);

  updateSourceMapFileProperty(outDir, ".js", javascriptExtension);
  updateSourceMapFileProperty(outDir, ".d.ts", declarationExtension);

  await replaceImportsExtensions(outDir, javascriptExtension);

  updateSourceMapReferenceComments(outDir, javascriptExtension, declarationExtension);

  if (
    config.tship.autoExports.generate ||
    config.tship.autoExports.typesVersions
  ) {
    await updatePackageJsonExports(config, format, outDir);
  }
}
