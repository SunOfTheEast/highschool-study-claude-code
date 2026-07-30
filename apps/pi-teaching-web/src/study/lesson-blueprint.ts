import { posix } from 'node:path';
import {
  readCard,
  sourceResolve,
} from 'highschool-study-markdown/study-domain';
import {
  renderPreparedActivationSnapshot,
  validateActivationSnapshotDraft,
  type ActivationSnapshotDraft,
} from './activation-snapshot';

export type ActivityKind =
  | 'dialogue'
  | 'problem'
  | 'material'
  | 'reflection';

export type ClassroomTemplate =
  | 'diagnostic'
  | 'concept'
  | 'deliberate-practice'
  | 'remediation'
  | 'assessment'
  | 'review';

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

export type LessonBlockDraft = {
  localAlias: string;
  kind: ActivityKind;
  required: boolean;
  dependsOn: string[];
  uses: string[];
  studentView: string;
  teacherControl: string;
};

export type LessonBlueprint = {
  title: string;
  publicPurpose: string;
  capabilityTarget: string;
  primaryTemplate: ClassroomTemplate;
  templateReason: string;
  adjustments: string[];
  activation: ActivationSnapshotDraft;
  cards: LessonCardBinding[];
  sources: LessonSource[];
  blocks: LessonBlockDraft[];
};

export type LessonRenderContext = {
  planId: string;
  planPath: string;
  planTitle: string;
  lessonId: string;
  lessonPath: string;
};

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const lessonIdPattern = /^lesson-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const structuralHeading = /^#{1,3}\s/m;
const templates = new Set<ClassroomTemplate>([
  'diagnostic',
  'concept',
  'deliberate-practice',
  'remediation',
  'assessment',
  'review',
]);

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

function validateContext(context: LessonRenderContext): void {
  if (
    !idPattern.test(context.planId)
    || context.planPath !== `plans/${context.planId}.md`
    || !nonempty(context.planTitle)
    || !lessonIdPattern.test(context.lessonId)
    || context.lessonPath !== `lessons/${context.lessonId}.md`
  ) {
    throw new Error('LESSON_RENDER_CONTEXT_INVALID');
  }
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

function hasDependencyCycle(blocks: LessonBlockDraft[]): boolean {
  const dependencies = new Map(
    blocks.map((block) => [block.localAlias, block.dependsOn]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (alias: string): boolean => {
    if (visiting.has(alias)) return true;
    if (visited.has(alias)) return false;
    visiting.add(alias);
    for (const dependency of dependencies.get(alias) ?? []) {
      if (visit(dependency)) return true;
    }
    visiting.delete(alias);
    visited.add(alias);
    return false;
  };
  return [...dependencies.keys()].some(visit);
}

export function validateLessonBlueprint(
  root: string,
  context: LessonRenderContext,
  blueprint: LessonBlueprint,
): void {
  validateContext(context);
  const issues: string[] = [];
  for (const [label, value] of [
    ['标题', blueprint.title],
    ['公开目的', blueprint.publicPurpose],
    ['能力目标', blueprint.capabilityTarget],
    ['模板理由', blueprint.templateReason],
  ] as const) {
    if (!nonempty(value)) issues.push(`${label}不能为空`);
  }
  if (!templates.has(blueprint.primaryTemplate)) issues.push('主模板非法');
  if (
    blueprint.adjustments.some((value) => !nonempty(value))
    || new Set(blueprint.adjustments).size !== blueprint.adjustments.length
  ) {
    issues.push('调整项必须非空且不重复');
  }
  try {
    validateActivationSnapshotDraft(blueprint.activation);
  } catch {
    issues.push('Activation Snapshot 非法');
  }

  if (blueprint.blocks.length === 0) issues.push('至少需要一个 Block');
  const blockAliases = new Set<string>();
  for (const block of blueprint.blocks) {
    if (!idPattern.test(block.localAlias)) {
      issues.push(`Block localAlias 非法：${block.localAlias}`);
    }
    if (blockAliases.has(block.localAlias)) {
      issues.push(`Block localAlias 重复：${block.localAlias}`);
    }
    blockAliases.add(block.localAlias);
  }

  const aliases = new Set<string>();
  for (const card of blueprint.cards) {
    if (
      !nonempty(card.alias)
      || !nonempty(card.cardPath)
      || !nonempty(card.role)
    ) {
      issues.push('题卡 alias、path 与 role 均不能为空');
      continue;
    }
    if (aliases.has(card.alias)) issues.push(`alias 重复：${card.alias}`);
    aliases.add(card.alias);
    try {
      if (readCard(root, card.cardPath) === null) {
        issues.push(`题卡不存在：${card.cardPath}`);
      }
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
      if (!blockAliases.has(dependency) || dependency === block.localAlias) {
        issues.push(`Block ${block.localAlias} 的依赖无效：${dependency}`);
      }
    }
    if (
      new Set(block.dependsOn).size !== block.dependsOn.length
      || new Set(block.uses).size !== block.uses.length
    ) {
      issues.push(`Block ${block.localAlias} 的依赖或 Uses 重复`);
    }
    if (block.kind === 'problem' && block.uses.length !== 1) {
      issues.push(`Block ${block.localAlias} 必须且只能 Uses 恰好一张题卡`);
    }
    for (const alias of block.uses) {
      if (!aliases.has(alias)) {
        issues.push(`Block ${block.localAlias} 使用未声明 alias：${alias}`);
      }
    }
    if (!nonempty(block.studentView) || !nonempty(block.teacherControl)) {
      issues.push(
        `Block ${block.localAlias} 的 Student View 与 Teacher Control 均不能为空`,
      );
    }
    if (
      structuralHeading.test(block.studentView)
      || structuralHeading.test(block.teacherControl)
    ) {
      issues.push(`Block ${block.localAlias} 不能嵌入一级到三级标题`);
    }
  }
  if (!issues.length && hasDependencyCycle(blueprint.blocks)) {
    issues.push('Block 依赖不能形成环');
  }

  if (issues.length > 0) throw new LessonBlueprintValidationError(issues);
}

function blockIds(
  blocks: LessonBlockDraft[],
): Map<string, string> {
  return new Map(blocks.map((block, index) => [
    block.localAlias,
    `block-${String(index + 1).padStart(3, '0')}`,
  ]));
}

export function renderPreparedLesson(
  context: LessonRenderContext,
  blueprint: LessonBlueprint,
): string {
  validateContext(context);
  const ids = blockIds(blueprint.blocks);
  const adjustments = blueprint.adjustments.length > 0
    ? blueprint.adjustments.map((item) => `- Adjustment: ${item.trim()}`).join('\n')
    : '- Adjustment: 无额外调整。';
  const cardSources = blueprint.cards.map((card) => (
    `- ${card.role}: [${card.alias}](${relativeTarget(context.lessonPath, card.cardPath)})`
  ));
  const otherSources = blueprint.sources.map((source) => (
    `- ${source.label}: [source](${relativeTarget(context.lessonPath, source.target)}) — ${source.note}`
  ));
  const sources = [...cardSources, ...otherSources];
  const controls = blueprint.blocks.flatMap((block) => {
    const id = ids.get(block.localAlias)!;
    return [
      ...(block.dependsOn.length > 0
        ? [`- \`${id}\` depends on ${block.dependsOn
          .map((alias) => `\`${ids.get(alias)!}\``).join(', ')}.`]
        : []),
      ...(!block.required ? [`- \`${id}\` is optional and may be skipped.`] : []),
    ];
  });
  controls.push('- The student may pause or end the Lesson at any time.');

  const blocks = blueprint.blocks.map((block) => {
    const id = ids.get(block.localAlias)!;
    return `## Block ${id}（${block.required ? '必做' : '可选'}）

### Node State

- Kind: ${block.kind}
- Required: ${String(block.required)}
- Status: pending
- Depends on: ${block.dependsOn.map((alias) => ids.get(alias)!).join(', ')}
- Uses: ${block.uses.join(', ')}

### Student View

${block.studentView.trim()}

### Teacher Control

${block.teacherControl.trim()}`;
  });

  const aliases = blueprint.cards.length > 0
    ? blueprint.cards.map((card) => (
      `- ${card.alias}: ${relativeTarget(context.lessonPath, card.cardPath)}`
    )).join('\n')
    : '（本课不使用题卡 alias）';
  const activation = renderPreparedActivationSnapshot(
    `plan:${context.planId}`,
    blueprint.activation,
  );

  return `---
id: ${context.lessonId}
kind: lesson
status: prepared
parent_id: ${context.planId}
parent_path: ${context.planPath}
tutor_session: null
---
# ${blueprint.title.trim()}

> ${blueprint.publicPurpose.trim()}

## Plan Link

[${context.planTitle}](${relativeTarget(context.lessonPath, context.planPath)})

## Capability Target

${blueprint.capabilityTarget.trim()}

## Lesson Configuration

- Primary template: \`${blueprint.primaryTemplate.trim()}\`
- Reason: ${blueprint.templateReason.trim()}
${adjustments}

${activation}
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

## Handoff

（尚未封存）
`;
}
