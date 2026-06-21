/**
 * Integration test that performs a full dual-format build on a mini TypeScript project.
 * @module tests/integration/build
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveConfig } from '../../src/core/config.js';
import { emitAllFormats } from '../../src/core/emitter.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

describe('full build integration', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(path.join(tmpdir(), 'tship-int-'));
    fs.mkdirSync(path.join(temporaryDirectory, 'src'));
    fs.writeFileSync(
      path.join(temporaryDirectory, 'src', 'utils.ts'),
      'export const greet = (name: string) => `Hello, ${name}!`;'
    );
    fs.writeFileSync(
      path.join(temporaryDirectory, 'src', 'index.ts'),
      `import { greet as greetFn } from './utils.js';
export const sayHello = (name: string) => greetFn(name);
`
    );
    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        outDir: './dist',
        rootDir: './src',
        strict: true,
        declaration: true,
        sourceMap: true
      },
      tship: {
        formats: ['cjs', 'esm'],
        outDirs: { cjs: './dist/cjs', esm: './dist/esm' }
      }
    };
    fs.writeFileSync(path.join(temporaryDirectory, 'tsconfig.json'), JSON.stringify(tsconfig));
    fs.writeFileSync(
      path.join(temporaryDirectory, 'package.json'),
      JSON.stringify({ name: 'test-pkg', version: '0.0.0' })
    );
  });

  afterEach(() => { fs.rmSync(temporaryDirectory, { recursive: true, force: true }); });

  // Success cases

  it('produces CJS and ESM output with correct module syntax', async () => {
    const config = await resolveConfig(temporaryDirectory);
    expect(config.tshipMode).toBe(true);

    const outputs = await emitAllFormats(config);
    expect(outputs.cjs).toBe(path.resolve(temporaryDirectory, 'dist/cjs'));
    expect(outputs.esm).toBe(path.resolve(temporaryDirectory, 'dist/esm'));

    const cjsIndex = path.join(outputs.cjs, 'index.js');
    expect(fs.existsSync(cjsIndex)).toBe(true);
    const cjsContent = fs.readFileSync(cjsIndex, 'utf-8');
    expect(cjsContent).toMatch(/require\("\.\/utils\.js"\)/);
    expect(cjsContent).toMatch(/exports\.sayHello/);

    const esmIndex = path.join(outputs.esm, 'index.js');
    expect(fs.existsSync(esmIndex)).toBe(true);
    const esmContent = fs.readFileSync(esmIndex, 'utf-8');
    expect(esmContent).toMatch(/import \{ greet as greetFn \} from '\.\/utils\.js'/);
    expect(esmContent).toMatch(/export const sayHello/);

    expect(fs.existsSync(path.join(outputs.cjs, 'index.d.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputs.esm, 'index.d.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputs.cjs, 'index.js.map'))).toBe(true);
    expect(fs.existsSync(path.join(outputs.esm, 'index.js.map'))).toBe(true);
  });

  it('does not rename when directories are separate', async () => {
    const config = await resolveConfig(temporaryDirectory);
    const outputs = await emitAllFormats(config);
    expect(fs.existsSync(path.join(outputs.cjs, 'index.js'))).toBe(true);
    expect(fs.existsSync(path.join(outputs.cjs, 'index.d.ts'))).toBe(true);
    expect(fs.existsSync(path.join(outputs.esm, 'index.js'))).toBe(true);
    expect(fs.existsSync(path.join(outputs.esm, 'index.d.ts'))).toBe(true);
  });

  it('works with no declarations and no sourcemaps', async () => {
    fs.writeFileSync(
      path.join(temporaryDirectory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          outDir: './dist',
          rootDir: './src',
          declaration: false,
          sourceMap: false
        },
        tship: {
          formats: ['cjs', 'esm'],
          outDirs: { cjs: './dist/cjs', esm: './dist/esm' }
        }
      })
    );
    const config = await resolveConfig(temporaryDirectory);
    const outputs = await emitAllFormats(config);
    expect(fs.existsSync(path.join(outputs.cjs, 'index.js'))).toBe(true);
    expect(fs.existsSync(path.join(outputs.cjs, 'index.d.ts'))).toBe(false);
    expect(fs.existsSync(path.join(outputs.cjs, 'index.js.map'))).toBe(false);
  });

  // Error case

  it('emits diagnostics for invalid TypeScript', async () => {
    fs.writeFileSync(
      path.join(temporaryDirectory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          outDir: './dist',
          target: 'ES2022',
          strict: true
        },
        tship: {
          formats: ['cjs'],
          outDirs: { cjs: './dist/cjs' }
        }
      })
    );
    fs.writeFileSync(
      path.join(temporaryDirectory, 'src', 'error.ts'),
      'const x: string = 123;'
    );
    const config = await resolveConfig(temporaryDirectory);
    await expect(emitAllFormats(config)).resolves.toBeDefined();
  });
});
