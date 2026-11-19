/**
 * Load the example config, with any IRIDIUM_* variables from your shell applied on top.
 *
 *   node examples/load-config.ts
 *   IRIDIUM_SERVER__PORT=9000 IRIDIUM_LOGGING__FORMAT=json node examples/load-config.ts
 */
import { ConfigError, loadConfig } from '../src/index.ts';

try {
  const config = await loadConfig(new URL('./iridium.config.jsonc', import.meta.url));
  console.log(JSON.stringify(config, null, 2));
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
