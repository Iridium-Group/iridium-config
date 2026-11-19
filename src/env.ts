import type { ConfigIssue } from './errors.ts';
import { CONFIG_FIELDS, type ConfigSection, type FieldKind } from './fields.ts';
import { isPlainObject } from './validate.ts';

/** Default prefix for environment overrides: `IRIDIUM_SERVER__PORT=9000`. */
export const DEFAULT_ENV_PREFIX = 'IRIDIUM_';

/** Environment variable that names the config file for `loadConfig()` with no source. */
export const CONFIG_PATH_ENV = 'IRIDIUM_CONFIG';

export type EnvSource = Readonly<Record<string, string | undefined>>;

export interface EnvOverride {
  /** Environment variable name, e.g. `IRIDIUM_SERVER__PORT`. */
  name: string;
  /** Config path it sets, e.g. `server.port`. */
  path: string;
  section: ConfigSection;
  key: string;
  kind: FieldKind;
}

/** `connectTimeoutMs` -> `CONNECT_TIMEOUT_MS`. */
export function toEnvSegment(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}

/** Every supported override variable, in config order. */
export function envOverrides(prefix: string = DEFAULT_ENV_PREFIX): EnvOverride[] {
  const out: EnvOverride[] = [];
  for (const [section, fields] of Object.entries(CONFIG_FIELDS)) {
    for (const [key, kind] of Object.entries(fields)) {
      out.push({
        name: `${prefix}${toEnvSegment(section)}__${toEnvSegment(key)}`,
        path: `${section}.${key}`,
        section: section as ConfigSection,
        key,
        kind,
      });
    }
  }
  return out;
}

const TRUE = new Set(['true', '1', 'yes', 'on']);
const FALSE = new Set(['false', '0', 'no', 'off']);

function coerce(kind: FieldKind, raw: string): { value: unknown } | { error: string } {
  const text = raw.trim();
  switch (kind) {
    case 'string':
      return { value: text };
    case 'integer':
      return /^[+-]?\d+$/.test(text) ? { value: Number(text) } : { error: 'must be an integer' };
    case 'boolean': {
      const lower = text.toLowerCase();
      if (TRUE.has(lower)) return { value: true };
      if (FALSE.has(lower)) return { value: false };
      return { error: 'must be true or false (also accepted: 1/0, yes/no, on/off)' };
    }
    case 'portList': {
      if (text.startsWith('[')) {
        try {
          const parsed: unknown = JSON.parse(text);
          if (Array.isArray(parsed)) return { value: parsed };
        } catch {
          // fall through to the error below
        }
        return { error: 'must be a JSON array of ports or a comma-separated list' };
      }
      const parts = text.split(',').map((part) => part.trim());
      if (parts.every((part) => /^\d+$/.test(part))) return { value: parts.map(Number) };
      return { error: 'must be a comma-separated list of ports, e.g. "80,443"' };
    }
  }
}

export interface EnvOverrideResult {
  /** A copy of the input with the overrides applied. The input is not changed. */
  input: unknown;
  /** Variables that could not be used: unknown names or values of the wrong kind. */
  issues: ConfigIssue[];
  /** Overrides that were applied, by config path. */
  applied: Map<string, string>;
}

/**
 * Apply `<PREFIX><SECTION>__<KEY>` variables on top of config input. Only names that contain
 * `__` after the prefix are treated as overrides, so `IRIDIUM_CONFIG` and similar are left
 * alone. Empty values are ignored. Values are converted to the type the setting takes.
 */
export function applyEnvOverrides(
  input: unknown,
  env: EnvSource,
  prefix: string = DEFAULT_ENV_PREFIX,
): EnvOverrideResult {
  const issues: ConfigIssue[] = [];
  const applied = new Map<string, string>();
  // Input that is not an object is left for validation to report.
  if (!isPlainObject(input)) return { input, issues, applied };
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    result[key] = isPlainObject(value) ? { ...value } : value;
  }
  const overrides = envOverrides(prefix);
  const known = new Set(overrides.map((o) => o.name));
  const isSet = (name: string) => env[name] !== undefined && env[name] !== '';

  // Known settings in config order, then unknown names, so issues read top to bottom.
  for (const override of overrides) {
    const raw = env[override.name];
    if (raw === undefined || raw === '') continue;
    const coerced = coerce(override.kind, raw);
    if ('error' in coerced) {
      issues.push({
        path: override.path,
        message: `${coerced.error}, got ${JSON.stringify(raw)} from ${override.name}`,
      });
      continue;
    }
    const current = result[override.section];
    if (current === undefined) {
      result[override.section] = { [override.key]: coerced.value };
    } else if (isPlainObject(current)) {
      current[override.key] = coerced.value;
    } else {
      // The section itself has the wrong type; validation reports it.
      continue;
    }
    applied.set(override.path, override.name);
  }
  for (const name of Object.keys(env).sort()) {
    if (!name.startsWith(prefix) || !name.slice(prefix.length).includes('__')) continue;
    if (known.has(name) || !isSet(name)) continue;
    issues.push({ path: `env.${name}`, message: 'is not a known Iridium setting' });
  }
  return { input: result, issues, applied };
}
