/**
 * Unit tests for configuration resolution.
 * Covers `resolveConfig` and internal helper functions.
 * @module tests/unit/config
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveConfig } from '../../src/core/config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

describe('resolveConfig', () => {
  let temporaryDirectory: string;

  beforeEach(() => { temporaryDirectory = fs.mkdtempSync(path.join(tmpdir(), 'tship-config-')); });

  afterEach(() => { fs.rmSync(temporaryDirectory, { recursive: true, force: true }); });

  /**
   * Helper to write a `tsconfig.json` file into the temporary directory.
   *
   * @param {Record<string, unknown>} content - The JSON content for tsconfig
   * @returns {void}
   */
  const writeTsconfig = (content: Record<string, unknown>): void => {
    fs.writeFileSync(
      path.join(temporaryDirectory, 'tsconfig.json'),
      JSON.stringify(content)
    );
  };

  /**
   * Helper to write a file with given content into the temporary directory.
   *
   * @param {string} fileName - File name
   * @param {string} fileContent - File content
   * @returns {void}
   */
  const writeFile = (fileName: string, fileContent: string): void => { fs.writeFileSync(path.join(temporaryDirectory, fileName), fileContent); };

  // Success cases

  it('returns `tshipMode` false when no `tship` property exists', async () => {
    writeTsconfig({ compilerOptions: { outDir: './dist', rootDir: './src' } });
    const config = await resolveConfig(temporaryDirectory);
    expect(config.tshipMode).toBe(false);
  });

  it('returns `tshipMode` false for empty `tship: {}`', async () => {
    writeTsconfig({ compilerOptions: {}, tship: {} });
    const config = await resolveConfig(temporaryDirectory);
    expect(config.tshipMode).toBe(false);
  });

  it('activates `tshipMode` when formats are set', async () => {
    writeTsconfig({
      compilerOptions: { outDir: './dist' },
      tship: { formats: ['cjs', 'esm'] }
    });
    const config = await resolveConfig(temporaryDirectory);
    expect(config.tshipMode).toBe(true);
    expect(config.tship.formats).toEqual(['cjs', 'esm']);
    const expectedOut = path.resolve(temporaryDirectory, './dist');
    expect(config.tship.outDirs).toEqual({ cjs: expectedOut, esm: expectedOut });
  });

  it('uses `tship.outDirs` when provided', async () => {
    writeTsconfig({
      compilerOptions: { outDir: './dist' },
      tship: {
        formats: ['cjs', 'esm'],
        outDirs: { cjs: './cjs-out', esm: './esm-out' }
      }
    });
    const config = await resolveConfig(temporaryDirectory);
    expect(config.tship.outDirs).toEqual({ cjs: './cjs-out', esm: './esm-out' });
  });

  it('single `outDir` overrides `outDirs`', async () => {
    writeTsconfig({
      compilerOptions: {},
      tship: {
        formats: ['cjs', 'esm'],
        outDir: './universal',
        outDirs: { cjs: './ignored' }
      }
    });
    const config = await resolveConfig(temporaryDirectory);
    expect(config.tship.outDirs).toEqual({ cjs: './universal', esm: './universal' });
  });

  it('CLI overrides formats', async () => {
    writeTsconfig({
      compilerOptions: { outDir: './dist' },
      tship: { formats: ['cjs'] }
    });
    const config = await resolveConfig(temporaryDirectory, { formats: ['esm'] });
    expect(config.tship.formats).toEqual(['esm']);
  });

  it('respects `compilerOptions.rootDir`', async () => {
    writeTsconfig({
      compilerOptions: { rootDir: './source', outDir: './dist' },
      tship: { formats: ['esm'] }
    });
    const config = await resolveConfig(temporaryDirectory);
    expect(config.rootDir).toBe(path.resolve(temporaryDirectory, './source'));
  });

  it('falls back to project directory if `rootDir` missing', async () => {
    writeTsconfig({
      compilerOptions: { outDir: './dist' },
      tship: { formats: ['esm'] }
    });
    const config = await resolveConfig(temporaryDirectory);
    expect(config.rootDir).toBe(temporaryDirectory);
  });

  it('merges `autoExports` from multiple sources', async () => {
    writeTsconfig({
      compilerOptions: {},
      tship: { formats: ['esm'], autoExports: false }
    });
    const config = await resolveConfig(temporaryDirectory, {
      autoExports: { generate: true, typesVersions: true }
    });
    expect(config.tship.autoExports).toEqual({ generate: true, typesVersions: true });
  });

  it('loads `tship.config.ts` when present', async () => {
    writeTsconfig({ compilerOptions: { outDir: './dist' } });
    writeFile('tship.config.ts', 'export default { formats: ["cjs"] }');
    const config = await resolveConfig(temporaryDirectory);
    expect(config.tshipMode).toBe(true);
    expect(config.tship.formats).toEqual(['cjs']);
  });

  it('loads `tship.config.mjs` when present', async () => {
    writeTsconfig({ compilerOptions: { outDir: './dist' } });
    writeFile('tship.config.mjs', 'export default { formats: ["esm"] }');
    const config = await resolveConfig(temporaryDirectory);
    expect(config.tship.formats).toEqual(['esm']);
  });

  it('handles `extends` in tsconfig', async () => {
    writeFile('tsconfig.base.json', JSON.stringify({ compilerOptions: { strict: true, outDir: './build' } }));
    writeTsconfig({
      extends: './tsconfig.base.json',
      tship: { formats: ['esm'] }
    });
    const config = await resolveConfig(temporaryDirectory);
    expect(config.compilerOptions.strict).toBe(true);
  });

  it('resolves CJS module and moduleResolution overrides', async () => {
    writeTsconfig({
      compilerOptions: { outDir: './dist' },
      tship: {
        formats: ['cjs', 'esm'],
        cjsModule: 'CommonJS',
        cjsModuleResolution: 'Node10',
        esmModule: 'ESNext',
        esmModuleResolution: 'NodeNext'
      }
    });
    const config = await resolveConfig(temporaryDirectory);
    expect(config.tship.cjsModule).toBe('CommonJS');
    expect(config.tship.cjsModuleResolution).toBe('Node10');
    expect(config.tship.esmModule).toBe('ESNext');
    expect(config.tship.esmModuleResolution).toBe('NodeNext');
  });

  it('activates mode when only `cjsModule` is set', async () => {
    writeTsconfig({
      compilerOptions: {},
      tship: { cjsModule: 'CommonJS' }
    });
    const config = await resolveConfig(temporaryDirectory);
    expect(config.tshipMode).toBe(true);
  });

  it('activates mode when plugins are set', async () => {
    writeTsconfig({
      compilerOptions: { outDir: './dist' },
      tship: { plugins: [{ name: 'test' }] }
    });
    const config = await resolveConfig(temporaryDirectory);
    expect(config.tshipMode).toBe(true);
  });

  // Error cases

  it('throws if no `tsconfig.json` found', async () => {
    await expect(resolveConfig(temporaryDirectory)).rejects.toThrow(/No tsconfig.json found/);
  });

  it('adds diagnostic if config file fails to load', async () => {
    writeTsconfig({ compilerOptions: {} });
    writeFile('tship.config.ts', 'invalid typescript syntax !!!');
    const config = await resolveConfig(temporaryDirectory);
    const hasLoadError = config.diagnostics.some((diagnostic) => diagnostic.messageText.toString().includes('Failed to load'));
    expect(hasLoadError).toBe(true);
  });

  it('adds diagnostic if tsconfig has error', async () => {
    writeFile('tsconfig.json', '{ invalid json }');
    const config = await resolveConfig(temporaryDirectory);
    expect(config.diagnostics.length).toBeGreaterThan(0);
  });
});
