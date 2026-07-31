import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CoursePage } from '../../src/client/pages/CoursePage';
import { courseProjectionFixture } from '../support/view-fixtures';

test('keeps one course tree, one stage and one inspector', () => {
  const html = renderToStaticMarkup(
    <CoursePage
      value={courseProjectionFixture()}
      coachPanel={<p>COACH_PANEL</p>}
      selectedKey="plan:domain-integrity"
      onNodeSelect={() => {}}
      onLessonAction={() => {}}
      onKnowledge={() => {}}
      onMemory={() => {}}
    />,
  );
  expect(html.match(/class="course-tree"/g)).toHaveLength(1);
  expect(html.match(/class="plan-stage"/g)).toHaveLength(1);
  expect(html.match(/class="course-inspector"/g)).toHaveLength(1);
  expect(html).toContain('COACH_PANEL');
});
