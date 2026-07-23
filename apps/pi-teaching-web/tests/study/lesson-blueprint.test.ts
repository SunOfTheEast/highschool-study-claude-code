import { expect, test } from 'bun:test';
import { join } from 'node:path';
import {
  LessonBlueprintValidationError,
  renderPreparedLesson,
  validateLessonBlueprint,
  type LessonBlueprint,
  type LessonRenderContext,
} from '../../src/study/lesson-blueprint';
import { validatePreparedLessonSource } from '../../src/study/validate-prepared-lesson';

const root = join(import.meta.dir, '../../../../examples/derivative-demo/learning-set');
const context: LessonRenderContext = {
  planId: 'domain-integrity',
  planPath: 'plans/domain-integrity.md',
  planTitle: '定义域完整性的系统加固',
  lessonPath: 'lessons/lesson-blueprint-001.md',
};
const blueprint: LessonBlueprint = {
  lessonId: 'lesson-blueprint-001',
  title: 'Lesson Blueprint 试验课',
  planContext: '用两张真实卡核验定义域迁移。',
  capabilityTarget: '无提示写全定义域，并在参数边界中使用。',
  primaryTemplate: 'assessment',
  templateReason: '需要获得两次独立证据。',
  adjustments: ['首题失败时插入一个可选修复节点。'],
  cards: [
    {
      alias: 'Q-EX22',
      cardPath: 'cards/derivative/mst_p0032_ex22.card.yaml',
      role: '连续性核验',
    },
    {
      alias: 'Q-EX16',
      cardPath: 'cards/derivative/mst_p0030_ex16.card.yaml',
      role: '跨结构迁移',
    },
  ],
  sources: [],
  blocks: [
    {
      id: 'assessment-01',
      kind: 'problem',
      required: true,
      dependsOn: [],
      uses: ['Q-EX22'],
      studentView: '请独立完成题卡 `Q-EX22`。',
      teacherControl: '首次尝试采用 `zero`，不提前给出方法。',
    },
    {
      id: 'assessment-02',
      kind: 'problem',
      required: true,
      dependsOn: ['assessment-01'],
      uses: ['Q-EX16'],
      studentView: '请独立完成题卡 `Q-EX16`。',
      teacherControl: '核验跨结构迁移，不复用上一题提示。',
    },
    {
      id: 'reflection',
      kind: 'reflection',
      required: true,
      dependsOn: ['assessment-02'],
      uses: [],
      studentView: '比较两次首次尝试。',
      teacherControl: '只总结学生已经产生的证据。',
    },
  ],
};

test('renders one canonical prepared Lesson that passes source admission', () => {
  validateLessonBlueprint(root, context, blueprint);
  const source = renderPreparedLesson(context, blueprint);

  expect(source).toContain('id: lesson-blueprint-001');
  expect(source).toContain('plan_id: domain-integrity');
  expect(source).toContain('status: prepared');
  expect(source).toContain('## Block assessment-01（必做）');
  expect(source).toContain('- Depends on: assessment-01');
  expect(source).toContain('- Q-EX22: ../cards/derivative/mst_p0032_ex22.card.yaml');
  expect(source.match(/- Status: pending/g)).toHaveLength(3);
  expect(() => validatePreparedLessonSource(root, context.lessonPath, source)).not.toThrow();
});

test('rejects duplicate Blocks, unknown aliases, false cards, and nested structural headings', () => {
  const invalid: LessonBlueprint = {
    ...blueprint,
    cards: [{
      alias: 'MISSING',
      cardPath: 'cards/derivative/not-real.card.yaml',
      role: '虚假题卡',
    }],
    blocks: [
      { ...blueprint.blocks[0]!, uses: ['UNKNOWN'], studentView: '## Escape' },
      { ...blueprint.blocks[0]! },
    ],
  };

  expect(() => validateLessonBlueprint(root, context, invalid))
    .toThrow(LessonBlueprintValidationError);
  try {
    validateLessonBlueprint(root, context, invalid);
  } catch (error) {
    const issues = (error as LessonBlueprintValidationError).issues.join('\n');
    expect(issues).toContain('Block ID 重复');
    expect(issues).toContain('未声明 alias');
    expect(issues).toContain('题卡不存在');
    expect(issues).toContain('一级到三级标题');
    expect(issues).toContain('恰好一个 reflection');
  }
});
