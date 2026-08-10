import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPeerTool } from '../../src/runtime/peer-tools';

test('keeps Peer routing and evidence ownership at the tool boundary', () => {
  const tool = createPeerTool(
    '/unused',
    {
      sessionKind: 'free-learning',
      title: '自由学习',
      createdAt: '2026-08-10T10:00:00.000Z',
      selectedAssets: [],
    },
    { getSessionId: () => 'free-001', getBranch: () => [] },
    async () => '一起想想。',
  );
  const description = tool.description;

  expect(description).toContain('explicitly invites');
  expect(description).toContain('explicitly accepts');
  expect(description).toContain('ordinary mention');
  expect(description).toContain('teaching help, not student evidence');
  expect(description).toContain('actual student evidence');
  expect(description).toContain('later response after Peer help');
  expect(description).toContain('preserve that help boundary');

  const skill = readFileSync(join(
    import.meta.dir,
    '../../resources/skills/free-learning/SKILL.md',
  ), 'utf8');
  expect(skill).not.toContain('ask_peer');
  expect(skill).not.toContain('## AI 同学');

  const persona = readFileSync(join(
    import.meta.dir,
    '../../resources/peers/axia.md',
  ), 'utf8');
  expect(persona).toContain('阿夏');
  expect(persona).toContain('先用自然语言说明这一步做了什么、得到什么，再展示公式');
  expect(persona).not.toContain('阿澄');
});
