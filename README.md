# @jstility/tship

[![npm version](https://img.shields.io/npm/v/@jstility/tship.svg)](https://www.npmjs.com/package/@jstility/tship)
[![License](https://img.shields.io/npm/l/@jstility/tship.svg)](./LICENSE)
[![Node Version](https://img.shields.io/node/v/@jstility/tship.svg)](https://nodejs.org)
[![Documentation](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://jstility.github.io/tship)
[![Donate](https://img.shields.io/badge/donate-support%20us-yellowgreen)](https://jstility.github.io/donate)

✨ **A smarter build tool that starts like `tsc` and grows with you. Enable dual-format output, automatic `package.json` exports, and a robust watch mode with just a few lines of configuration.** ✨

* [Features](#features)
* [Installation](#installation)
* [Usage](#usage)
* [Documentation](#documentation)
* [Support](#support)
* [Contributing](#contributing)
* [Authors and Acknowledgment](#authors-and-acknowledgment)
* [License](#license)

[![Banner Logo](https://jstility.github.io/tship/banner.svg)](https://jstility.github.io/tship)

```bash
# initialize tship in your project
npx tship init

# build for both CJS and ESM
npx tship build

# watch mode during development
npx tship watch
```

## Features

TShip is built on top of the TypeScript compiler API and delivers:

- **Dual-format output** – produce CommonJS and ES modules from a single codebase (opt-in)
- **Smart extension handling** – automatically renames files when output directories collide, keeps standard extensions otherwise
- **Auto-exports** – updates `package.json` with conditional `exports`, `main`, `module`, `types`, and `typesVersions` for maximum ecosystem compatibility
- **Robust watch mode** – uses chokidar for reliable file watching (falls back to `tsc --watch` when not configured)
- **Plugin system** – hook into `onPostEmit` and `onBuildEnd` to extend the build pipeline
- **Zero config** – runs as standard `tsc` by default; advanced features are activated only when you add `tship` settings
- **Fast** – compiles each format in parallel using the TypeScript API

All features are configurable via `tsconfig.json`, a dedicated `tship.config.ts`, or CLI flags.

## Installation

Install the package and its peer dependency `typescript`:

```bash
npm install -D @jstility/tship typescript
```

Add a `tship` section to your `tsconfig.json` or run the init command to create a standalone config file:

```bash
npx tship init
```

### Minimal dual-format setup (shared output directory)

If your `tsconfig.json` already has `outDir` defined, you can enable dual-format output with a single line:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "declaration": true,
    "sourceMap": true
  },
  "tship": {
    "formats": ["cjs", "esm"]
  },
  "include": ["src/**/*.ts"]
}
```

Both formats will be written to `./dist` and file extensions will be renamed to `.cjs`/`.mjs` automatically.

### Separate output directories

If you prefer to keep the formats in different folders, specify `outDirs`:

```json
{
  "compilerOptions": { ... },
  "tship": {
    "formats": ["cjs", "esm"],
    "outDirs": {
      "cjs": "./dist/cjs",
      "esm": "./dist/esm"
    },
    "autoExports": {
      "generate": true,
      "typesVersions": true
    }
  }
}
```

This will automatically populate `main`, `module`, `types`, `exports`, and `typesVersions` in your `package.json`.

## Usage

### Default behavior (no `tship` configuration)

If no `tship` property is present in `tsconfig.json` and no `tship.config.ts` exists, `tship` behaves exactly like `tsc`:

```bash
npx tship build
```

### With `tship` enabled

Once you add `formats` (or any other `tship` option), the multi-format pipeline kicks in:

```bash
npx tship build
```

This will output:

```
✔ Build completed in 234ms
ℹ CJS → dist/cjs
ℹ ESM → dist/esm
```

Inside `dist/cjs` you'll find CommonJS files (`require`/`exports`) and inside `dist/esm` you'll find ES modules (`import`/`export`). Both folders contain declaration files (`.d.ts`), source maps, and declaration maps.

Watch your source files and rebuild automatically:

```bash
npx tship watch
```

Override the format or output directories via CLI:

```bash
npx tship build --formats cjs,esm --cjs-out dist/commonjs --esm-out dist/module
```

For a complete list of commands and options, run:

```bash
npx tship --help
```

## Documentation

Full documentation is available at **[jstility.github.io/tship](https://jstility.github.io/tship)**.
You'll find guides on configuration, dual-format output, declaration files, auto-exports, watch mode, monorepo integration, and the plugin API.

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/jstility/tship/issues/new) with a clear description and, if possible, a minimal reproducible example.

## Contributing

Contributions are very welcome! Whether it's a bug report, feature request, or a pull request, please follow the guidelines in [here](https://jstility.github.io/contributing). All contributions are appreciated.

## Authors and Acknowledgment

`@jstility/tship` was created by **Rangga Fajar Oktariansyah ([@FajarKim](https://github.com/FajarKim))** and is maintained by the **JStility ([@jstility](https://github.com/jstility))** organization.
It builds upon the excellent [TypeScript compiler API](https://github.com/microsoft/TypeScript) and is inspired by tools like `tsup` and `tsc`.

## License

This project is licensed under the [Apache License 2.0](./LICENSE).

<br>
<a href="https://techforpalestine.org/learn-more" target="_blank" rel="noopener noreferrer">
  <img src="https://raw.githubusercontent.com/jstility/.github/refs/heads/master/image/freedom-palestine.svg" alt="Support Palestine!" align="left" width="180px" height="180px"/>
  <img align="left" width="0" height="180px" hspace="10"/>
</a>
<p>
  We stand with the innocent people of Palestine.
  <br>
  <a href="https://techforpalestine.org/learn-more" target="_blank" rel="noopener noreferrer">Learn more ➜</a>
</p>
