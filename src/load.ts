import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyDefaults } from './defaults.ts';
import { applyEnvOverrides, CONFIG_PATH_ENV, DEFAULT_ENV_PREFIX, type EnvSource } from './env.ts';
import { ConfigError, type ConfigIssue } from './errors.ts';
import { parseJsonc } from './jsonc.ts';
import type { IridiumConfig, IridiumConfigInput } from './types.ts';
import { validateConfig } from './validate.ts';

/** File loaded by `loadConfig()` when no source is given and `IRIDIUM_CONFIG` is not set. */
export const DEFAULT_CONFIG_FILE = 'iridium.config.json';

/** File extensions `loadConfig()` reads. Both accept comments and trailing commas. */
export const CONFIG_EXTENSIONS: readonly string[] = ['.json', '.jsonc'];

export interface LoadConfigOptions {
  /**
   * Environment to read overrides (and `IRIDIUM_CONFIG`) from. Default `process.env`.
   * Pass `false` to ignore the environment entirely.
   */
  env?: EnvSource | false;
  /** Prefix for override variables. Default `"IRIDIUM_"`. */
  envPrefix?: string;
  /** Directory relative paths are resolved against. Default `process.cwd()`. */
  cwd?: string;
}

/** A config file path, a `file:` URL, or config input already in memory. */
export type ConfigSource = string | URL | IridiumConfigInput;

/**
 * Apply environment overrides to config input, validate it, and fill in defaults.
 * Throws `ConfigError` listing every issue. Does not touch the file system.
 */
export function resolveConfig(
  input: unknown,
  options: LoadConfigOptions & { source?: string } = {},
): IridiumConfig {
  const env = options.env === false ? {} : (options.env ?? process.env);
  const overridden = applyEnvOverrides(input, env, options.envPrefix ?? DEFAULT_ENV_PREFIX);
  const issues: ConfigIssue[] = [...overridden.issues];
  for (const issue of validateConfig(overridden.input)) {
    const from =
      overridden.applied.get(issue.path) ??
      overridden.applied.get(issue.path.replace(/\[\d+\]$/, ''));
    issues.push(
      from && !issue.message.includes(from)
        ? { ...issue, message: `${issue.message} (from ${from})` }
        : issue,
    );
  }
  if (issues.length > 0) throw new ConfigError(issues, { source: options.source });
  return applyDefaults(overridden.input as IridiumConfigInput);
}

interface Target {
  path: string;
  /** False when the path is the implicit default, so a missing file is not an error. */
  required: boolean;
}

function target(source: string | URL | undefined, options: LoadConfigOptions): Target {
  const cwd = options.cwd ?? process.cwd();
  if (source instanceof URL) return { path: fileURLToPath(source), required: true };
  if (typeof source === 'string') {
    if (source.trim() === '') {
      throw new ConfigError([{ path: '', message: 'config path must not be empty' }]);
    }
    return { path: resolve(cwd, source), required: true };
  }
  const fromEnv = options.env === false ? undefined : (options.env ?? process.env)[CONFIG_PATH_ENV];
  if (fromEnv) return { path: resolve(cwd, fromEnv), required: true };
  return { path: resolve(cwd, DEFAULT_CONFIG_FILE), required: false };
}

function checkExtension(path: string): void {
  const ext = extname(path).toLowerCase();
  if (!CONFIG_EXTENSIONS.includes(ext)) {
    throw new ConfigError(
      [
        {
          path: '',
          message: `unsupported file type ${JSON.stringify(ext || '(none)')}; use ${CONFIG_EXTENSIONS.join(' or ')}`,
        },
      ],
      { source: path },
    );
  }
}

function readError(path: string, cause: unknown): ConfigError {
  const code = (cause as { code?: unknown })?.code;
  const message =
    code === 'ENOENT'
      ? 'file not found'
      : `cannot read file${typeof code === 'string' ? ` (${code})` : ''}`;
  return new ConfigError([{ path: '', message }], { source: path, cause });
}

function isMissing(error: unknown): boolean {
  return (error as { code?: unknown })?.code === 'ENOENT';
}

function isInput(source: unknown): source is IridiumConfigInput {
  return typeof source === 'object' && source !== null && !(source instanceof URL);
}

/**
 * Load an Iridium config: read and parse the file (or take the object given), apply
 * `IRIDIUM_*` environment overrides, validate, and fill in defaults.
 *
 * With no source, reads the file named by `IRIDIUM_CONFIG`, or `iridium.config.json` in the
 * working directory if it exists (defaults and overrides alone otherwise).
 *
 * Throws `ConfigError` with every issue found.
 */
export async function loadConfig(
  source?: ConfigSource,
  options: LoadConfigOptions = {},
): Promise<IridiumConfig> {
  if (isInput(source)) return resolveConfig(source, options);
  const { path, required } = target(source, options);
  checkExtension(path);
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (cause) {
    if (!required && isMissing(cause)) return resolveConfig({}, options);
    throw readError(path, cause);
  }
  return resolveConfig(parseJsonc(text, path), { ...options, source: path });
}

/** Synchronous `loadConfig()`, for startup code that cannot await. */
export function loadConfigSync(
  source?: ConfigSource,
  options: LoadConfigOptions = {},
): IridiumConfig {
  if (isInput(source)) return resolveConfig(source, options);
  const { path, required } = target(source, options);
  checkExtension(path);
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (cause) {
    if (!required && isMissing(cause)) return resolveConfig({}, options);
    throw readError(path, cause);
  }
  return resolveConfig(parseJsonc(text, path), { ...options, source: path });
}

/** Identity helper that gives config objects written in TypeScript full type checking. */
export function defineConfig(config: IridiumConfigInput): IridiumConfigInput {
  return config;
}
