import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyEnvOverrides,
  ConfigError,
  envOverrides,
  resolveConfig,
  toEnvSegment,
} from '../src/index.ts';

describe('environment overrides', () => {
  it('derives one variable per setting', () => {
    const names = envOverrides().map((o) => o.name);
    assert.equal(names.length, 13);
    assert.ok(names.includes('IRIDIUM_SERVER__PORT'));
    assert.ok(names.includes('IRIDIUM_SERVER__WISP_PATH'));
    assert.ok(names.includes('IRIDIUM_TRANSPORT__CONNECT_TIMEOUT_MS'));
    assert.ok(names.includes('IRIDIUM_SECURITY__BLOCK_PRIVATE_ADDRESSES'));
    assert.equal(toEnvSegment('connectTimeoutMs'), 'CONNECT_TIMEOUT_MS');
  });

  it('converts values to the type each setting takes', () => {
    const config = resolveConfig(
      {},
      {
        env: {
          IRIDIUM_SERVER__PORT: '9000',
          IRIDIUM_SERVER__HOST: ' 127.0.0.1 ',
          IRIDIUM_SECURITY__BLOCK_PRIVATE_ADDRESSES: 'off',
          IRIDIUM_SECURITY__BLOCKED_PORTS: '25, 2525',
          IRIDIUM_SECURITY__ALLOWED_PORTS: '[80,443]',
          IRIDIUM_LOGGING__FORMAT: 'json',
        },
      },
    );
    assert.equal(config.server.port, 9000);
    assert.equal(config.server.host, '127.0.0.1');
    assert.equal(config.security.blockPrivateAddresses, false);
    assert.deepEqual(config.security.blockedPorts, [25, 2525]);
    assert.deepEqual(config.security.allowedPorts, [80, 443]);
    assert.equal(config.logging.format, 'json');
  });

  it('wins over file values and keeps the rest of the section', () => {
    const input = { server: { port: 3000, basePath: '/app/' } };
    const config = resolveConfig(input, { env: { IRIDIUM_SERVER__PORT: '4000' } });
    assert.equal(config.server.port, 4000);
    assert.equal(config.server.basePath, '/app/');
    assert.equal(input.server.port, 3000, 'input is not mutated');
  });

  it('can complete a section, such as a wisp url set only in the environment', () => {
    const config = resolveConfig(
      { transport: { type: 'wisp' } },
      { env: { IRIDIUM_TRANSPORT__URL: 'wss://wisp.example.org/wisp/' } },
    );
    assert.equal(config.transport.url, 'wss://wisp.example.org/wisp/');
  });

  it('ignores empty values, other prefixes, and names without a double underscore', () => {
    const { input, issues, applied } = applyEnvOverrides(
      {},
      { IRIDIUM_SERVER__PORT: '', IRIDIUM_CONFIG: 'x.json', IRIDIUMX_SERVER__PORT: '1', PORT: '2' },
    );
    assert.deepEqual(input, {});
    assert.deepEqual(issues, []);
    assert.equal(applied.size, 0);
  });

  it('reports unknown names and unconvertible values with the variable name', () => {
    assert.throws(
      () =>
        resolveConfig(
          {},
          {
            env: {
              IRIDIUM_SERVER__LISTEN: '1',
              IRIDIUM_SERVER__PORT: 'eighty',
              IRIDIUM_SECURITY__BLOCK_PRIVATE_ADDRESSES: 'maybe',
              IRIDIUM_SECURITY__BLOCKED_PORTS: '25;465',
            },
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof ConfigError);
        assert.deepEqual(
          error.issues.map((i) => i.path),
          [
            'server.port',
            'security.blockPrivateAddresses',
            'security.blockedPorts',
            'env.IRIDIUM_SERVER__LISTEN',
          ],
        );
        assert.match(
          error.message,
          /server\.port: must be an integer, got "eighty" from IRIDIUM_SERVER__PORT/,
        );
        return true;
      },
    );
  });

  it('names the variable when a converted value fails validation', () => {
    assert.throws(
      () =>
        resolveConfig(
          {},
          { env: { IRIDIUM_SERVER__PORT: '70000', IRIDIUM_SECURITY__ALLOWED_PORTS: '80,0' } },
        ),
      (error: unknown) => {
        assert.ok(error instanceof ConfigError);
        assert.deepEqual(error.issues, [
          {
            path: 'server.port',
            message: 'must be between 0 and 65535, got 70000 (from IRIDIUM_SERVER__PORT)',
          },
          {
            path: 'security.allowedPorts[1]',
            message: 'must be between 1 and 65535, got 0 (from IRIDIUM_SECURITY__ALLOWED_PORTS)',
          },
        ]);
        return true;
      },
    );
  });

  it('supports a custom prefix and can be turned off', () => {
    const env = { APP_LOGGING__LEVEL: 'debug', IRIDIUM_LOGGING__LEVEL: 'warn' };
    assert.equal(resolveConfig({}, { env, envPrefix: 'APP_' }).logging.level, 'debug');
    assert.equal(resolveConfig({}, { env }).logging.level, 'warn');
    assert.equal(resolveConfig({}, { env: false }).logging.level, 'info');
  });
});
