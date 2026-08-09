import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LearningFootprintSnapshot } from '../../src/shared/contracts';
import { FootprintPage } from '../../src/client/pages/FootprintPage';

const value: LearningFootprintSnapshot = {
  entries: [
    {
      id: 'unknown-time', at: null, activity: 'asset-created', title: '旧题卡',
      summary: '保存为题卡', route: '/assets/problem-cards/problem-old',
      source: { kind: 'asset', asset: { kind: 'problem-card', id: 'problem-old' }, revision: 1 },
    },
    {
      id: 'session', at: '2026-08-09T10:00:00.000Z', activity: 'session-start',
      title: 'Ksp 对话', summary: '开始自由学习', route: '/learn/free-001',
      source: { kind: 'session', sessionKey: 'free:free-001', phase: 'start', status: 'active' },
    },
    {
      id: 'attempt', at: '2026-08-09T10:02:00.000Z', activity: 'problem-attempt',
      title: '同离子效应', summary: '提交了一次作答', route: '/assets/problem-cards/problem-001',
      source: {
        kind: 'problem-activity', cardId: 'problem-001', cardRevision: 1, eventId: 'attempt-001',
      },
    },
    {
      id: 'history', at: '2026-08-09T10:03:00.000Z', activity: 'learning-history',
      title: '沉淀溶解平衡', summary: '提示比较一般平衡常数后完成，尚未证明能独立迁移。',
      route: '/learn/free-001',
      source: {
        kind: 'object-memory', objectId: 'obj-001', path: 'memory/objects/obj-001.md',
        evidence: [{ kind: 'free-learning', sessionId: 'free-001' }],
      },
    },
  ],
};

test('renders one newest-first ledger without merging independent events', () => {
  const markup = renderToStaticMarkup(<FootprintPage value={value} onOpen={() => {}} />);
  expect(markup.match(/<li /g)).toHaveLength(4);
  expect(markup.indexOf('沉淀溶解平衡')).toBeLessThan(markup.indexOf('同离子效应'));
  expect(markup.indexOf('同离子效应')).toBeLessThan(markup.indexOf('Ksp 对话'));
  expect(markup.indexOf('Ksp 对话')).toBeLessThan(markup.indexOf('旧题卡'));
  expect(markup).toContain('时间未记录');
});

test('uses the four ledger categories without turning them into mastery states', () => {
  const markup = renderToStaticMarkup(<FootprintPage value={value} onOpen={() => {}} />);
  expect(markup).toContain('data-category="session"');
  expect(markup).toContain('data-category="asset"');
  expect(markup).toContain('data-category="attempt"');
  expect(markup).toContain('data-category="cognition"');
  expect(markup).not.toMatch(/掌握|熟练|能力等级/);
});

test('uses source-specific return actions and hides memory internals', () => {
  const markup = renderToStaticMarkup(<FootprintPage value={value} onOpen={() => {}} />);
  expect(markup).toContain('进入对话');
  expect(markup).toContain('打开题卡');
  expect(markup).toContain('回到这段学习');
  expect(markup).not.toContain('object-memory');
  expect(markup).not.toContain('memory/objects');
  expect(markup).not.toContain('Current Judgment');
});
