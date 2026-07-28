import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ContentSearchResult } from '../../src/shared/contracts';
import { ContentExplorer } from '../../src/client/components/ContentExplorer';

const result: ContentSearchResult = {
  query: '定义域',
  hits: [{
    kind: 'card',
    id: 'card-1',
    title: '定义域训练题',
    subtitle: '真实题卡',
    source: 'cards/domain.card.yaml',
    matchedBy: 'trace',
    matchReason: '学习记录中命中',
    traceHistory: [{
      source: 'lessons/lesson-1.md#trace-event-001',
      lessonId: 'lesson-1',
      blockId: 'problem-1',
      assessment: 'correct',
      support: 'none',
      note: '主动写全定义域。',
    }],
    card: {
      path: 'cards/domain.card.yaml',
      stem: 'SAFE CARD STEM',
      choices: [],
    },
    preview: null,
  }],
};

test('renders search, filters, results, exact source and related records', () => {
  const html = renderToStaticMarkup(
    <ContentExplorer
      initialResult={result}
      onClose={() => {}}
      onEvidence={() => {}}
      onSearch={async () => result}
    />,
  );

  expect(html.match(/type="search"/g)).toHaveLength(1);
  expect(html).toContain('题卡');
  expect(html).toContain('方法');
  expect(html).toContain('材料');
  expect(html).toContain('定义域训练题');
  expect(html).toContain('SAFE CARD STEM');
  expect(html).toContain('cards/domain.card.yaml');
  expect(html).toContain('相关学习记录');
  expect(html).toContain('主动写全定义域');
});

test('renders an authentic empty state', () => {
  const html = renderToStaticMarkup(
    <ContentExplorer
      initialResult={{ query: '不存在', hits: [] }}
      onClose={() => {}}
      onEvidence={() => {}}
      onSearch={async () => ({ query: '不存在', hits: [] })}
    />,
  );

  expect(html).toContain('没有找到真实资料');
  expect(html).not.toContain('虚构');
});
