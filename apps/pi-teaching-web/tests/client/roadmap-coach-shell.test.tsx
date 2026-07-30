import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoadmapCoachShell } from '../../src/client/components/RoadmapCoachShell';

test('shows compact learning-set context around the Roadmap chat', () => {
  const html = renderToStaticMarkup(
    <RoadmapCoachShell
      learningSet={{
        title: '导数高阶研习',
        overview: '学习集概述',
        learningPrinciples: '研习原则',
        goal: '建立可迁移的结构判断。',
        planTree: [],
        plans: [],
      }}
      onHome={() => {}}
    >
      <div>CHAT SLOT</div>
    </RoadmapCoachShell>,
  );

  expect(html).toContain('学习总览');
  expect(html).toContain('导数高阶研习');
  expect(html).toContain('建立可迁移的结构判断');
  expect(html).toContain('尚未建立学习周期');
  expect(html).toContain('CHAT SLOT');
  expect(html).not.toContain('Lesson');
});
