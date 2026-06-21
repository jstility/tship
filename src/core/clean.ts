/**
 * Utility to remove output directories before a fresh build.
 * @module clean
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ResolvedConfig } from "./types.js";

/**
 * Remove all output directories specified in the resolved configuration.
 * This ensures a clean state before a new build.
 *
 * @param {ResolvedConfig} config - The resolved tship configuration
 * @returns {void}
 */
export function cleanDirectories(config: ResolvedConfig): void {
  for (const dir of Object.values(config.tship.outDirs)) {
    const absolutePath = path.resolve(config.rootDir, dir);
    if (fs.existsSync(absolutePath)) fs.rmSync(absolutePath, { recursive: true, force: true });
  }
}
