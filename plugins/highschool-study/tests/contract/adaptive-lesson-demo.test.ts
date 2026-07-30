import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const repo = join(import.meta.dir, '../../../..');
const regression = join(
  repo,
  'apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set',
);
const publicDemo = join(repo, 'examples/derivative-demo');
const lesson = readFileSync(join(regression, 'lessons/lesson-003.md'), 'utf8');

function block(name: string) {
  const match = lesson.match(new RegExp(
    `## Block ${name}（[^\\n]+）\\n\\n([\\s\\S]*?)(?=\\n---\\n\\n## Block|\\n## Lesson Summary)`,
  ));
  expect(match).not.toBeNull();
  return match![1]!;
}

function studentView(name: string) {
  const match = block(name).match(
    /^### Student View\n\n([\s\S]*?)(?=\n### Teacher Control)/m,
  );
  expect(match).not.toBeNull();
  return match![1]!;
}

function criterionDescription(cardPath: string, stepId: string) {
  const card = parse(readFileSync(join(regression, cardPath), 'utf8')) as {
    rubric: { criteria: Array<{ step_id: string; description: string }> };
  };
  const criterion = card.rubric.criteria.find(({ step_id }) => step_id === stepId);
  expect(criterion).toBeDefined();
  return criterion!.description;
}

test('lesson 003 is a multi-card assessment with private teacher control', () => {
  expect(lesson).toContain('- Primary template: `assessment`');
  expect(lesson.match(/^### Student View$/gm)).toHaveLength(5);
  expect(lesson.match(/^### Teacher Control$/gm)).toHaveLength(5);

  for (const path of [
    'cards/derivative/mst_p0017_ex05.card.yaml',
    'cards/derivative/mst_p0032_ex22.card.yaml',
    'cards/derivative/mst_p0030_ex16.card.yaml',
  ]) expect(existsSync(join(regression, path))).toBe(true);

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
    studentView('block-001'),
    studentView('block-002'),
    studentView('block-004'),
  ];

  expect(assessmentStudentViews[0]!.trim()).toBe(
    '本课有两道不同结构的未见题。请独立作答；两题首次尝试都不提供提示。你可以随时暂停或结束。',
  );
  expect(assessmentStudentViews[1]!.trim()).toBe(
    '请独立完成题卡 `Q-DOMAIN-EX22`。教练只呈现真实题干和选项；请给出完整的作答过程、理由和结论。',
  );
  expect(assessmentStudentViews[2]!.trim()).toBe(
    '请独立完成另一张未见题卡 `Q-DOMAIN-EX16`。教练只呈现真实题干和选项；请给出完整的作答过程、理由和结论。',
  );

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
    studentView('block-003'),
    studentView('block-005'),
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

  const ex22Step2 = criterionDescription(
    'cards/derivative/mst_p0032_ex22.card.yaml', 'step_2',
  );
  expect(ex22Step2).toContain('正量');
  expect(ex22Step2).toContain('函数值比较');
  const ex22Step5 = criterionDescription(
    'cards/derivative/mst_p0032_ex22.card.yaml', 'step_5',
  );
  expect(ex22Step5).toContain('开区间');
  expect(ex22Step5).toContain('确界');

  const ex16Step1 = criterionDescription(
    'cards/derivative/mst_p0030_ex16.card.yaml', 'step_1',
  );
  expect(ex16Step1).toContain('参数定义域');
  const ex16Step6 = criterionDescription(
    'cards/derivative/mst_p0030_ex16.card.yaml', 'step_6',
  );
  expect(ex16Step6).toContain('开端点');

  expect(lesson).toContain('not independent assessment evidence');

  expect(lesson).toContain(
    '`block-002` precedes `block-004`; `block-003` may be inserted between them.',
  );

  expect(block('block-001')).toContain(
    '- Role: capability-standard orientation。',
  );
  expect(block('block-001')).toContain('- Reveal: `zero`。');

  expect(block('block-002')).toContain(
    '- Role: continuity check for Plan stage `1b`。',
  );
  expect(block('block-002')).toContain('- Reveal: `zero`。');

  expect(block('block-003')).toContain(
    '- Role: trace-grounded remediation using a seen card.',
  );
  expect(block('block-003')).toContain('- Reveal: `ladder`.');
  expect(block('block-003')).toContain(
    'not independent assessment evidence',
  );

  expect(block('block-004')).toContain('- Role: cross-structure transfer');
  expect(block('block-004')).toContain('- Reveal: `zero`.');
  expect(block('block-004')).toContain(
    '- Role: cross-structure transfer; if `block-002` received any tutor or external support, this is also the fresh unsupported retest whether or not `block-003` ran.',
  );

  expect(block('block-005')).toContain(
    '- Role: evidence summary and student-controlled closure.',
  );
  expect(block('block-005')).toContain('- Reveal: `zero`;');
});

test('documents adaptive templates and reveal boundaries', () => {
  const pluginReadme = readFileSync(
    join(repo, 'plugins/highschool-study/README.md'), 'utf8',
  );
  const manual = readFileSync(
    join(repo, 'docs/zh-CN/完整说明书.md'), 'utf8',
  );
  const demoReadme = readFileSync(
    join(publicDemo, 'README.md'), 'utf8',
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
});
