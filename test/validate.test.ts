import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyDefaults, DEFAULT_CONFIG, isValidConfig, validateConfig } from '../src/index.ts';

describe('validateConfig', () => {
  it('accepts an empty config', () => {
    assert.deepEqual(validateConfig({}), []);
    assert.equal(isValidConfig({}), true);
  });

  it('rejects input that is not an object', () => {
    for (const value of [null, 'config', 42, [], undefined]) {
      const issues = validateConfig(value);
      assert.equal(issues.length, 1);
      assert.equal(issues[0]?.path, '');
      assert.match(issues[0]?.message ?? '', /config must be an object/);
    }
  });

  it('reports every issue, not just the first', () => {
    const issues = validateConfig({
      server: { port: -1, host: '' },
      transport: { type: 'wisp' },
      logging: { level: 'loud' },
    });
    assert.deepEqual(
      issues.map((i) => i.path),
      ['server.port', 'server.host', 'logging.level', 'transport.url'],
    );
  });

  it('writes messages that say what was expected and what was found', () => {
    const [port] = validateConfig({ server: { port: '8080' } });
    assert.equal(port?.message, 'must be an integer, got "8080"');
    const [range] = validateConfig({ transport: { connectTimeoutMs: 999999 } });
    assert.equal(range?.message, 'must be between 1 and 300000, got 999999');
    const [type] = validateConfig({ transport: { type: 'socks' } });
    assert.equal(type?.message, 'must be one of "direct", "wisp", "memory", got "socks"');
  });

  it('names the known settings when one is misspelled', () => {
    const [issue] = validateConfig({ security: { blockPrivateAddress: true } });
    assert.equal(issue?.path, 'security.blockPrivateAddress');
    assert.match(
      issue?.message ?? '',
      /not a known setting; expected one of "blockPrivateAddresses"/,
    );
  });

  it('locates bad entries inside port lists by index', () => {
    const issues = validateConfig({ security: { blockedPorts: [25, 'smtp', 25, 99999] } });
    assert.deepEqual(issues, [
      { path: 'security.blockedPorts[1]', message: 'must be an integer, got "smtp"' },
      { path: 'security.blockedPorts[2]', message: 'duplicate port 25 (also at index 0)' },
      { path: 'security.blockedPorts[3]', message: 'must be between 1 and 65535, got 99999' },
    ]);
  });

  it('requires a ws:// or wss:// url for the wisp transport only', () => {
    assert.deepEqual(validateConfig({ transport: { type: 'direct' } }), []);
    assert.deepEqual(validateConfig({ transport: { type: 'memory' } }), []);
    assert.deepEqual(validateConfig({ transport: { type: 'wisp', url: 'ws://127.0.0.1:1/' } }), []);
    assert.deepEqual(validateConfig({ transport: { type: 'wisp' } }), [
      { path: 'transport.url', message: 'is required when transport.type is "wisp"' },
    ]);
    assert.equal(validateConfig({ transport: { url: 'http://example.org/' } }).length, 1);
  });

  it('checks URL paths', () => {
    assert.deepEqual(validateConfig({ server: { basePath: '/', wispPath: '/a/b/' } }), []);
    assert.equal(validateConfig({ server: { basePath: 'a/' } })[0]?.path, 'server.basePath');
    assert.equal(validateConfig({ server: { wispPath: '/w#x' } })[0]?.path, 'server.wispPath');
  });

  it('does not read inherited properties', () => {
    const input = Object.create({ bogus: {} }) as Record<string, unknown>;
    input.server = { port: 1 };
    assert.deepEqual(validateConfig(input), []);
    assert.equal(validateConfig(JSON.parse('{"__proto__": {}}'))[0]?.path, '__proto__');
  });
});

describe('applyDefaults', () => {
  it('fills every setting and matches the transport package defaults', () => {
    const config = applyDefaults({});
    assert.deepEqual(config, {
      server: {
        host: '0.0.0.0',
        port: 8080,
        basePath: '/',
        wispPath: '/wisp/',
        staticDir: 'public',
      },
      transport: { type: 'direct', connectTimeoutMs: 10000 },
      security: { blockPrivateAddresses: true, blockedPorts: [25, 465, 587] },
      logging: { level: 'info', format: 'pretty' },
    });
  });

  it('keeps given values, including empty lists and false', () => {
    const config = applyDefaults({
      security: { blockPrivateAddresses: false, blockedPorts: [] },
      server: { port: 0 },
    });
    assert.equal(config.security.blockPrivateAddresses, false);
    assert.deepEqual(config.security.blockedPorts, []);
    assert.equal(config.server.port, 0);
    assert.equal(config.server.host, '0.0.0.0');
  });

  it('never shares arrays with the input or the frozen defaults', () => {
    const input = { security: { allowedPorts: [443] } };
    const config = applyDefaults(input);
    config.security.allowedPorts?.push(80);
    config.security.blockedPorts.push(2525);
    assert.deepEqual(input.security.allowedPorts, [443]);
    assert.deepEqual(DEFAULT_CONFIG.security.blockedPorts, [25, 465, 587]);
    assert.ok(Object.isFrozen(DEFAULT_CONFIG.security.blockedPorts));
  });
});
