import type { IridiumConfig, IridiumConfigInput } from './types.ts';

/** Ports blocked by default, matching `DEFAULT_BLOCKED_PORTS` in `@iridium-group/transport`. */
export const DEFAULT_BLOCKED_PORTS: readonly number[] = Object.freeze([25, 465, 587]);

/** Every default, as one config. Frozen; `applyDefaults()` returns fresh copies. */
export const DEFAULT_CONFIG: Readonly<IridiumConfig> = deepFreeze({
  server: {
    host: '0.0.0.0',
    port: 8080,
    basePath: '/',
    wispPath: '/wisp/',
    staticDir: 'public',
  },
  transport: {
    type: 'direct',
    connectTimeoutMs: 10_000,
  },
  security: {
    blockPrivateAddresses: true,
    blockedPorts: [...DEFAULT_BLOCKED_PORTS],
  },
  logging: {
    level: 'info',
    format: 'pretty',
  },
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function copy<T>(value: T): T {
  return Array.isArray(value) ? (value.slice() as T) : value;
}

function section<T extends object>(defaults: T, given: Partial<T> | undefined): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(defaults)) out[key] = copy(value);
  for (const [key, value] of Object.entries(given ?? {})) {
    if (value !== undefined) out[key] = copy(value);
  }
  return out as T;
}

/**
 * Fill in every missing setting. Expects input that already passed `validateConfig()`.
 * Never mutates its argument; the result shares no arrays with the input or the defaults.
 */
export function applyDefaults(input: IridiumConfigInput = {}): IridiumConfig {
  return {
    server: section(DEFAULT_CONFIG.server, input.server),
    transport: section(DEFAULT_CONFIG.transport, input.transport),
    security: section(DEFAULT_CONFIG.security, input.security),
    logging: section(DEFAULT_CONFIG.logging, input.logging),
  };
}
