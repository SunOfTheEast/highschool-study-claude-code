import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { readKnowledge } from '../../src/study/knowledge';
import {
  filterKnowledge,
  KnowledgePage,
} from '../../src/client/pages/KnowledgePage';
import { join } from 'node:path';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');

test('renders the static method graph, cards and materials without personal overlays', () => {
  const value = readKnowledge(fixture);
  const markup = renderToStaticMarkup(<KnowledgePage value={value} />);

  expect(markup).toContain('导数方法体系');
  expect(markup).toContain('参变量分离');
  expect(markup).toContain('sample-card');
  expect(markup).toContain('materials/note.md');
  expect(markup).toContain('class="knowledge-workspace"');
  expect(markup).toContain('aria-label="题卡资产"');
  expect(markup).not.toMatch(/个人掌握|能力评分|作答次数|稳定能力|学习建议/i);
});

test('filters static assets only by their own metadata', () => {
  const value = readKnowledge(fixture);
  const result = filterKnowledge(value, '同构');

  expect(result.methods.map((item) => item.id)).toEqual(['isomorphic']);
  expect(result.cards.map((item) => item.id)).toEqual(['sample-card']);
  expect(result.materials).toEqual([]);
});

test('renders an honest full-page state when no static assets are installed', () => {
  const markup = renderToStaticMarkup(<KnowledgePage value={{
    methods: [],
    cards: [],
    materials: [],
  }} />);

  expect(markup).toContain('当前学习集没有预置静态资产');
  expect(markup).toContain('你提供的材料');
  expect(markup).toContain('老师为当前目标准备的任务');
  expect(markup).not.toContain('placeholder="方法、题卡编号或材料名"');
  expect(markup).not.toContain('aria-label="方法图谱"');
  expect(markup).not.toContain('aria-label="题卡资产"');
  expect(markup).not.toContain('aria-label="学习材料"');
});
