export type {
  IridiumConfig,
  IridiumConfigInput,
  LogFormat,
  LoggingConfig,
  LogLevel,
  SecurityConfig,
  ServerConfig,
  TransportConfig,
  TransportType,
} from './types.ts';
export { ConfigError, formatIssues, isConfigError } from './errors.ts';
export type { ConfigIssue } from './errors.ts';
export { applyDefaults, DEFAULT_BLOCKED_PORTS, DEFAULT_CONFIG } from './defaults.ts';
export { isValidConfig, validateConfig } from './validate.ts';
export {
  CONFIG_FIELDS,
  CONFIG_SECTIONS,
  LOG_FORMATS,
  LOG_LEVELS,
  TRANSPORT_TYPES,
} from './fields.ts';
export type { ConfigSection, FieldKind } from './fields.ts';
export { parseJsonc, stripJsonComments } from './jsonc.ts';
export {
  applyEnvOverrides,
  CONFIG_PATH_ENV,
  DEFAULT_ENV_PREFIX,
  envOverrides,
  toEnvSegment,
} from './env.ts';
export type { EnvOverride, EnvOverrideResult, EnvSource } from './env.ts';
export {
  CONFIG_EXTENSIONS,
  DEFAULT_CONFIG_FILE,
  defineConfig,
  loadConfig,
  loadConfigSync,
  resolveConfig,
} from './load.ts';
export type { ConfigSource, LoadConfigOptions } from './load.ts';
