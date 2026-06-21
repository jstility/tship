/**
 * Unit tests for plugin system.
 * Covers `runPostEmitPlugins` and `runBuildEndPlugins`.
 * @module tests/unit/plugin
 */

import { describe, it, expect } from 'vitest';
import { runPostEmitPlugins, runBuildEndPlugins } from '../../src/core/plugin.js';
import type { TshipPlugin } from '../../src/core/types.js';

describe('Plugin system', () => {
  // `onPostEmit` hook

  it('calls `onPostEmit` for each plugin', async () => {
    let wasCalled = false;
    const plugin: TshipPlugin = {
      name: 'test',
      onPostEmit: async () => { wasCalled = true; }
    };
    await runPostEmitPlugins([plugin], {
      format: 'esm',
      outDir: '/tmp',
      files: [],
      rootDir: '/'
    });
    expect(wasCalled).toBe(true);
  });

  it('calls `onPostEmit` plugins in registration order', async () => {
    const order: string[] = [];
    const plugin1: TshipPlugin = {
      name: 'first',
      onPostEmit: async () => { order.push('first'); }
    };
    const plugin2: TshipPlugin = {
      name: 'second',
      onPostEmit: async () => { order.push('second'); }
    };
    await runPostEmitPlugins([plugin1, plugin2], {
      format: 'cjs',
      outDir: '/tmp',
      files: [],
      rootDir: '/'
    });
    expect(order).toEqual(['first', 'second']);
  });

  it('ignores plugins without `onPostEmit` hook', async () => {
    const plugin: TshipPlugin = { name: 'empty' };
    await expect(
      runPostEmitPlugins([plugin], {
        format: 'esm',
        outDir: '/tmp',
        files: [],
        rootDir: '/'
      })
    ).resolves.toBeUndefined();
  });

  it('propagates error from `onPostEmit` hook', async () => {
    const plugin: TshipPlugin = {
      name: 'faulty',
      onPostEmit: async () => { throw new Error('hook failed'); }
    };
    await expect(
      runPostEmitPlugins([plugin], {
        format: 'esm',
        outDir: '/tmp',
        files: [],
        rootDir: '/'
      })
    ).rejects.toThrow('hook failed');
  });

  // `onBuildEnd` hook

  it('calls `onBuildEnd` for each plugin', async () => {
    let wasCalled = false;
    const plugin: TshipPlugin = {
      name: 'test',
      onBuildEnd: async () => { wasCalled = true; }
    };
    await runBuildEndPlugins([plugin], {
      formats: ['cjs', 'esm'],
      outputs: {},
      duration: 0
    });
    expect(wasCalled).toBe(true);
  });

  it('calls `onBuildEnd` plugins in registration order', async () => {
    const order: string[] = [];
    const plugin1: TshipPlugin = {
      name: 'first',
      onBuildEnd: async () => { order.push('first'); }
    };
    const plugin2: TshipPlugin = {
      name: 'second',
      onBuildEnd: async () => { order.push('second'); }
    };
    await runBuildEndPlugins([plugin1, plugin2], {
      formats: ['cjs', 'esm'],
      outputs: {},
      duration: 0
    });
    expect(order).toEqual(['first', 'second']);
  });

  it('ignores plugins without `onBuildEnd` hook', async () => {
    const plugin: TshipPlugin = { name: 'empty' };
    await expect(
      runBuildEndPlugins([plugin], {
        formats: ['cjs', 'esm'],
        outputs: {},
        duration: 0
      })
    ).resolves.toBeUndefined();
  });

  it('propagates error from `onBuildEnd` hook', async () => {
    const plugin: TshipPlugin = {
      name: 'faulty',
      onBuildEnd: async () => { throw new Error('build end failed'); }
    };
    await expect(
      runBuildEndPlugins([plugin], {
        formats: ['cjs', 'esm'],
        outputs: {},
        duration: 0
      })
    ).rejects.toThrow('build end failed');
  });
});
