import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { Ajv2020, type ErrorObject } from 'ajv/dist/2020.js';
import {
  CONFIG_FIELDS,
  DEFAULT_CONFIG,
  LOG_FORMATS,
  LOG_LEVELS,
  TRANSPORT_TYPES,
} from '../src/index.ts';
import { validateConfig } from '../src/validate.ts';

const schemaUrl = new URL('../schema/iridium.schema.json', import.meta.url);
const schema = JSON.parse(readFileSync(schemaUrl, 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
const schemaValidate = ajv.compile(schema);

function fixtures(kind: 'valid' | 'invalid'): Array<[string, unknown]> {
  const dir = new URL(`./fixtures/${kind}/`, import.meta.url);
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => [name, JSON.parse(readFileSync(new URL(name, dir), 'utf8'))]);
}

/** Turn an Ajv error into the dotted path style the validator uses. */
function ajvPath(error: ErrorObject): string {
  let path = error.instancePath
    .split('/')
    .slice(1)
    .map((part) => (/^\d+$/.test(part) ? `[${part}]` : `.${part}`))
    .join('')
    .replace(/^\./, '');
  const extra =
    (error.params as { additionalProperty?: string }).additionalProperty ??
    (error.params as { missingProperty?: string }).missingProperty;
  if (extra) path = path ? `${path}.${extra}` : extra;
  return path;
}

function schemaPaths(value: unknown): Set<string> {
  schemaValidate(value);
  return new Set((schemaValidate.errors ?? []).map(ajvPath));
}

const EXPECTED_PATHS: Record<string, string[]> = {
  'bad-log-level.json': ['logging.level', 'logging.format'],
  'base-path-relative.json': ['server.basePath'],
  'block-private-string.json': ['security.blockPrivateAddresses'],
  'blocked-ports-not-array.json': ['security.blockedPorts'],
  'duplicate-port.json': ['security.allowedPorts[2]'],
  'host-with-space.json': ['server.host'],
  'port-float.json': ['server.port'],
  'port-string.json': ['server.port'],
  'port-too-high.json': ['server.port'],
  'port-zero-in-list.json': ['security.blockedPorts[0]'],
  'root-array.json': [''],
  'schema-not-string.json': ['$schema'],
  'section-not-object.json': ['logging'],
  'static-dir-empty.json': ['server.staticDir'],
  'timeout-zero.json': ['transport.connectTimeoutMs'],
  'unknown-section.json': ['proxy'],
  'unknown-setting.json': ['server.listen'],
  'unknown-transport.json': ['transport.type'],
  'url-http.json': ['transport.url'],
  'wisp-path-query.json': ['server.wispPath'],
  'wisp-without-url.json': ['transport.url'],
};

describe('JSON Schema and validator agree', () => {
  it('both accept every valid fixture', () => {
    const valid = fixtures('valid');
    assert.ok(valid.length >= 5);
    for (const [name, value] of valid) {
      assert.deepEqual(validateConfig(value), [], `validator rejected ${name}`);
      assert.equal(
        schemaValidate(value),
        true,
        `schema rejected ${name}: ${ajv.errorsText(schemaValidate.errors)}`,
      );
    }
  });

  it('both reject every invalid fixture, at the same paths', () => {
    const invalid = fixtures('invalid');
    assert.deepEqual(
      invalid.map(([name]) => name),
      Object.keys(EXPECTED_PATHS).sort(),
    );
    for (const [name, value] of invalid) {
      const paths = validateConfig(value).map((issue) => issue.path);
      assert.deepEqual(paths, EXPECTED_PATHS[name], `validator paths for ${name}`);
      assert.equal(schemaValidate(value), false, `schema accepted ${name}`);
      const fromSchema = schemaPaths(value);
      for (const path of paths) {
        // uniqueItems is reported on the array itself by JSON Schema.
        const parent = path.replace(/\[\d+\]$/, '');
        assert.ok(
          fromSchema.has(path) || fromSchema.has(parent),
          `schema has no error at ${path} for ${name}: ${[...fromSchema].join(', ')}`,
        );
      }
    }
  });

  it('agree on 500 generated configs', () => {
    // Deterministic generator: mixes valid values with near-misses for every setting.
    let seed = 0x1d1d1;
    const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const pick = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)] as T;
    const ports = [0, 1, 80, 443, 65535, 65536, -1, 8.5, '80', null];
    const portLists = [[], [80], [80, 443], [80, 80], [0], [70000], ['443'], 'all', null];
    const candidates: Record<string, Record<string, unknown[]>> = {
      server: {
        host: ['0.0.0.0', '::', 'localhost', '', 'two words', 1],
        port: ports,
        basePath: ['/', '/a/b/', '', 'a/', '/a b', '/x#y', 5],
        wispPath: ['/wisp/', '/wisp', 'wisp/', '/w?x', null],
        staticDir: ['public', './dist', '', 0],
        bogus: [true],
      },
      transport: {
        type: [...TRANSPORT_TYPES, 'Direct', 'socks', 1],
        url: ['ws://h', 'wss://h:1/p?q', 'http://h', 'ws://', 'ws:// h', 3],
        connectTimeoutMs: [1, 1000, 300000, 300001, 0, 1.5, '5'],
      },
      security: {
        blockPrivateAddresses: [true, false, 'true', 0],
        blockedPorts: portLists,
        allowedPorts: portLists,
      },
      logging: {
        level: [...LOG_LEVELS, 'trace', ''],
        format: [...LOG_FORMATS, 'text'],
      },
    };
    let accepted = 0;
    for (let n = 0; n < 500; n++) {
      const config: Record<string, unknown> = {};
      for (const [section, fields] of Object.entries(candidates)) {
        const roll = random();
        if (roll < 0.2) continue;
        if (roll < 0.23) {
          config[section] = pick([null, 'x', [], 4]);
          continue;
        }
        const body: Record<string, unknown> = {};
        for (const [key, values] of Object.entries(fields)) {
          if (random() < (key === 'bogus' ? 0.03 : 0.4)) body[key] = pick(values);
        }
        config[section] = body;
      }
      if (random() < 0.03) config.extra = {};
      const ours = validateConfig(config).length === 0;
      const theirs = schemaValidate(config);
      assert.equal(ours, theirs, `disagree on ${JSON.stringify(config)}`);
      if (ours) accepted++;
    }
    assert.ok(accepted > 25 && accepted < 475, `generator too one-sided (${accepted} accepted)`);
  });

  it('lists the same sections and settings as the validator and the defaults', () => {
    const sections = Object.keys(schema.properties).filter((key) => key !== '$schema');
    assert.deepEqual(sections, Object.keys(CONFIG_FIELDS));
    for (const [section, fields] of Object.entries(CONFIG_FIELDS)) {
      const props = schema.properties[section].properties;
      assert.deepEqual(Object.keys(props), Object.keys(fields), `settings of ${section}`);
      const defaults =
        (DEFAULT_CONFIG as unknown as Record<string, Record<string, unknown>>)[section] ?? {};
      for (const key of Object.keys(fields)) {
        assert.deepEqual(props[key].default, defaults[key], `default for ${section}.${key}`);
      }
    }
  });

  it('uses the same enums as the validator', () => {
    assert.deepEqual(schema.properties.transport.properties.type.enum, [...TRANSPORT_TYPES]);
    assert.deepEqual(schema.properties.logging.properties.level.enum, [...LOG_LEVELS]);
    assert.deepEqual(schema.properties.logging.properties.format.enum, [...LOG_FORMATS]);
  });
});
