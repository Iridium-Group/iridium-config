# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.1.0 — 2026-11-19

### Added

- `IridiumConfig` and `IridiumConfigInput` types with `server`, `transport`, `security` and `logging` sections. `transport` and `security` match `createTransport()` in `@iridium-group/transport`.
- `loadConfig()` and `loadConfigSync()` for `.json` and `.jsonc` files, `file:` URLs and in-memory objects, with `IRIDIUM_CONFIG` and `iridium.config.json` fallbacks.
- `parseJsonc()` with comments, trailing commas, a BOM, and line and column in syntax errors.
- `validateConfig()`, a hand-written validator that reports every issue with a path, and `ConfigError` carrying the list.
- `applyDefaults()` and the frozen `DEFAULT_CONFIG`.
- Environment overrides (`IRIDIUM_<SECTION>__<SETTING>`) with type conversion, a configurable prefix, and errors that name the variable.
- `schema/iridium.schema.json` (JSON Schema 2020-12), exported as `@iridium-group/config/schema.json`.
- Tests that check the schema and the validator agree on fixtures and on generated configs, plus examples and documentation.
