import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const attributesPath = resolve(import.meta.dir, '../../../..', '.gitattributes');

test('checks repository text out as LF on every desktop build host', () => {
  const attributes = readFileSync(attributesPath, 'utf8');

  expect(attributes).toContain('* text=auto eol=lf');
  for (const extension of ['png', 'ico', 'icns', 'pdf', 'zip', 'exe']) {
    expect(attributes).toContain(`*.${extension} binary`);
  }
});
