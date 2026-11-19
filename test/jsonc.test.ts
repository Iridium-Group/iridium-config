import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConfigError, parseJsonc } from '../src/index.ts';

describe('parseJsonc', () => {
  it('parses plain JSON', () => {
    assert.deepEqual(parseJsonc('{"server":{"port":1}}'), { server: { port: 1 } });
  });

  it('ignores line and block comments, a BOM, and trailing commas', () => {
    const text = `\uFEFF{
      // where to listen
      "server": { "port": 9000, /* inline */ },
      /* multi
         line */
      "security": { "blockedPorts": [25, 465,], },
    }`;
    assert.deepEqual(parseJsonc(text), {
      server: { port: 9000 },
      security: { blockedPorts: [25, 465] },
    });
  });

  it('leaves comment markers and commas inside strings alone', () => {
    const text = '{"a": "ws://x//y /* z */", "b": "q\\" // ,}", "c": ",]"}';
    assert.deepEqual(parseJsonc(text), { a: 'ws://x//y /* z */', b: 'q" // ,}', c: ',]' });
  });

  it('reports the line and column of a syntax error', () => {
    const text = '{\n  // fine\n  "server": { "port": 80 }\n  "logging": {}\n}';
    assert.throws(
      () => parseJsonc(text, 'iridium.config.json'),
      (error: unknown) => {
        assert.ok(error instanceof ConfigError);
        assert.equal(error.source, 'iridium.config.json');
        assert.match(error.issues[0]?.message ?? '', /^invalid JSON at line 4, column 3/);
        return true;
      },
    );
  });

  it('rejects empty files and unterminated comments', () => {
    assert.throws(() => parseJsonc('  // nothing\n'), /file is empty/);
    assert.throws(() => parseJsonc('{ /* open'), /unterminated block comment at line 1, column 3/);
  });
});
