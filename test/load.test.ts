import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, before, describe, it } from 'node:test';
import { ConfigError, defineConfig, loadConfig, loadConfigSync } from '../src/index.ts';

let dir = '';
const file = (name: string, text: string): string => {
  const path = join(dir, name);
  writeFileSync(path, text);
  return path;
};

async function rejectsWith(promise: Promise<unknown>, check: (error: ConfigError) => void) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof ConfigError, String(error));
    check(error);
    return true;
  });
}

describe('loadConfig', () => {
  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'iridium-config-'));
  });
  after(() => rmSync(dir, { recursive: true, force: true }));

  it('loads a .json file, ignores $schema, and fills defaults', async () => {
    const path = file(
      'a.json',
      JSON.stringify({
        $schema: './schema.json',
        server: { port: 3000 },
        transport: { type: 'memory' },
      }),
    );
    const config = await loadConfig(path, { env: false });
    assert.equal(config.server.port, 3000);
    assert.equal(config.transport.type, 'memory');
    assert.equal(config.logging.level, 'info');
    assert.equal('$schema' in config, false);
  });

  it('loads .jsonc with comments, from a relative path or a file URL', async () => {
    file('b.jsonc', '{\n  // tests\n  "logging": { "level": "silent", },\n}\n');
    assert.equal((await loadConfig('b.jsonc', { env: false, cwd: dir })).logging.level, 'silent');
    const url = pathToFileURL(join(dir, 'b.jsonc'));
    assert.equal((await loadConfig(url, { env: false })).logging.level, 'silent');
  });

  it('accepts an object and does not change it', async () => {
    const input = defineConfig({ security: { allowedPorts: [443] } });
    const config = await loadConfig(input, { env: { IRIDIUM_SECURITY__ALLOWED_PORTS: '80' } });
    assert.deepEqual(config.security.allowedPorts, [80]);
    assert.deepEqual(input.security?.allowedPorts, [443]);
  });

  it('throws one ConfigError listing every issue with the file name', async () => {
    const path = file(
      'bad.json',
      JSON.stringify({ server: { port: 'x', extra: 1 }, transport: { type: 'wisp' } }),
    );
    await rejectsWith(loadConfig(path, { env: false }), (error) => {
      assert.equal(error.source, path);
      assert.deepEqual(
        error.issues.map((i) => i.path),
        ['server.port', 'server.extra', 'transport.url'],
      );
      assert.equal(error.message.split('\n')[0], `Invalid Iridium config in ${path} (3 issues):`);
      assert.match(
        error.message,
        /\n {2}- transport\.url: is required when transport\.type is "wisp"/,
      );
    });
  });

  it('reports missing files, unsupported types, and empty paths', async () => {
    await rejectsWith(loadConfig(join(dir, 'missing.json'), { env: false }), (error) => {
      assert.equal(error.issues[0]?.message, 'file not found');
      assert.equal((error.cause as { code?: string }).code, 'ENOENT');
    });
    await rejectsWith(loadConfig(file('c.yaml', 'a: 1'), { env: false }), (error) => {
      assert.match(
        error.issues[0]?.message ?? '',
        /unsupported file type "\.yaml"; use \.json or \.jsonc/,
      );
    });
    await rejectsWith(loadConfig('  ', { env: false }), (error) => {
      assert.equal(error.issues[0]?.message, 'config path must not be empty');
    });
  });

  it('with no source, uses IRIDIUM_CONFIG, then iridium.config.json, then defaults', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'iridium-config-empty-'));
    try {
      const fallback = await loadConfig(undefined, { cwd: empty, env: {} });
      assert.equal(fallback.server.port, 8080);
      await rejectsWith(
        loadConfig(undefined, { cwd: empty, env: { IRIDIUM_CONFIG: 'nope.json' } }),
        (error) => {
          assert.equal(error.issues[0]?.message, 'file not found');
        },
      );
      file('iridium.config.json', '{ "server": { "port": 1234 } }');
      assert.equal((await loadConfig(undefined, { cwd: dir, env: {} })).server.port, 1234);
      file('other.json', '{ "server": { "port": 4321 } }');
      const named = await loadConfig(undefined, {
        cwd: dir,
        env: { IRIDIUM_CONFIG: 'other.json' },
      });
      assert.equal(named.server.port, 4321);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('applies environment overrides on top of the file', async () => {
    const path = file('d.json', '{ "server": { "port": 3000, "host": "127.0.0.1" } }');
    const config = await loadConfig(path, { env: { IRIDIUM_SERVER__PORT: '3001' } });
    assert.equal(config.server.port, 3001);
    assert.equal(config.server.host, '127.0.0.1');
  });

  it('has a synchronous form with the same behaviour', () => {
    const path = file('e.json', '{ "transport": { "type": "wisp", "url": "ws://127.0.0.1:1/" } }');
    assert.equal(loadConfigSync(path, { env: false }).transport.url, 'ws://127.0.0.1:1/');
    assert.throws(() => loadConfigSync(file('f.json', '[1]'), { env: false }), ConfigError);
    assert.equal(loadConfigSync({}, { env: false }).transport.type, 'direct');
  });
});
