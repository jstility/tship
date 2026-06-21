/**
 * Helper to define tship configuration with type safety.
 * @module define-config
 */

import type { TshipConfig } from "./types.js";

/**
 * Identity function that returns the given configuration unchanged,
 * but provides IntelliSense and type checking when used in `tship.config.ts`.
 *
 * @example
 * ```ts
 * import { defineConfig } from '@jstility/tship';
 * export default defineConfig({
 *   formats: ['cjs', 'esm'],
 *   autoExports: { generate: true },
 * });
 * ```
 *
 * @param {TshipConfig} config - The user-provided tship configuration
 * @returns {TshipConfig} The same configuration object
 */
export function defineConfig(config: TshipConfig): TshipConfig {
  return config;
}
