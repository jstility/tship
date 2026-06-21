/**
 * Unit tests for emitter functions.
 * Tests `emitAllFormats` error paths and fallback behavior.
 * @module tests/unit/emitter
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { emitAllFormats } from '../../src/core/emitter.js';
import type { ResolvedConfig, ModuleFormat } from '../../src/core/types.js';

describe('emitter', () => {
  /**
   * Helper to create a minimal mock config pointing to a temporary directory.
   *
   * @param {Partial<ResolvedConfig>} overrides - Configuration overrides
   * @returns {ResolvedConfig} Mock configuration
   */
  const createMockConfig = (overrides?: Partial<ResolvedConfig>): ResolvedConfig => {
    const tmp = fs.mkdtempSync(path.join(tmpdir(), 'tship-emit-'));
    const outDir = path.join(tmp, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    const base: ResolvedConfig = {
      rootDir: tmp,
      projectDir: tmp,
      tsconfigPath: path.join(tmp, 'tsconfig.json'),
      compilerOptions: {},
      tshipMode: true,
      tship: {
        formats: ['cjs'] as ModuleFormat[],
        outDirs: { cjs: outDir },
        outDir: '',
        autoExports: { generate: false, typesVersions: false },
        plugins: [],
        project: '',
        cjsModule: '',
        cjsModuleResolution: '',
        esmModule: '',
        esmModuleResolution: ''
      },
      diagnostics: []
    };
    return { ...base, ...overrides } as ResolvedConfig;
  };

  // Error cases

  it('throws when output directory is missing for a format', async () => {
    const config = {
      tshipMode: true,
      tship: {
        formats: ['cjs'],
        outDirs: { esm: '' },
        cjsModule: '',
        cjsModuleResolution: '',
        esmModule: '',
        esmModuleResolution: ''
      },
      projectDir: '/tmp',
      rootDir: '/tmp',
      compilerOptions: {}
    } as unknown as ResolvedConfig;
    await expect(emitAllFormats(config)).rejects.toThrow(
      /Output directory not specified/
    );
  });

  it('throws for invalid CJS module', async () => {
    const config = createMockConfig({
      tship: {
        ...createMockConfig().tship,
        formats: ['cjs'] as ModuleFormat[],
        cjsModule: 'ESNext'
      }
    });
    await expect(emitAllFormats(config)).rejects.toThrow(/Invalid CJS module/);
  });

  it('throws for invalid CJS moduleResolution', async () => {
    const config = createMockConfig({
      tship: {
        ...createMockConfig().tship,
        formats: ['cjs'] as ModuleFormat[],
        cjsModuleResolution: 'Bundler'
      }
    });
    await expect(emitAllFormats(config)).rejects.toThrow(/Invalid CJS moduleResolution/);
  });
});
