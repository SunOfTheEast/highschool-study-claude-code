import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppShell } from '../../src/client/components/AppShell';

test('keeps the three equal primary views visible during loading', () => {
  const html = renderToStaticMarkup(
    <AppShell
      title="高阶导数学习集"
      activeView="knowledge"
      viewHrefs={{
        course: '/course/plan/domain-integrity/lesson/lesson-004',
        knowledge: '/knowledge?plan=domain-integrity&lesson=lesson-004',
        memory: '/memory?plan=domain-integrity&lesson=lesson-004',
      }}
      selectionLabel="Lesson 004"
      connection="connecting"
      viewLoading={true}
      viewError={null}
      personaControl={<button type="button">陪伴风格</button>}
      onNavigate={() => {}}
      onReturnCourse={() => {}}
    >
      <p>正在整理知识山河…</p>
    </AppShell>,
  );
  expect(html).toContain('课程脉络');
  expect(html).toContain('知识山河');
  expect(html).toContain('研习留痕');
  expect(html).toContain('Lesson 004');
  expect(html).toContain('陪伴风格');
  expect(html).toContain('正在整理当前页面');
  expect(html).toContain('正在整理知识山河');
});
