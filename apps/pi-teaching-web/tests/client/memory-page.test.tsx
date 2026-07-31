import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryPage } from '../../src/client/pages/MemoryPage';
import { memoryProjectionFixture } from '../support/view-fixtures';

test('shows conclusions first and keeps technical source details collapsed', () => {
  const html = renderToStaticMarkup(
    <MemoryPage
      value={memoryProjectionFixture()}
      onSelectSource={() => {}}
      onFilter={() => {}}
      onCourse={() => {}}
      onKnowledge={() => {}}
      onObject={() => {}}
    />,
  );
  expect(html.indexOf('已确认长期记忆')).toBeLessThan(html.indexOf('来源详情'));
  expect(html).toContain('<details');
  expect(html).toContain('提出异议');
  expect(html).not.toContain('PRIVATE_TEACHING_CLAIM_TEXT');
});

test('labels source-only Handoffs without promoting them to findings', () => {
  const value = memoryProjectionFixture();
  value.sourceIndexes = [{
    id: 'lesson-004/handoff#sources',
    level: 'lesson',
    label: '本阶段只保留了来源记录',
    sources: ['trace:trace-source-only'],
    state: 'active',
  }];
  const html = renderToStaticMarkup(
    <MemoryPage
      value={value}
      onSelectSource={() => {}}
      onFilter={() => {}}
      onCourse={() => {}}
      onKnowledge={() => {}}
      onObject={() => {}}
    />,
  );
  expect(html).toContain('仅有来源记录');
  expect(html).toContain('本阶段只保留了来源记录');
  expect(html).not.toContain('由来源推断出的结论');
});
