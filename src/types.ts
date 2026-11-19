/** Which transport an Iridium server or client uses to open connections. */
export type TransportType = 'direct' | 'wisp' | 'memory';

/** Log levels, from quietest to most verbose. */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

/** `pretty` for humans, `json` for one JSON object per line. */
export type LogFormat = 'pretty' | 'json';

/** The `server` section: where an Iridium proxy server listens and what it serves. */
export interface ServerConfig {
  /** Interface to listen on. Default `"0.0.0.0"`. */
  host: string;
  /** TCP port to listen on, 0 to 65535 (0 picks a free port). Default `8080`. */
  port: number;
  /** URL path prefix the server is mounted under. Default `"/"`. */
  basePath: string;
  /** URL path of the Wisp WebSocket endpoint. Default `"/wisp/"`. */
  wispPath: string;
  /** Directory of static client files to serve. Default `"public"`. */
  staticDir: string;
}

/** The `transport` section. Matches what `createTransport()` in `@iridium-group/transport` reads. */
export interface TransportConfig {
  /** Default `"direct"`. */
  type: TransportType;
  /** `ws://` or `wss://` URL of the Wisp server. Required when `type` is `"wisp"`. */
  url?: string;
  /** Connect timeout in milliseconds, 1 to 300000. Default `10000`. */
  connectTimeoutMs: number;
}

/** The `security` section. Matches `AddressPolicy` in `@iridium-group/transport`. */
export interface SecurityConfig {
  /** Reject targets that resolve to private or special-purpose addresses. Default `true`. */
  blockPrivateAddresses: boolean;
  /** Ports that are always rejected. Default `[25, 465, 587]`. */
  blockedPorts: number[];
  /** When set, only these ports are accepted. Not set by default. */
  allowedPorts?: number[];
}

/** The `logging` section. */
export interface LoggingConfig {
  /** Default `"info"`. */
  level: LogLevel;
  /** Default `"pretty"`. */
  format: LogFormat;
}

/** A fully resolved Iridium config: every default filled in. */
export interface IridiumConfig {
  server: ServerConfig;
  transport: TransportConfig;
  security: SecurityConfig;
  logging: LoggingConfig;
}

/** What a config file may contain. Every section and field is optional. */
export interface IridiumConfigInput {
  /** Editor hint pointing at the JSON Schema. Ignored by the loader. */
  $schema?: string;
  server?: Partial<ServerConfig>;
  transport?: Partial<TransportConfig>;
  security?: Partial<SecurityConfig>;
  logging?: Partial<LoggingConfig>;
}
