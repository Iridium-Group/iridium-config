import { ConfigError } from './errors.ts';

/**
 * Replace comments and trailing commas with spaces, keeping every other character (and every
 * newline) where it was, so JSON.parse error positions still point at the right place.
 */
export function stripJsonComments(text: string): string {
  const out = text.split('');
  let i = 0;
  const blank = (from: number, to: number) => {
    for (let j = from; j < to; j++) if (out[j] !== '\n' && out[j] !== '\r') out[j] = ' ';
  };
  // Index of the last comma seen outside a string, while only whitespace or comments follow it.
  let pendingComma = -1;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      pendingComma = -1;
      i++;
      while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
      i++;
    } else if (ch === '/' && next === '/') {
      const end = text.indexOf('\n', i);
      const stop = end === -1 ? text.length : end;
      blank(i, stop);
      i = stop;
    } else if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end === -1) {
        const { line, column } = lineAndColumn(text, i);
        throw new ConfigError([
          { path: '', message: `unterminated block comment at line ${line}, column ${column}` },
        ]);
      }
      blank(i, end + 2);
      i = end + 2;
    } else if (ch === ',') {
      pendingComma = i;
      i++;
    } else if ((ch === '}' || ch === ']') && pendingComma !== -1) {
      out[pendingComma] = ' ';
      pendingComma = -1;
      i++;
    } else {
      if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r') pendingComma = -1;
      i++;
    }
  }
  return out.join('');
}

function lineAndColumn(text: string, position: number): { line: number; column: number } {
  const before = text.slice(0, position);
  const line = before.split('\n').length;
  const column = position - before.lastIndexOf('\n');
  return { line, column };
}

/**
 * Parse JSON that may contain `//` and `/* *\/` comments and trailing commas (the format of
 * tsconfig.json and VS Code settings). Throws `ConfigError` with a line and column on bad input.
 */
export function parseJsonc(text: string, source?: string): unknown {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let stripped: string;
  try {
    stripped = stripJsonComments(body);
  } catch (error) {
    if (error instanceof ConfigError) throw new ConfigError(error.issues, { source });
    throw error;
  }
  if (stripped.trim() === '') {
    throw new ConfigError([{ path: '', message: 'file is empty' }], { source });
  }
  try {
    return JSON.parse(stripped);
  } catch (cause) {
    const raw = cause instanceof Error ? cause.message : String(cause);
    const match = /position (\d+)/.exec(raw);
    let message = `invalid JSON: ${raw.replace(/\s*\(line \d+ column \d+\)/, '')}`;
    if (match) {
      const { line, column } = lineAndColumn(body, Number(match[1]));
      message = `invalid JSON at line ${line}, column ${column}: ${raw
        .replace(/\s*\(line \d+ column \d+\)/, '')
        .replace(/\s*in JSON at position \d+/, '')}`;
    }
    throw new ConfigError([{ path: '', message }], { source, cause });
  }
}
