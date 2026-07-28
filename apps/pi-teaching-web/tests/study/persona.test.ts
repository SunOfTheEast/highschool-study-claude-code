import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { personaChoices, resolvePersona } from '../../src/study/persona';

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

test('discovers public persona previews and lets a same-ID local file override a built-in', () => {
  const root = mkdtempSync(join(tmpdir(), 'study-persona-choices-'));
  roots.push(root);
  mkdirSync(join(root, '.claude/personas/assets'), { recursive: true });
  writeFileSync(join(root, '.claude/personas/assets/custom-guide.webp'), new Uint8Array([1, 2]));
  writeFileSync(join(root, '.claude/personas/custom-guide.md'), `# Custom Guide

- ID: \`custom-guide\`
- Display name: 自定义学伴
- Student preview: 先听完整思路，再给一个短提示。
- Glyph: 伴
- Accent: #48636f
- Portrait: \`.claude/personas/assets/custom-guide.webp\`

- INTERNAL: never expose this instruction
`);
  writeFileSync(join(root, '.claude/personas/calm-senpai.md'), `# Local Calm

- ID: \`calm-senpai\`
- Display name: 本地学姐
- Student preview: 这是本地覆盖的公开简介。
- Glyph: 静
- Accent: #506070
`);

  const choices = personaChoices(root);
  expect(choices.map((choice) => choice.id)).toEqual([
    'calm-senpai',
    'custom-guide',
    'energetic-classmate',
    'neutral-tutor',
  ]);
  expect(choices.find((choice) => choice.id === 'calm-senpai')).toMatchObject({
    name: '本地学姐',
    description: '这是本地覆盖的公开简介。',
    accent: '#506070',
  });
  expect(choices.find((choice) => choice.id === 'custom-guide')).toEqual({
    id: 'custom-guide',
    name: '自定义学伴',
    description: '先听完整思路，再给一个短提示。',
    glyph: '伴',
    accent: '#48636f',
    portraitUrl: '/api/personas/custom-guide/portrait',
  });
  expect(JSON.stringify(choices)).not.toContain('never expose');
});

test('uses neutral public defaults for optional metadata', () => {
  const root = mkdtempSync(join(tmpdir(), 'study-persona-defaults-'));
  roots.push(root);
  mkdirSync(join(root, '.claude/personas'), { recursive: true });
  writeFileSync(join(root, '.claude/personas/plain-guide.md'), `# Plain

- ID: \`plain-guide\`
- Display name: 朴素学伴
- Portrait: \`.claude/personas/assets/missing.webp\`
`);

  expect(personaChoices(root).find((choice) => choice.id === 'plain-guide')).toEqual({
    id: 'plain-guide',
    name: '朴素学伴',
    description: '保持清晰、自然的学习陪伴。',
    glyph: '朴',
    accent: '#3f5b54',
    portraitUrl: null,
  });
});

test('rejects mismatched local IDs and portraits outside the learning set', () => {
  const mismatch = mkdtempSync(join(tmpdir(), 'study-persona-invalid-'));
  roots.push(mismatch);
  mkdirSync(join(mismatch, '.claude/personas'), { recursive: true });
  writeFileSync(join(mismatch, '.claude/personas/file-name.md'), '- ID: `different-id`\n');
  expect(() => personaChoices(mismatch)).toThrow('PERSONA_FILE_ID_MISMATCH');

  const portrait = mkdtempSync(join(tmpdir(), 'study-persona-invalid-'));
  roots.push(portrait);
  mkdirSync(join(portrait, '.claude/personas'), { recursive: true });
  writeFileSync(
    join(portrait, '.claude/personas/outside.md'),
    '- ID: `outside`\n- Display name: 越界\n- Portrait: `../outside.webp`\n',
  );
  expect(() => personaChoices(portrait)).toThrow('PERSONA_PORTRAIT_INVALID');
});
