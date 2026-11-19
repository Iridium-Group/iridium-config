/**
 * The settings a config may contain, by section, with the kind of value each takes.
 * Environment overrides are derived from this table; the validator and the JSON Schema are
 * written by hand and tested against it.
 */
export type FieldKind = 'string' | 'integer' | 'boolean' | 'portList';

export const CONFIG_FIELDS = {
  server: {
    host: 'string',
    port: 'integer',
    basePath: 'string',
    wispPath: 'string',
    staticDir: 'string',
  },
  transport: {
    type: 'string',
    url: 'string',
    connectTimeoutMs: 'integer',
  },
  security: {
    blockPrivateAddresses: 'boolean',
    blockedPorts: 'portList',
    allowedPorts: 'portList',
  },
  logging: {
    level: 'string',
    format: 'string',
  },
} as const satisfies Record<string, Record<string, FieldKind>>;

export type ConfigSection = keyof typeof CONFIG_FIELDS;

export const CONFIG_SECTIONS = Object.keys(CONFIG_FIELDS) as ConfigSection[];

export const TRANSPORT_TYPES = ['direct', 'wisp', 'memory'] as const;
export const LOG_LEVELS = ['silent', 'error', 'warn', 'info', 'debug'] as const;
export const LOG_FORMATS = ['pretty', 'json'] as const;

/** Absolute URL path: starts with "/", no whitespace, query or fragment. */
export const URL_PATH_PATTERN = /^\/[^\s?#]*$/;
/** A ws:// or wss:// URL with a host. */
export const WEBSOCKET_URL_PATTERN = /^wss?:\/\/[^\s/?#]+\S*$/;
/** A host name or address with no whitespace. */
export const HOST_PATTERN = /^\S+$/;

export const MAX_CONNECT_TIMEOUT_MS = 300_000;
