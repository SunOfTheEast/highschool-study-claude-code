import { posix } from 'node:path';
import {
  readCard,
  sourceResolve,
} from 'highschool-study-markdown/study-domain';

export type LessonCardBinding = {
  alias: string;
  cardPath: string;
  role: string;
};

export type LessonSource = {
  label: string;
  target: string;
  note: string;
};

export type LessonBlockBlueprint = {
  id: string;
  kind: 'dialogue' | 'problem' | 'material' | 'reflection';
  required: boolean;
  dependsOn: string[];
  uses: string[];
  studentView: string;
  teacherControl: string;
};

export type LessonBlueprint = {
  lessonId: string;
  title: string;
  planContext: string;
  capabilityTarget: string;
  primaryTemplate: string;
  templateReason: string;
  adjustments: string[];
  cards: LessonCardBinding[];
  sources: LessonSource[];
  blocks: LessonBlockBlueprint[];
};

export type LessonRenderContext = {
  planId: string;
  planPath: string;
  planTitle: string;
  lessonPath: string;
};

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const lessonIdPattern = /^lesson-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const structuralHeading = /^#{1,3}\s/m;

export class LessonBlueprintValidationError extends Error {
  readonly code = 'LESSON_BLUEPRINT_INVALID';

  constructor(readonly issues: string[]) {
    super(`LESSON_BLUEPRINT_INVALID: ${issues.join('；')}`);
    this.name = 'LessonBlueprintValidationError';
  }
}

function nonempty(value: string): boolean {
  return value.trim().length > 0;
}

function relativeTarget(lessonPath: string, target: string): string {
  if (/^https?:\/\//i.test(target)) return target;
  return posix.relative(posix.dirname(lessonPath), target);
}

function validateLessonSource(
  root: string,
  context: LessonRenderContext,
  source: LessonSource,
): string | null {
  if (/^https?:/i.test(source.target)) {
    if (!/^https?:\/\//i.test(source.target)) {
      return `外部来源 URL 非法：${source.target}`;
    }
    try {
      const url = new URL(source.target);
      return ['http:', 'https:'].includes(url.protocol) && Boolean(url.host)
        ? null
        : `外部来源 URL 非法：${source.target}`;
    } catch {
      return `外部来源 URL 非法：${source.target}`;
    }
  }
  const target = posix.relative(posix.dirname(context.planPath), source.target);
  const resolved = sourceResolve(root, {
    fromPath: context.planPath,
    target,
  });
  const declaredPath = source.target.split('#', 1)[0]!;
  if (resolved.valid && resolved.path === declaredPath) return null;
  const reason = resolved.valid
    ? `NON_CANONICAL_PATH:${resolved.path ?? '(none)'}`
    : resolved.error;
  return `来源无法定位：${source.target}（${reason}）`;
}

export function validateLessonBlueprint(
  root: string,
  context: LessonRenderContext,
  blueprint: LessonBlueprint,
): void {
  const issues: string[] = [];
  if (!lessonIdPattern.test(blueprint.lessonId)) issues.push('Lesson ID 非法');
  for (const [label, value] of [
    ['标题', blueprint.title],
    ['Plan context', blueprint.planContext],
    ['能力目标', blueprint.capabilityTarget],
    ['主模板', blueprint.primaryTemplate],
    ['模板理由', blueprint.templateReason],
  ] as const) {
    if (!nonempty(value)) issues.push(`${label}不能为空`);
  }

  const blockIds = new Set<string>();
  for (const block of blueprint.blocks) {
    if (!idPattern.test(block.id)) issues.push(`Block ID 非法：${block.id}`);
    if (blockIds.has(block.id)) issues.push(`Block ID 重复：${block.id}`);
    blockIds.add(block.id);
  }

  const aliases = new Set<string>();
  for (const card of blueprint.cards) {
    if (aliases.has(card.alias)) issues.push(`alias 重复：${card.alias}`);
    aliases.add(card.alias);
    try {
      if (readCard(root, card.cardPath) === null) issues.push(`题卡不存在：${card.cardPath}`);
    } catch {
      issues.push(`题卡不存在：${card.cardPath}`);
    }
  }

  for (const source of blueprint.sources) {
    if (!nonempty(source.label) || !nonempty(source.target) || !nonempty(source.note)) {
      issues.push('来源 label、target 与 note 均不能为空');
      continue;
    }
    const issue = validateLessonSource(root, context, source);
    if (issue) issues.push(issue);
  }

  for (const block of blueprint.blocks) {
    for (const dependency of block.dependsOn) {
      if (!blockIds.has(dependency) || dependency === block.id) {
        issues.push(`Block ${block.id} 的依赖无效：${dependency}`);
      }
    }
    if (block.kind === 'problem' && block.uses.length !== 1) {
      issues.push(`Block ${block.id} 必须且只能 Uses 恰好一张题卡`);
    }
    for (const alias of block.uses) {
      if (!aliases.has(alias)) issues.push(`Block ${block.id} 使用未声明 alias：${alias}`);
    }
    if (!nonempty(block.studentView) || !nonempty(block.teacherControl)) {
      issues.push(`Block ${block.id} 的 Student View 与 Teacher Control 均不能为空`);
    }
    if (
      structuralHeading.test(block.studentView)
      || structuralHeading.test(block.teacherControl)
    ) {
      issues.push(`Block ${block.id} 不能嵌入一级到三级标题`);
    }
  }

  if (issues.length > 0) throw new LessonBlueprintValidationError(issues);
}

export function renderPreparedLesson(
  context: LessonRenderContext,
  blueprint: LessonBlueprint,
): string {
  const adjustments = blueprint.adjustments.length > 0
    ? blueprint.adjustments.map((item) => `- Adjustment: ${item}`).join('\n')
    : '- Adjustment: 无额外调整。';
  const cardSources = blueprint.cards.map((card) => (
    `- ${card.role}: [${card.alias}](${relativeTarget(context.lessonPath, card.cardPath)})`
  ));
  const otherSources = blueprint.sources.map((source) => (
    `- ${source.label}: [source](${relativeTarget(context.lessonPath, source.target)}) — ${source.note}`
  ));
  const sources = [...cardSources, ...otherSources];
  const controls = blueprint.blocks.flatMap((block) => [
    ...(block.dependsOn.length > 0
      ? [`- \`${block.id}\` depends on ${block.dependsOn.map((id) => `\`${id}\``).join(', ')}.`]
      : []),
    ...(!block.required ? [`- \`${block.id}\` is optional and may be skipped.`] : []),
  ]);
  controls.push('- The student may pause or end the Lesson at any time.');

  const blocks = blueprint.blocks.map((block) => `## Block ${block.id}（${block.required ? '必做' : '可选'}）

### Node State

- Kind: ${block.kind}
- Required: ${String(block.required)}
- Status: pending
- Depends on: ${block.dependsOn.join(', ')}
- Uses: ${block.uses.join(', ')}

### Student View

${block.studentView.trim()}

### Teacher Control

${block.teacherControl.trim()}`);

  const aliases = blueprint.cards.length > 0
    ? blueprint.cards.map((card) => (
      `- ${card.alias}: ${relativeTarget(context.lessonPath, card.cardPath)}`
    )).join('\n')
    : '（本课不使用题卡 alias）';

  return `---
id: ${blueprint.lessonId}
kind: lesson
plan_id: ${context.planId}
status: prepared
---
# ${blueprint.title.trim()}

## Plan Link

[${context.planTitle}](${relativeTarget(context.lessonPath, context.planPath)}) — ${blueprint.planContext.trim()}

## Capability Target

${blueprint.capabilityTarget.trim()}

## Lesson Configuration

- Primary template: \`${blueprint.primaryTemplate.trim()}\`
- Reason: ${blueprint.templateReason.trim()}
${adjustments}

## Sources

${sources.length > 0 ? sources.join('\n') : '（无额外材料）'}

## Dependencies and control

${controls.join('\n')}

---

${blocks.join('\n\n---\n\n')}

## Lesson Summary

（课堂结束后填写）

## Aliases

${aliases}

## Traces

（课堂中通过 trace_append 追加）
`;
}
