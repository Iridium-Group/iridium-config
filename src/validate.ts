import type { ConfigIssue } from './errors.ts';
import {
  CONFIG_FIELDS,
  HOST_PATTERN,
  LOG_FORMATS,
  LOG_LEVELS,
  MAX_CONNECT_TIMEOUT_MS,
  TRANSPORT_TYPES,
  URL_PATH_PATTERN,
  WEBSOCKET_URL_PATTERN,
  type ConfigSection,
} from './fields.ts';
import type { IridiumConfigInput } from './types.ts';

/*
 * A hand-written validator for Iridium config input. It accepts exactly what
 * schema/iridium.schema.json accepts (test/schema.test.ts checks this on fixtures and on
 * generated configs) and reports every problem with a path, instead of stopping at the first.
 * It imports no `node:` module, so it can run in browsers.
 */

type Checker = (value: unknown, path: string, issues: ConfigIssue[]) => void;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'string')
    return JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value);
  if (typeof value === 'object') return 'an object';
  return `${typeof value} ${String(value)}`;
}

function join(base: string, key: string): string {
  return base ? `${base}.${key}` : key;
}

function list(values: readonly string[]): string {
  return values.map((v) => JSON.stringify(v)).join(', ');
}

const integerIn =
  (min: number, max: number): Checker =>
  (value, path, issues) => {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      issues.push({ path, message: `must be an integer, got ${describe(value)}` });
    } else if (value < min || value > max) {
      issues.push({ path, message: `must be between ${min} and ${max}, got ${value}` });
    }
  };

const oneOf =
  (values: readonly string[]): Checker =>
  (value, path, issues) => {
    if (typeof value !== 'string' || !values.includes(value)) {
      issues.push({ path, message: `must be one of ${list(values)}, got ${describe(value)}` });
    }
  };

const matching =
  (pattern: RegExp, expected: string): Checker =>
  (value, path, issues) => {
    if (typeof value !== 'string') {
      issues.push({ path, message: `must be a string, got ${describe(value)}` });
    } else if (!pattern.test(value)) {
      issues.push({ path, message: `must be ${expected}, got ${describe(value)}` });
    }
  };

const nonEmptyString: Checker = (value, path, issues) => {
  if (typeof value !== 'string') {
    issues.push({ path, message: `must be a string, got ${describe(value)}` });
  } else if (value.length === 0) {
    issues.push({ path, message: 'must not be empty' });
  }
};

const boolean: Checker = (value, path, issues) => {
  if (typeof value !== 'boolean') {
    issues.push({ path, message: `must be true or false, got ${describe(value)}` });
  }
};

const portList: Checker = (value, path, issues) => {
  if (!Array.isArray(value)) {
    issues.push({ path, message: `must be an array of ports, got ${describe(value)}` });
    return;
  }
  const seen = new Map<number, number>();
  value.forEach((port: unknown, index) => {
    const at = `${path}[${index}]`;
    const before = issues.length;
    integerIn(1, 65535)(port, at, issues);
    if (issues.length !== before) return;
    const first = seen.get(port as number);
    if (first !== undefined) {
      issues.push({ path: at, message: `duplicate port ${String(port)} (also at index ${first})` });
    } else {
      seen.set(port as number, index);
    }
  });
};

const URL_PATH = 'an absolute URL path starting with "/" (no spaces, query or fragment)';

const CHECKERS: { [S in ConfigSection]: { [K in keyof (typeof CONFIG_FIELDS)[S]]: Checker } } = {
  server: {
    host: matching(HOST_PATTERN, 'a host name or address without spaces'),
    port: integerIn(0, 65535),
    basePath: matching(URL_PATH_PATTERN, URL_PATH),
    wispPath: matching(URL_PATH_PATTERN, URL_PATH),
    staticDir: nonEmptyString,
  },
  transport: {
    type: oneOf(TRANSPORT_TYPES),
    url: matching(WEBSOCKET_URL_PATTERN, 'a ws:// or wss:// URL'),
    connectTimeoutMs: integerIn(1, MAX_CONNECT_TIMEOUT_MS),
  },
  security: {
    blockPrivateAddresses: boolean,
    blockedPorts: portList,
    allowedPorts: portList,
  },
  logging: {
    level: oneOf(LOG_LEVELS),
    format: oneOf(LOG_FORMATS),
  },
};

function validateSection(name: ConfigSection, value: unknown, issues: ConfigIssue[]): void {
  if (!isPlainObject(value)) {
    issues.push({ path: name, message: `must be an object, got ${describe(value)}` });
    return;
  }
  const checkers = CHECKERS[name] as Record<string, Checker>;
  for (const [key, child] of Object.entries(value)) {
    const path = join(name, key);
    const check = checkers[key];
    if (!check) {
      issues.push({
        path,
        message: `is not a known setting; expected one of ${list(Object.keys(checkers))}`,
      });
    } else {
      check(child, path, issues);
    }
  }
}

/**
 * Check config input (what a file may contain, before defaults) and return every issue found.
 * An empty array means the input is valid.
 */
export function validateConfig(input: unknown): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  if (!isPlainObject(input)) {
    issues.push({ path: '', message: `config must be an object, got ${describe(input)}` });
    return issues;
  }
  for (const [key, value] of Object.entries(input)) {
    if (key === '$schema') {
      if (typeof value !== 'string') {
        issues.push({ path: key, message: `must be a string, got ${describe(value)}` });
      }
    } else if (Object.hasOwn(CONFIG_FIELDS, key)) {
      validateSection(key as ConfigSection, value, issues);
    } else {
      issues.push({
        path: key,
        message: `is not a known section; expected one of ${list(Object.keys(CONFIG_FIELDS))}`,
      });
    }
  }

  const transport = input.transport;
  if (isPlainObject(transport) && transport.type === 'wisp' && transport.url === undefined) {
    issues.push({ path: 'transport.url', message: 'is required when transport.type is "wisp"' });
  }
  return issues;
}

/** Type guard form of `validateConfig()`. */
export function isValidConfig(input: unknown): input is IridiumConfigInput {
  return validateConfig(input).length === 0;
}
