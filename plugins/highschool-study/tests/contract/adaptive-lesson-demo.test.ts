import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(import.meta.dir, '../../../..');
const demo = join(repo, 'examples/derivative-demo/learning-set');
const lesson = readFileSync(join(demo, 'lessons/lesson-003.md'), 'utf8');

function block(name: string) {
  const match = lesson.match(new RegExp(
    `## Block ${name}（[^\\n]+）\\n\\n([\\s\\S]*?)(?=\\n---\\n\\n## Block|\\n## Reflection)`,
  ));
  expect(match).not.toBeNull();
  return match![1]!;
}

function studentView(name: string) {
  const match = block(name).match(
    /^### Student View\n\n([\s\S]*?)(?=\n### Teacher Control)/,
  );
  expect(match).not.toBeNull();
  return match![1]!;
}

test('lesson 003 is a multi-card assessment with private teacher control', () => {
  expect(lesson).toContain('- Primary template: `assessment`');
  expect(lesson.match(/^### Student View$/gm)).toHaveLength(5);
  expect(lesson.match(/^### Teacher Control$/gm)).toHaveLength(5);

  for (const path of [
    'cards/derivative/mst_p0017_ex05.card.yaml',
    'cards/derivative/mst_p0032_ex22.card.yaml',
    'cards/derivative/mst_p0030_ex16.card.yaml',
  ]) expect(existsSync(join(demo, path))).toBe(true);

  expect(lesson).toContain(
    '- Q-DOMAIN-EX22: ../cards/derivative/mst_p0032_ex22.card.yaml',
  );
  expect(lesson).toContain(
    '- Q-DOMAIN-EX16: ../cards/derivative/mst_p0030_ex16.card.yaml',
  );
  expect(lesson).toContain(
    '- Q-DOMAIN-EX05: ../cards/derivative/mst_p0017_ex05.card.yaml',
  );

  const assessmentStudentViews = [
    studentView('orientation'),
    studentView('assessment-01'),
    studentView('assessment-02'),
  ];

  for (const view of assessmentStudentViews) {
    for (const capabilityCue of [
      '定义域',
      '合法',
      '正负',
      '符号',
      '边界',
      '端点',
    ]) expect(view).not.toContain(capabilityCue);
  }

  const studentViews = [
    ...assessmentStudentViews,
    studentView('repair-optional'),
    studentView('reflection'),
  ].join('\n');

  for (const spoiler of [
    '同除',
    'f(t)=',
    'ae^x>x',
    'a\\ge\\frac{1}{e}',
    '选 D',
    '选 C',
  ]) expect(studentViews).not.toContain(spoiler);

  expect(lesson).toContain('- Reveal: `zero`');
  expect(lesson).toContain('Q-DOMAIN-EX22 `step_2` and `step_5`');
  expect(lesson).not.toContain('Q-DOMAIN-EX22 `step_1` and `step_5`');
  expect(lesson).toContain('Q-DOMAIN-EX16 `step_1` and `step_6`');
  expect(lesson).not.toContain('Q-DOMAIN-EX16 `step_1` and `step_7`');
  expect(lesson).toContain('not independent assessment evidence');

  expect(lesson).toContain(
    '`assessment-01` precedes `assessment-02`; `repair-optional` may be inserted between them.',
  );

  expect(block('orientation')).toContain(
    '- Role: capability-standard orientation。',
  );
  expect(block('orientation')).toContain('- Reveal: `zero`。');

  expect(block('assessment-01')).toContain(
    '- Role: continuity check for Plan stage `1b`。',
  );
  expect(block('assessment-01')).toContain('- Reveal: `zero`。');

  expect(block('repair-optional')).toContain(
    '- Role: trace-grounded remediation using a seen card.',
  );
  expect(block('repair-optional')).toContain('- Reveal: `ladder`.');
  expect(block('repair-optional')).toContain(
    'not independent assessment evidence',
  );

  expect(block('assessment-02')).toContain('- Role: cross-structure transfer');
  expect(block('assessment-02')).toContain('- Reveal: `zero`.');
  expect(block('assessment-02')).toContain(
    '- Role: cross-structure transfer; if assessment-01 received any tutor or external support, this is also the fresh unsupported retest whether or not repair-optional ran.',
  );

  expect(block('reflection')).toContain(
    '- Role: evidence summary and student-controlled closure.',
  );
  expect(block('reflection')).toContain('- Reveal: `zero`;');
});

test('documents adaptive templates and reveal boundaries', () => {
  const pluginReadme = readFileSync(
    join(repo, 'plugins/highschool-study/README.md'), 'utf8',
  );
  const manual = readFileSync(
    join(repo, 'docs/zh-CN/完整说明书.md'), 'utf8',
  );
  const demoReadme = readFileSync(
    join(repo, 'examples/derivative-demo/README.md'), 'utf8',
  );

  for (const doc of [pluginReadme, manual, demoReadme]) {
    expect(doc).toContain('诊断课');
    expect(doc).toContain('专项训练课');
    expect(doc).toContain('能力验收课');
    expect(doc).toContain('Student View');
    expect(doc).toContain('Teacher Control');
    expect(doc).toContain('zero');
    expect(doc).toContain('ladder');
    expect(doc).toContain('worked-example');
  }

  expect(demoReadme).toContain(
    'Lesson 003 由 orientation、两道未见验收题、按需插入的可选修复和 reflection 组成。',
  );
  expect(demoReadme).toContain('这些 Block 是按依赖组织的课堂积木');
  expect(demoReadme).toContain(
    '你可以随时选择是否进入可选修复，并可暂停或结束。',
  );
  expect(demoReadme).not.toContain(
    'Lesson 003 由热身、结构导航、独立练习、互动讨论和可选小测组成。',
  );
});
