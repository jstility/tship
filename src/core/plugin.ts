/**
 * Plugin system helpers.
 * Provides functions to run hooks across all registered plugins.
 * @module plugin
 */

import type { TshipPlugin, PostEmitContext, BuildEndContext } from "./types.js";

/**
 * Execute the `onPostEmit` hook for every plugin that defines it.
 * Plugins are called sequentially in the order they were registered.
 *
 * @param {TshipPlugin[]} plugins - Array of plugins
 * @param {PostEmitContext} ctx - Context for the post-emit phase
 * @returns {Promise<void>}
 */
export async function runPostEmitPlugins(
  plugins: TshipPlugin[],
  ctx: PostEmitContext
): Promise<void> {
  for (const plugin of plugins) {
    if (plugin.onPostEmit) await plugin.onPostEmit(ctx);
  }
}

/**
 * Execute the `onBuildEnd` hook for every plugin that defines it.
 * Plugins are called sequentially in the order they were registered.
 *
 * @param {TshipPlugin[]} plugins - Array of plugins
 * @param {BuildEndContext} ctx - Context for the build-end phase
 * @returns {Promise<void>}
 */
export async function runBuildEndPlugins(
  plugins: TshipPlugin[],
  ctx: BuildEndContext
): Promise<void> {
  for (const plugin of plugins) {
    if (plugin.onBuildEnd) await plugin.onBuildEnd(ctx);
  }
}
