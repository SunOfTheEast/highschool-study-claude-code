import { expect, test } from 'bun:test';
import type { LearningContextReference } from '../../src/shared/contracts';
import {
  loadFreeLearningContexts,
  materialPagesForContext,
} from '../../src/client/free-learning-contexts';

test('expands only the exact selected book page range before opening a session', () => {
  expect(materialPagesForContext('page-0042')).toEqual([42]);
  expect(materialPagesForContext('pages-0042-0044')).toEqual([42, 43, 44]);
});

test('loads only the assets carried into a Free Learning session', async () => {
  const calls: string[] = [];
  const references: LearningContextReference[] = [
    { kind: 'note', id: 'note-001' },
    { kind: 'problem-card', id: 'problem-001' },
    { kind: 'material', id: 'material-001', revision: 4, locator: 'page-0012' },
  ];

  const contexts = await loadFreeLearningContexts(references, {
    note: async (id) => {
      calls.push(`note:${id}`);
      return { title: '参数分离边界', revision: 2 };
    },
    problemCard: async (id) => {
      calls.push(`problem-card:${id}`);
      return { title: '陌生外壳选路', revision: 3, activity: { latestAttempt: null } };
    },
    material: async (id) => {
      calls.push(`material:${id}`);
      return {
        material: {
          revisions: [{ revision: 4, title: '导数专题讲义' }],
        },
      };
    },
  });

  expect(calls).toEqual([
    'note:note-001',
    'problem-card:problem-001',
    'material:material-001',
  ]);
  expect(contexts).toEqual([
    { key: 'note:note-001', kind: '笔记', title: '参数分离边界', detail: '第 2 版' },
    {
      key: 'problem-card:problem-001', kind: '题卡', title: '陌生外壳选路',
      detail: '第 3 版 · 尚未作答',
    },
    {
      key: 'material:material-001@4#page-0012', kind: '资料', title: '导数专题讲义',
      detail: '第 4 版 · 第 12 页',
    },
  ]);
});
