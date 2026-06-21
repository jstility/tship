/**
 * Public API for programmatic usage of tship.
 * Re-exports the main functions, types, and helpers.
 * @module tship
 */

export { resolveConfig } from "./core/config.js";
export { emitAllFormats } from "./core/emitter.js";
export { defineConfig } from "./core/define-config.js";

export type {
  TshipConfig,
  ResolvedConfig,
  ModuleFormat,
  TshipPlugin
} from "./core/types.js";

export { FORMAT_EXTENSIONS } from "./core/types.js";
