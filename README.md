<p align="center"><img src="./.github/assets/iridium-mark.svg" width="96" alt="Iridium Group"></p>

<h1 align="center">iridium-config</h1>

<p align="center">
  <a href="https://github.com/Iridium-Group/iridium-config/actions/workflows/ci.yml"><img src="https://github.com/Iridium-Group/iridium-config/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
</p>

Zero-dependency loading and validation for Iridium configuration files, with environment
overrides and a published JSON Schema. One call reads a JSON (or JSON with comments) file, applies
`IRIDIUM_*` environment variables, checks every setting, and returns a fully typed config with all
defaults filled in.

Part of [Iridium Group](https://github.com/Iridium-Group): open web infrastructure for
browser-based networking and proxy applications.

**Status: Experimental.** Version 0.1.0. The API may change before 1.0. Not yet published to npm.

## Contents

- [Features](#features)
- [Install](#install)
- [Usage](#usage)
- [Config file](#config-file)
- [Environment overrides](#environment-overrides)
- [Errors](#errors)
- [JSON Schema](#json-schema)
- [Examples](#examples)
- [Limitations](#limitations)
- [Development](#development)
- [Documentation](#documentation)
- [Dependencies and licenses](#dependencies-and-licenses)
- [License](#license)

## Features

- `loadConfig(path | URL | object)` and `loadConfigSync()`: read, parse, override, validate and
  fill defaults in one step.
- `.json` and `.jsonc` files, both with `//` and `/* */` comments and trailing commas. Syntax
  errors report a line and column.
- Four sections: `server`, `transport`, `security` and `logging`. `transport` and `security` are
  exactly what `createTransport()` in
  [`@iridium-group/transport`](https://github.com/Iridium-Group/iridium-transport) reads.
- Environment overrides: `IRIDIUM_SERVER__PORT=9000`, `IRIDIUM_SECURITY__ALLOWED_PORTS=80,443`.
  Values are converted to the type each setting takes.
- A hand-written validator that reports every problem at once, each with a path such as
  `security.blockedPorts[2]`, and a `ConfigError` that carries the list.
- `schema/iridium.schema.json` (JSON Schema 2020-12) for editors and other tools. Tests check that
  the schema and the validator accept and reject the same configs.
- The validator (`@iridium-group/config/validate`) imports no `node:` module and runs in browsers.
- Zero runtime dependencies. ESM only. TypeScript types included.

## Install

The package is not on npm yet. Install it from GitHub; the `prepare` script builds `dist/`:

```sh
npm install github:Iridium-Group/iridium-config
```

Requires Node.js 22.18 or newer.

## Usage

```ts
import { ConfigError, loadConfig } from '@iridium-group/config';
import { createTransport } from '@iridium-group/transport';

try {
  const config = await loadConfig('iridium.config.json');
  const transport = createTransport(config.transport, {
    security: config.security,
    connectTimeoutMs: config.transport.connectTimeoutMs,
  });
  console.log(`listening on ${config.server.host}:${config.server.port}`);
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
```

With no argument, `loadConfig()` reads the file named by `IRIDIUM_CONFIG`, or
`iridium.config.json` in the working directory if it exists, and otherwise uses the defaults and
environment overrides alone.

Options: `env` (an object to read instead of `process.env`, or `false` to ignore the environment),
`envPrefix` (default `IRIDIUM_`) and `cwd` (for relative paths).

## Config file

Every section and setting is optional. The defaults:

```jsonc
{
  "$schema": "./node_modules/@iridium-group/config/schema/iridium.schema.json",
  "server": {
    "host": "0.0.0.0",
    "port": 8080, // 0 to 65535; 0 picks a free port
    "basePath": "/",
    "wispPath": "/wisp/",
    "staticDir": "public",
  },
  "transport": {
    "type": "direct", // "direct" | "wisp" | "memory"
    // "url": "wss://wisp.example.org/wisp/", required when type is "wisp"
    "connectTimeoutMs": 10000, // 1 to 300000
  },
  "security": {
    "blockPrivateAddresses": true,
    "blockedPorts": [25, 465, 587],
    // "allowedPorts": [80, 443], not set by default: every port not blocked is allowed
  },
  "logging": {
    "level": "info", // "silent" | "error" | "warn" | "info" | "debug"
    "format": "pretty", // "pretty" | "json"
  },
}
```

Unknown sections and settings are errors, so a typo never silently falls back to a default. See
[docs/CONFIGURATION.md](./docs/CONFIGURATION.md) for every setting.

## Environment overrides

Variables named `IRIDIUM_<SECTION>__<SETTING>` (double underscore, setting in `SCREAMING_SNAKE`
case) override the file:

```sh
IRIDIUM_SERVER__PORT=9000
IRIDIUM_TRANSPORT__TYPE=wisp
IRIDIUM_TRANSPORT__URL=wss://wisp.example.org/wisp/
IRIDIUM_SECURITY__BLOCK_PRIVATE_ADDRESSES=false   # also 1/0, yes/no, on/off
IRIDIUM_SECURITY__ALLOWED_PORTS=80,443             # or a JSON array: [80,443]
```

Precedence: defaults, then the file, then the environment. Empty variables are ignored. Only names
with `__` after the prefix count as overrides, so `IRIDIUM_CONFIG` is never mistaken for one; an
unknown `IRIDIUM_*__*` name is an error.

## Errors

Everything that can go wrong (a missing file, bad JSON, a wrong value) throws a `ConfigError`.
`error.issues` lists `{ path, message }` for every problem, and `error.message` reads:

```
Invalid Iridium config in /srv/iridium/iridium.config.json (3 issues):
  - server.port: must be an integer, got "8080"
  - security.blockedPorts[1]: duplicate port 25 (also at index 0)
  - transport.url: is required when transport.type is "wisp"
```

A value from the environment is named in its message: `(from IRIDIUM_SERVER__PORT)`.

To check input without throwing, use `validateConfig(input)`, which returns the issue list.

## JSON Schema

`schema/iridium.schema.json` is published with the package and exported as
`@iridium-group/config/schema.json`. Reference it from a config file with `$schema` for editor
completion and inline errors. `$schema` is the one top-level key besides the four sections, and
the loader ignores it.

## Examples

Run from a clone of this repository after `npm ci`:

```sh
node examples/load-config.ts       # load examples/iridium.config.jsonc and print the result
node examples/validate-errors.ts   # what a broken config reports
```

## Limitations

- JSON and JSONC only. YAML, TOML and JavaScript config files are not supported.
- `transport.type: "memory"` is accepted for tests; `createTransport()` in
  `@iridium-group/transport` 0.1.0 builds only `direct` and `wisp` transports.
- A port listed in both `blockedPorts` and `allowedPorts` is not an error. `AddressPolicy`
  checks the blocked list first, so the port stays blocked.
- Relative paths such as `server.staticDir` are returned as written; the consuming server
  resolves them.

## Development

```sh
npm ci
npm run format:check
npm run typecheck
npm test
npm run build
```

Tests use the built-in `node --test` runner and run the TypeScript sources directly.
`test/schema.test.ts` validates every fixture in `test/fixtures/`, plus 500 generated configs,
with both the hand-written validator and [Ajv](https://ajv.js.org/), and fails if they disagree.
Change the schema and `src/validate.ts` together.

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Documentation

- [docs/CONFIGURATION.md](./docs/CONFIGURATION.md): every setting, its default and its variable.
- [docs/API.md](./docs/API.md): every exported function, class, constant and type.
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md): the loading pipeline and how the schema stays in
  sync.
- [CHANGELOG.md](./CHANGELOG.md)

## Dependencies and licenses

Runtime dependencies: none.

Development dependencies:

| Package       | License    | Used for                                  |
| ------------- | ---------- | ----------------------------------------- |
| `typescript`  | Apache-2.0 | Type checking and build                   |
| `@types/node` | MIT        | Node.js type definitions                  |
| `prettier`    | MIT        | Formatting                                |
| `ajv`         | MIT        | Tests only: checking the schema agreement |

## License

[MIT](./LICENSE) © 2026 Iridium Group contributors
