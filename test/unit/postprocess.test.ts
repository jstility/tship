/**
 * Unit tests for post-processing functions.
 * Tests renaming, import rewriting, source map updates, and `package.json` updates.
 * @module tests/unit/postprocess
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { postProcessFormat } from '../../src/core/postprocess.js';
import type { ResolvedConfig, ModuleFormat } from '../../src/core/types.js';

describe('postProcessFormat', () => {
  let temporaryDirectory: string;

  /**
   * Create a mock `ResolvedConfig` with overrides for testing.
   *
   * @param {Partial<ResolvedConfig>} [overrides] - Properties to override
   * @returns {ResolvedConfig} A mock configuration
   */
  const createMockConfig = (overrides?: Partial<ResolvedConfig>): ResolvedConfig => {
    const base: ResolvedConfig = {
      rootDir: '',
      projectDir: temporaryDirectory,
      tsconfigPath: '',
      compilerOptions: {},
      tshipMode: true,
      tship: {
        formats: ['cjs', 'esm'] as ModuleFormat[],
        outDirs: { cjs: '', esm: '' },
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

  beforeEach(() => { temporaryDirectory = fs.mkdtempSync(path.join(tmpdir(), 'tship-post-')); });

  afterEach(() => { fs.rmSync(temporaryDirectory, { recursive: true, force: true }); });

  // Renaming files

  it('renames `.js` to `.cjs` when `shouldRename` is true and format is `cjs`', async () => {
    const outDir = path.join(temporaryDirectory, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.js'), 'console.log("hi")');
    fs.writeFileSync(path.join(outDir, 'index.js.map'), '{}');
    fs.writeFileSync(path.join(outDir, 'index.d.ts'), 'export {};');

    const config = createMockConfig();
    await postProcessFormat(config, 'cjs', outDir, true);

    expect(fs.existsSync(path.join(outDir, 'index.cjs'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'index.cjs.map'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'index.d.cts'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'index.js'))).toBe(false);
  });

  it('does not rename when `shouldRename` is false', async () => {
    const outDir = path.join(temporaryDirectory, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.js'), '');
    fs.writeFileSync(path.join(outDir, 'index.d.ts'), '');

    const config = createMockConfig();
    await postProcessFormat(config, 'esm', outDir, false);

    expect(fs.existsSync(path.join(outDir, 'index.js'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'index.d.ts'))).toBe(true);
  });

  it('does nothing if output directory does not exist', async () => {
    const outDir = path.join(temporaryDirectory, 'nonexistent');
    const config = createMockConfig();
    await expect(postProcessFormat(config, 'esm', outDir, true)).resolves.toBeUndefined();
  });

  // Import rewriting

  it('rewrites `.js` to `.mjs` in static import for ESM', async () => {
    const outDir = path.join(temporaryDirectory, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    const content = `import { foo } from "./utils.js";\nexport const bar = foo;`;
    fs.writeFileSync(path.join(outDir, 'index.js'), content);
    fs.writeFileSync(path.join(outDir, 'utils.js'), 'export const foo = 1;');

    const config = createMockConfig();
    await postProcessFormat(config, 'esm', outDir, true);

    const result = fs.readFileSync(path.join(outDir, 'index.mjs'), 'utf-8');
    expect(result).toContain('./utils.mjs');
    expect(result).not.toContain('./utils.js');
  });

  it('rewrites dynamic import with assignment', async () => {
    const outDir = path.join(temporaryDirectory, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.js'), `const mod = import("./dep.js");`);
    fs.writeFileSync(path.join(outDir, 'dep.js'), 'export const x = 1;');

    const config = createMockConfig();
    await postProcessFormat(config, 'esm', outDir, true);

    const result = fs.readFileSync(path.join(outDir, 'index.mjs'), 'utf-8');
    expect(result).toContain('./dep.mjs');
  });

  it('rewrites dynamic import with await', async () => {
    const outDir = path.join(temporaryDirectory, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.js'), `const mod = await import("./dep.js");`);
    fs.writeFileSync(path.join(outDir, 'dep.js'), 'export const x = 1;');

    const config = createMockConfig();
    await postProcessFormat(config, 'esm', outDir, true);

    const result = fs.readFileSync(path.join(outDir, 'index.mjs'), 'utf-8');
    expect(result).toContain('./dep.mjs');
  });

  it('rewrites require statements', async () => {
    const outDir = path.join(temporaryDirectory, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.js'), `const dep = require("./dep.js");`);
    fs.writeFileSync(path.join(outDir, 'dep.js'), 'module.exports = 1;');

    const config = createMockConfig();
    await postProcessFormat(config, 'cjs', outDir, true);

    const result = fs.readFileSync(path.join(outDir, 'index.cjs'), 'utf-8');
    expect(result).toContain('./dep.cjs');
  });

  it('does not rewrite non-relative imports', async () => {
    const outDir = path.join(temporaryDirectory, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.js'), `import "react";`);
    const config = createMockConfig();
    await postProcessFormat(config, 'esm', outDir, true);
    const result = fs.readFileSync(path.join(outDir, 'index.mjs'), 'utf-8');
    expect(result).toContain('import "react"');
  });

  // Source map updates

  it('updates `sourceMappingURL` after rename', async () => {
    const outDir = path.join(temporaryDirectory, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, 'index.js'),
      `console.log("hello");\n//# sourceMappingURL=index.js.map`
    );
    fs.writeFileSync(path.join(outDir, 'index.js.map'), JSON.stringify({ file: 'index.js' }));

    const config = createMockConfig();
    await postProcessFormat(config, 'cjs', outDir, true);

    const cjsContent = fs.readFileSync(path.join(outDir, 'index.cjs'), 'utf-8');
    expect(cjsContent).toContain('sourceMappingURL=index.cjs.map');
    const map = JSON.parse(fs.readFileSync(path.join(outDir, 'index.cjs.map'), 'utf-8'));
    expect(map.file).toBe('index.cjs');
  });

  it('updates `sourceMappingURL` for declaration files', async () => {
    const outDir = path.join(temporaryDirectory, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, 'index.d.ts'),
      `export const x: number;\n//# sourceMappingURL=index.d.ts.map`
    );
    fs.writeFileSync(path.join(outDir, 'index.d.ts.map'), JSON.stringify({ file: 'index.d.ts' }));

    const config = createMockConfig();
    await postProcessFormat(config, 'cjs', outDir, true);

    const dtsContent = fs.readFileSync(path.join(outDir, 'index.d.cts'), 'utf-8');
    expect(dtsContent).toContain('sourceMappingURL=index.d.cts.map');
  });

  it('ignores invalid JSON in source map files', async () => {
    const outDir = path.join(temporaryDirectory, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.js'), '//# sourceMappingURL=index.js.map');
    fs.writeFileSync(path.join(outDir, 'index.js.map'), 'not valid json');

    const config = createMockConfig();
    await expect(postProcessFormat(config, 'cjs', outDir, true)).resolves.toBeUndefined();
  });

  // package.json updates

  it('updates `package.json` with exports and classic fields', async () => {
    const outDir = path.join(temporaryDirectory, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.js'), '');
    fs.writeFileSync(path.join(outDir, 'index.d.ts'), 'export {};');
    fs.writeFileSync(
      path.join(temporaryDirectory, 'package.json'),
      JSON.stringify({ name: 'test-pkg' })
    );

    const config = createMockConfig({
      tship: {
        ...createMockConfig().tship,
        autoExports: { generate: true, typesVersions: true }
      }
    });
    await postProcessFormat(config, 'cjs', outDir, true);

    const pkg = JSON.parse(fs.readFileSync(path.join(temporaryDirectory, 'package.json'), 'utf-8'));
    expect(pkg.main).toBe('./out/index.cjs');
    expect(pkg.exports['.'].require).toBe('./out/index.cjs');
    expect(pkg.typesVersions).toBeDefined();
  });

  it('does not update `package.json` if no entry found', async () => {
    const outDir = path.join(temporaryDirectory, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(temporaryDirectory, 'package.json'),
      JSON.stringify({ name: 'test-pkg' })
    );

    const config = createMockConfig({
      tship: {
        ...createMockConfig().tship,
        autoExports: { generate: true, typesVersions: true }
      }
    });
    await postProcessFormat(config, 'esm', outDir, false);

    const pkg = JSON.parse(fs.readFileSync(path.join(temporaryDirectory, 'package.json'), 'utf-8'));
    expect(pkg.module).toBeUndefined();
  });

  it('adds `module` field for ESM format', async () => {
    const outDir = path.join(temporaryDirectory, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.js'), 'export const x = 1;');
    fs.writeFileSync(path.join(outDir, 'index.d.ts'), 'export declare const x: number;');
    fs.writeFileSync(
      path.join(temporaryDirectory, 'package.json'),
      JSON.stringify({ name: 'test-pkg' })
    );

    const config = createMockConfig({
      tship: {
        ...createMockConfig().tship,
        autoExports: { generate: true, typesVersions: false }
      }
    });
    await postProcessFormat(config, 'esm', outDir, true);

    const pkg = JSON.parse(fs.readFileSync(path.join(temporaryDirectory, 'package.json'), 'utf-8'));
    expect(pkg.module).toBe('./out/index.mjs');
    expect(pkg.types).toBe('./out/index.d.mts');
  });

  it('skips `package.json` update if file does not exist', async () => {
    const outDir = path.join(temporaryDirectory, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.js'), '');

    const config = createMockConfig({
      tship: {
        ...createMockConfig().tship,
        autoExports: { generate: true, typesVersions: true }
      }
    });
    await expect(postProcessFormat(config, 'cjs', outDir, true)).resolves.toBeUndefined();
  });
});
