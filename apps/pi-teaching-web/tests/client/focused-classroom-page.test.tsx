import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { FocusedClassroomPage } from '../../src/client/pages/FocusedClassroomPage';
import { classroomPageFixture } from '../support/view-fixtures';

test('prioritizes Lesson navigation, Tutor dialogue and the safe notebook', () => {
  const html = renderToStaticMarkup(
    <FocusedClassroomPage
      {...classroomPageFixture()}
      onStart={() => {}}
      onPause={() => {}}
      onReprepare={() => {}}
    />,
  );
  expect(html).toContain('class="classroom-navigation"');
  expect(html).toContain('class="classroom-dialogue"');
  expect(html).toContain('class="classroom-notebook"');
  expect(html).not.toContain('class="course-tree"');
  expect(html).not.toContain('class="method-landscape"');
  expect(html).not.toContain('class="evidence-lineage"');
});
