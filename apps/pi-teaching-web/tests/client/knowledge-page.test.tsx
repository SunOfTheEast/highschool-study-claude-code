import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { KnowledgePage } from '../../src/client/pages/KnowledgePage';
import { knowledgeProjectionFixture } from '../support/view-fixtures';

test('renders one landscape, filters and method inspector without mastery scores', () => {
  const html = renderToStaticMarkup(
    <KnowledgePage
      value={knowledgeProjectionFixture()}
      onSelectMethod={() => {}}
      onSelectCard={() => {}}
      onSelectMaterial={() => {}}
      onFilter={() => {}}
      onCourse={() => {}}
      onMemory={() => {}}
    />,
  );
  expect(html.match(/class="method-landscape"/g)).toHaveLength(1);
  expect(html).toContain('方法分区');
  expect(html).toContain('导数方法体系');
  expect(html).toContain('方法详情');
  expect(html).toContain('page_0032.md');
  expect(html).toContain('在不同题卡上更稳定');
  expect(html).not.toContain('%');
  expect(html).not.toContain('已掌握');
});
