# Architecture

`@iridium-group/config` turns a config file and the environment into one validated, fully typed
object, or one error that lists everything wrong.

## Pipeline

```
 source                       loadConfig() / loadConfigSync()
   |
   |  path or file: URL ----> read file (utf8) ----> parseJsonc() ----+
   |  object --------------------------------------------------------+
   |                                                                  v
   |                                                   applyEnvOverrides(input, env)
   |                                                     unknown name / bad value -> issues
   |                                                                  |
   |                                                                  v
   |                                                   validateConfig(merged input)
   |                                                     every problem -> issues
   |                                                                  |
   |                                     issues? --yes--> throw ConfigError(issues, { source })
   |                                                                  | no
   |                                                                  v
   +------------------------------------------------------> applyDefaults() -> IridiumConfig
```

- Overrides are applied before validation, so an environment variable can complete a section
  (for example `IRIDIUM_TRANSPORT__URL` for a file that sets `type: "wisp"`), and an invalid
  value from the environment is reported with the variable's name.
- Validation runs on input, not on the defaulted result: what is checked is what the user wrote.
  Defaults are always valid, and a test checks they match the schema's `default` values.
- Read, parse, override and validation problems all become `ConfigIssue`s in one `ConfigError`.

## Modules

| File              | Role                                                           | `node:` imports |
| ----------------- | -------------------------------------------------------------- | --------------- |
| `src/types.ts`    | Config types                                                   | no              |
| `src/fields.ts`   | Table of sections, settings and kinds; enums and patterns      | no              |
| `src/validate.ts` | Hand-written validator                                         | no              |
| `src/defaults.ts` | `DEFAULT_CONFIG`, `applyDefaults()`                            | no              |
| `src/jsonc.ts`    | Comment and trailing-comma stripping, positioned syntax errors | no              |
| `src/env.ts`      | Environment variable names, conversion, merge                  | no              |
| `src/errors.ts`   | `ConfigError`, `formatIssues()`                                | no              |
| `src/load.ts`     | File resolution and reading, `loadConfig()`, `resolveConfig()` | yes             |

`resolveConfig()` reads `process.env` only when no `env` option is given.

## Keeping the schema in sync

The validator is written by hand, for clear messages and no dependencies, and the JSON Schema is
written by hand for editors. They share no code, so `test/schema.test.ts` holds them together:

1. Every file in `test/fixtures/valid/` passes both.
2. Every file in `test/fixtures/invalid/` fails both, and each issue path the validator reports
   has a matching Ajv error (`uniqueItems` errors are matched at the array).
3. 500 configs from a seeded generator, mixing valid values with near misses for every setting,
   get the same verdict from both.
4. The schema lists the same sections and settings as `CONFIG_FIELDS`, the same enums, and the
   same defaults as `DEFAULT_CONFIG`.

Shared patterns live in `src/fields.ts`; the schema repeats them as strings.
