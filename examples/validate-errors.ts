/**
 * What a broken config reports: one ConfigError with every issue and its path.
 *
 *   node examples/validate-errors.ts
 */
import { ConfigError, resolveConfig, validateConfig } from '../src/index.ts';

const broken = {
  server: { port: '8080', basePath: 'proxy/' },
  transport: { type: 'wisp' },
  security: { blockedPorts: [25, 25, 70000] },
  logging: { levl: 'debug' },
};

for (const issue of validateConfig(broken)) {
  console.log(`${issue.path}: ${issue.message}`);
}

console.log();

try {
  resolveConfig(broken, { env: { IRIDIUM_SERVER__HOST: 'two words' } });
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.log(error.message);
}
