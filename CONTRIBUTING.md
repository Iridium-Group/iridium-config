# Contributing

Thanks for helping. Please read the organization-wide guide first:
https://github.com/Iridium-Group/.github/blob/main/CONTRIBUTING.md

## This repository

Requires Node.js 22.18 or newer and npm.

```sh
npm ci                 # install and build
npm test               # run the test suite
npm run typecheck      # TypeScript, including tests and examples
npm run format         # format with Prettier
npm run format:check   # what CI runs
npm run build          # compile src/ to dist/
```

- Keep the package free of runtime dependencies. Ajv is a development dependency used only by
  `test/schema.test.ts`.
- Adding or changing a setting touches four places, and the tests fail until all four agree:
  `src/types.ts`, `src/fields.ts` (which also derives the environment variable),
  `src/validate.ts`, and `schema/iridium.schema.json`. Update `src/defaults.ts` and the schema
  `default` together, and add a valid and an invalid fixture under `test/fixtures/`.
- Error messages follow the path: `server.port: must be an integer, got "8080"`. Say what was
  expected and what was found.
- Settings consumed by `@iridium-group/transport` must keep the shape its `createTransport()`
  reads.
- Use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`, `refactor:`).
