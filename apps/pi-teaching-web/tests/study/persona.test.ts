import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolvePersona } from '../../src/study/persona';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('resolves Session, local and shared persona selection in order', () => {
  const root = mkdtempSync(join(tmpdir(), 'study-persona-'));
  roots.push(root);
  writeFileSync(join(root, 'CLAUDE.md'), '# Learning Set\n\n- Default presentation persona: `calm-senpai`\n');
  expect(resolvePersona(root).id).toBe('calm-senpai');

  writeFileSync(join(root, 'CLAUDE.local.md'), '- Preferred persona: `energetic-classmate`\n');
  mkdirSync(join(root, '.claude/personas'), { recursive: true });
  writeFileSync(join(root, '.claude/personas/energetic-classmate.md'), '# Local energetic voice\n');
  expect(resolvePersona(root)).toEqual({
    id: 'energetic-classmate',
    content: '# Local energetic voice\n',
  });

  expect(resolvePersona(root, 'neutral-tutor').id).toBe('neutral-tutor');
});
