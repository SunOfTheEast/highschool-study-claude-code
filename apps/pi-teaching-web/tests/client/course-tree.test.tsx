import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CourseTree } from '../../src/client/components/CourseTree';
import { courseProjectionFixture } from '../support/view-fixtures';

test('renders candidate as a non-actionable future branch', () => {
  const html = renderToStaticMarkup(
    <CourseTree
      root={courseProjectionFixture().roadmap}
      selectedKey="lesson-candidate-001"
      onSelect={() => {}}
    />,
  );
  expect(html).toContain('可能的下一步');
  expect(html).toContain('data-status="candidate"');
  expect(html).not.toContain('data-action="start-candidate"');
  expect(html).not.toContain('Consider when');
});
