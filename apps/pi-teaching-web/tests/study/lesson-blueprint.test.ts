import { afterEach, beforeEach, expect, test } from 'bun:test';
import {
  cpSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  LessonBlueprintValidationError,
  renderPreparedLesson,
  validateLessonBlueprint,
  type LessonBlueprint,
  type LessonRenderContext,
} from '../../src/study/lesson-blueprint';
import { parseActivationSnapshot } from '../../src/study/activation-snapshot';
import { validatePreparedLessonSource } from '../../src/study/validate-prepared-lesson';

const fixtureRoot = join(import.meta.dir, '../../../../examples/derivative-demo/learning-set');
let root = '';

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'lesson-blueprint-'));
  cpSync(fixtureRoot, root, { recursive: true });
  writeFileSync(
    join(root, 'materials/blueprint-source.md'),
    '# Blueprint Source\n\n## Local fact\n\nA locatable teaching fact.\n',
  );
  writeFileSync(
    join(root, 'plans/domain-integrity.md'),
    '# Plan：定义域完整性的系统加固\n',
  );
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const context: LessonRenderContext = {
  planId: 'domain-integrity',
  planPath: 'plans/domain-integrity.md',
  planTitle: '定义域完整性的系统加固',
  lessonId: 'lesson-blueprint-001',
  lessonPath: 'lessons/lesson-blueprint-001.md',
};
const blueprint: LessonBlueprint = {
  title: 'Lesson Blueprint 试验课',
  publicPurpose: '用两张真实卡核验定义域迁移。',
  capabilityTarget: '无提示写全定义域，并在参数边界中使用。',
  primaryTemplate: 'assessment',
  templateReason: '需要获得两次独立证据。',
  adjustments: ['首题失败时插入一个可选修复节点。'],
  activation: {
    parentSources: ['card:cards/derivative/mst_p0032_ex22.card.yaml'],
    selectedMemory: [],
    contentBoundary: ['课前不展示题解与方法名称。'],
    adaptation: {
      workingJudgment: '需要区分定义域完整性与一般计算失误。',
      sources: ['card:cards/derivative/mst_p0032_ex22.card.yaml'],
      designConsequence: '先用同结构题检查，再做迁移。',
      reviseIf: '学生第一题已经能稳定独立处理全部边界。',
    },
  },
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
      localAlias: 'assessment-01',
      kind: 'problem',
      required: true,
      dependsOn: [],
      uses: ['Q-EX22'],
      studentView: '请独立完成题卡 `Q-EX22`。',
      teacherControl: '首次尝试采用 `zero`，不提前给出方法。',
    },
    {
      localAlias: 'assessment-02',
      kind: 'problem',
      required: true,
      dependsOn: ['assessment-01'],
      uses: ['Q-EX16'],
      studentView: '请独立完成题卡 `Q-EX16`。',
      teacherControl: '核验跨结构迁移，不复用上一题提示。',
    },
    {
      localAlias: 'reflection',
      kind: 'reflection',
      required: true,
      dependsOn: ['assessment-02'],
      uses: [],
      studentView: '比较两次首次尝试。',
      teacherControl: '只总结学生已经产生的证据。',
    },
  ],
};

const reflection = blueprint.blocks.find((block) => block.kind === 'reflection')!;
const reflectionVariants: Array<[string, LessonBlueprint['blocks']]> = [
  ['zero', blueprint.blocks.filter((block) => block.kind !== 'reflection')],
  ['one', blueprint.blocks],
  ['multiple', [
    ...blueprint.blocks,
    {
      ...reflection,
      localAlias: 'reflection-midway',
      required: false,
      dependsOn: ['assessment-01'],
    },
  ]],
];

test.each(reflectionVariants)(
  'accepts %s Reflection Blocks and emits no top-level Reflection section',
  (_name, blocks) => {
    const value = { ...blueprint, blocks };
    expect(() => validateLessonBlueprint(root, context, value)).not.toThrow();
    const source = renderPreparedLesson(context, value);
    expect(source).not.toMatch(/^## Reflection$/m);
    expect(source).toMatch(/^## Lesson Summary$/m);
    expect(() => validatePreparedLessonSource(
      root,
      context.lessonPath,
      source,
    )).not.toThrow();
  },
);

test('renders one canonical prepared Lesson that passes source admission', () => {
  validateLessonBlueprint(root, context, blueprint);
  const source = renderPreparedLesson(context, blueprint);

  expect(source).toContain('id: lesson-blueprint-001');
  expect(source).toContain('parent_id: domain-integrity');
  expect(source).toContain('parent_path: plans/domain-integrity.md');
  expect(source).toContain('tutor_session: null');
  expect(source).toContain('status: prepared');
  expect(source).toContain('## Block block-001（必做）');
  expect(source).toContain('- Depends on: block-001');
  expect(source).toContain('- Q-EX22: ../cards/derivative/mst_p0032_ex22.card.yaml');
  expect(source.match(/- Status: pending/g)).toHaveLength(3);
  expect(source).toContain('## Handoff\n\n（尚未封存）');
  expect(source).not.toContain('## Traces');
  expect(parseActivationSnapshot(source)).toMatchObject({
    parent: 'plan:domain-integrity',
    activatedAt: 'pending',
  });
  expect(() => validatePreparedLessonSource(root, context.lessonPath, source)).not.toThrow();
});

test.each([
  ['no card', []],
  ['multiple cards', ['Q-EX22', 'Q-EX16']],
] as const)('rejects a problem Block with %s in a Blueprint', (_name, uses) => {
  const invalid: LessonBlueprint = {
    ...blueprint,
    blocks: blueprint.blocks.map((block) => (
      block.localAlias === 'assessment-01' ? { ...block, uses: [...uses] } : block
    )),
  };

  expect(() => validateLessonBlueprint(root, context, invalid))
    .toThrow(/assessment-01.*恰好一张题卡/);
});

test('allows separately assessed parts to reuse one card alias in different problem Blocks', () => {
  const repeatedCard: LessonBlueprint = {
    ...blueprint,
    blocks: blueprint.blocks.map((block) => (
      block.localAlias === 'assessment-02' ? { ...block, uses: ['Q-EX22'] } : block
    )),
  };

  expect(() => validateLessonBlueprint(root, context, repeatedCard)).not.toThrow();
  expect(() => validatePreparedLessonSource(
    root,
    context.lessonPath,
    renderPreparedLesson(context, repeatedCard),
  )).not.toThrow();
});

test.each([
  ['no card', '- Uses:'],
  ['multiple cards', '- Uses: Q-EX22, Q-EX16'],
] as const)('rejects a prepared problem Block with %s', (_name, usesLine) => {
  const source = renderPreparedLesson(context, blueprint).replace(
    '- Uses: Q-EX22',
    usesLine,
  );

  expect(() => validatePreparedLessonSource(root, context.lessonPath, source))
    .toThrow(/LESSON_PROBLEM_CARD_COUNT/);
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
    expect(issues).toContain('Block localAlias 重复');
    expect(issues).toContain('未声明 alias');
    expect(issues).toContain('题卡不存在');
    expect(issues).toContain('一级到三级标题');
  }
});

test('accepts a locatable learning-set material source', () => {
  const value: LessonBlueprint = {
    ...blueprint,
    sources: [{
      label: '本地材料',
      target: 'materials/blueprint-source.md#local-fact',
      note: '支持本课的本地判断。',
    }],
  };

  expect(() => validateLessonBlueprint(root, context, value)).not.toThrow();
  expect(renderPreparedLesson(context, value))
    .toContain('../materials/blueprint-source.md#local-fact');
});

test.each([
  ['missing file', 'materials/missing.md', 'MISSING_FILE'],
  ['outside learning set', '../../private.md', 'OUTSIDE_LEARNING_SET'],
  ['missing fragment', 'materials/blueprint-source.md#missing', 'MISSING_FRAGMENT'],
] as const)('rejects %s in Lesson sources', (_name, target, error) => {
  const value: LessonBlueprint = {
    ...blueprint,
    sources: [{ label: '无效来源', target, note: '测试。' }],
  };
  expect(() => validateLessonBlueprint(root, context, value))
    .toThrow(new RegExp(`来源.*${error}`));
});

test('accepts a syntactically valid external source without fetching it', () => {
  const value: LessonBlueprint = {
    ...blueprint,
    sources: [{
      label: '外部视频',
      target: 'https://example.com/lesson/video',
      note: '课堂中播放。',
    }],
  };
  expect(() => validateLessonBlueprint(root, context, value)).not.toThrow();
  expect(renderPreparedLesson(context, value))
    .toContain('(https://example.com/lesson/video)');
});

test.each(['https://', 'https:example.com'])(
  'rejects a malformed external URL: %s',
  (target) => {
    const value: LessonBlueprint = {
      ...blueprint,
      sources: [{
        label: '错误链接',
        target,
        note: '不能解析。',
      }],
    };
    expect(() => validateLessonBlueprint(root, context, value))
      .toThrow(/外部来源 URL 非法/);
  },
);
