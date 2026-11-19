/** One problem found in a config, located by a path such as `server.port` or `security.blockedPorts[1]`. */
export interface ConfigIssue {
  /** Dotted path to the offending value. An empty string means the whole config (or the file itself). */
  path: string;
  /** What is wrong, phrased to follow the path: `server.port: must be an integer`. */
  message: string;
}

/** Render issues as the lines used in `ConfigError.message`. */
export function formatIssues(issues: readonly ConfigIssue[], source?: string): string {
  const where = source ? ` in ${source}` : '';
  const count = issues.length === 1 ? '1 issue' : `${issues.length} issues`;
  const lines = issues.map((issue) => `  - ${issue.path || '(root)'}: ${issue.message}`);
  return [`Invalid Iridium config${where} (${count}):`, ...lines].join('\n');
}

/** Thrown when a config cannot be read, parsed, or validated. Carries every issue found. */
export class ConfigError extends Error {
  readonly issues: readonly ConfigIssue[];
  /** The file the config came from, when it came from a file. */
  readonly source: string | undefined;

  constructor(
    issues: readonly ConfigIssue[],
    options: { source?: string | undefined; cause?: unknown } = {},
  ) {
    super(formatIssues(issues, options.source), { cause: options.cause });
    this.name = 'ConfigError';
    this.issues = Object.freeze(issues.map((issue) => ({ ...issue })));
    this.source = options.source;
  }
}

export function isConfigError(value: unknown): value is ConfigError {
  return value instanceof ConfigError;
}
