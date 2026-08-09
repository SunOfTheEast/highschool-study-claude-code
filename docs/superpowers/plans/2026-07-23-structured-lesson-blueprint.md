# Structured Lesson Blueprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Pi Coach submit one small structured `LessonBlueprint` and reliably publish a canonical, indexed `prepared` Lesson without hand-writing executable Markdown grammar.

**Architecture:** Add one transient Coach-only tool input, a deterministic Markdown renderer, and a narrow Plan Lesson Index writer. The runtime binds Plan identity, paths, statuses, and relative links; the model supplies only teaching judgments, authentic card paths, and Block prose. The generated `lesson-xxx.md` remains the only durable teaching fact and continues through the existing admission, Tutor, Trace, and close paths.

**Tech Stack:** TypeScript 7, Bun 1.3, TypeBox, Pi coding-agent custom tools, Markdown learning-set files, Bun test, Playwright.

**Design:** `docs/superpowers/specs/2026-07-23-structured-lesson-blueprint-design.md`

## Global Constraints

- Keep `lesson-xxx.md` as the only durable source of truth; do not create `.blueprint.yaml`, JSON state, a database, or an index service.
- Add `lesson_prepare` only to the Pi Coach. The public Claude plugin must continue to expose exactly four MCP tools.
- Bind `planId`, `planPath`, `lessonPath`, Lesson status, Block status, Session IDs, relative links, and Lesson Index position in the runtime.
- Let the model supply only irreducible teaching content: Lesson ID/title, Plan context, capability target, template explanation, real card bindings, sources, Block topology, Student View, and Teacher Control.
- Validate only mechanical executability. Do not score lesson quality, template fit, question count, reveal policy, or mastery.
- Permit in-place replacement only while the target Lesson is `prepared`; preserve every started Lesson and require a new Lesson ID.
- Do not remove Coach `write` or `edit` in this experiment.
- Do not add compatibility branches, JSON repair, automatic retries, a rule engine, or a visual Outline editor.
- Do not write tests for Skill prose, exact wording, headings in documentation, or prompt word lists.
- Use TDD for executable behavior: run each new test red before writing its production code.
- Run real-model acceptance only on a copied derivative learning set.

---

## File Structure

### New files

- `apps/pi-teaching-web/src/study/lesson-blueprint.ts`
  - Owns the transient Blueprint types, narrow structural validation, path rendering, and canonical Lesson Markdown renderer.
- `apps/pi-teaching-web/src/runtime/lesson-prepare.ts`
  - Owns the TypeBox model contract and Session-bound Coach tool.
- `apps/pi-teaching-web/tests/study/lesson-blueprint.test.ts`
  - Proves deterministic rendering and minimal structural rejection.
- `docs/superpowers/reports/2026-07-23-structured-lesson-blueprint-live.md`
  - Records the copied-learning-set real-model result without credentials or private transcript content.

### Modified files

- `apps/pi-teaching-web/src/study/validate-prepared-lesson.ts`
  - Exposes an in-memory source validator while preserving the existing file-based entry point.
- `apps/pi-teaching-web/src/study/write-workspace.ts`
  - Writes/replaces a prepared Lesson and registers it idempotently in the owning Plan.
- `apps/pi-teaching-web/src/runtime/session-factory.ts`
  - Registers `lesson_prepare` for Coach only.
- `apps/pi-teaching-web/src/projection/projector.ts`
  - Gives `lesson_prepare` a safe student-visible work label.
- `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
  - Directs normal preparation through `lesson_prepare` and requires a success receipt.
- `apps/pi-teaching-web/tests/study/write-workspace.test.ts`
  - Covers new Lesson publication and replacement boundaries.
- `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
  - Covers the tool schema, authority binding, receipts, and authentic card rejection.
- `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
  - Covers Coach/Tutor tool visibility.
- `apps/pi-teaching-web/tests/projection/projector.test.ts`
  - Covers safe projection without argument leakage.
- `AGENTS.md`
  - Records the new Pi-only Coach authoring primitive.
- `apps/pi-teaching-web/README.md`
  - Describes the new preparation boundary and smoke expectation.
- `docs/zh-CN/完整说明书.md`
  - Updates the current user-facing feature reference after executable verification.

---

### Task 1: Compile a minimal LessonBlueprint into canonical Markdown

**Files:**
- Create: `apps/pi-teaching-web/src/study/lesson-blueprint.ts`
- Create: `apps/pi-teaching-web/tests/study/lesson-blueprint.test.ts`
- Modify: `apps/pi-teaching-web/src/study/validate-prepared-lesson.ts`

**Interfaces:**
- Produces:

```ts
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

export class LessonBlueprintValidationError extends Error {
  readonly code = 'LESSON_BLUEPRINT_INVALID';
  constructor(readonly issues: string[]);
}

export function validateLessonBlueprint(
  root: string,
  context: LessonRenderContext,
  blueprint: LessonBlueprint,
): void;

export function renderPreparedLesson(
  context: LessonRenderContext,
  blueprint: LessonBlueprint,
): string;

export function validatePreparedLessonSource(
  root: string,
  lessonPath: string,
  source: string,
): void;
```

- Consumes:
  - `readCard(root, cardPath)` from `highschool-study-markdown/study-domain`.
  - Existing raw Block and alias admission semantics from `validate-prepared-lesson.ts`.

- [ ] **Step 1: Write the failing renderer and source-admission tests**

Create `tests/study/lesson-blueprint.test.ts` with a copied real learning set root and one
small valid Blueprint:

```ts
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
```

- [ ] **Step 2: Run the new tests and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/lesson-blueprint.test.ts
```

Expected: FAIL because `src/study/lesson-blueprint.ts` and
`validatePreparedLessonSource` do not exist.

- [ ] **Step 3: Extract in-memory admission without changing file admission**

Refactor `validate-prepared-lesson.ts` so the existing entry point delegates to a
source entry point:

```ts
function bodyFromSource(source: string): string {
  const match = /^---[ \t]*\n[\s\S]*?\n---[ \t]*\n/.exec(source);
  return match ? source.slice(match[0].length) : source;
}

function validatePreparedLessonBody(root: string, lessonPath: string, body: string): void {
  const issues: PreparedLessonIssue[] = [];
  // Move the existing section, alias, card, and reflection checks here unchanged.
  if (issues.length > 0) throw new PreparedLessonValidationError(issues);
}

export function validatePreparedLessonSource(
  root: string,
  lessonPath: string,
  source: string,
): void {
  validatePreparedLessonBody(root, lessonPath, bodyFromSource(source));
}

export function validatePreparedLesson(root: string, lessonPath: string): void {
  const lesson = readMarkdownFile(root, lessonPath);
  validatePreparedLessonBody(root, lessonPath, lesson.body);
}
```

- [ ] **Step 4: Implement the minimal Blueprint validator and renderer**

Create `lesson-blueprint.ts`. Use `node:path.posix` because learning-set paths are
canonical `/`-separated paths:

```ts
import { posix } from 'node:path';
import { readCard } from 'highschool-study-markdown/study-domain';

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const lessonIdPattern = /^lesson-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const structuralHeading = /^#{1,3}\s/m;

export class LessonBlueprintValidationError extends Error {
  readonly code = 'LESSON_BLUEPRINT_INVALID';

  constructor(readonly issues: string[]) {
    super(`${issues.join('；')}`);
    this.name = 'LessonBlueprintValidationError';
  }
}

function nonempty(value: string): boolean {
  return value.trim().length > 0;
}

function relativeTarget(lessonPath: string, target: string): string {
  if (/^https?:\/\//.test(target)) return target;
  return posix.relative(posix.dirname(lessonPath), target);
}

export function validateLessonBlueprint(
  root: string,
  _context: LessonRenderContext,
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
    if (readCard(root, card.cardPath) === null) issues.push(`题卡不存在：${card.cardPath}`);
  }
  for (const block of blueprint.blocks) {
    for (const dependency of block.dependsOn) {
      if (!blockIds.has(dependency) || dependency === block.id) {
        issues.push(`Block ${block.id} 的依赖无效：${dependency}`);
      }
    }
    for (const alias of block.uses) {
      if (!aliases.has(alias)) issues.push(`Block ${block.id} 使用未声明 alias：${alias}`);
    }
    if (!nonempty(block.studentView) || !nonempty(block.teacherControl)) {
      issues.push(`Block ${block.id} 的 Student View 与 Teacher Control 均不能为空`);
    }
    if (structuralHeading.test(block.studentView)
      || structuralHeading.test(block.teacherControl)) {
      issues.push(`Block ${block.id} 不能嵌入一级到三级标题`);
    }
  }
  const reflections = blueprint.blocks.filter((block) => block.kind === 'reflection');
  if (reflections.length !== 1) issues.push(`需要恰好一个 reflection，当前为 ${reflections.length}`);
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

## Reflection

（课堂结束后填写）

## Lesson Summary

（课堂结束后填写）

## Aliases

${aliases}

## Traces

（课堂中通过 trace_append 追加）
`;
}
```

Use the exact exported types listed in **Interfaces** above; do not introduce a persisted
version field, duration, hint-level enum, or Blueprint ID.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
bun test tests/study/lesson-blueprint.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 6: Run existing admission tests**

Run:

```bash
bun test tests/runtime/workspace-registry.test.ts tests/server/workspace-api.test.ts
```

Expected: all existing prepared-Lesson admission tests pass unchanged.

- [ ] **Step 7: Commit the compiler boundary**

```bash
git add \
  apps/pi-teaching-web/src/study/lesson-blueprint.ts \
  apps/pi-teaching-web/src/study/validate-prepared-lesson.ts \
  apps/pi-teaching-web/tests/study/lesson-blueprint.test.ts
git commit -m "feat: compile structured lesson blueprints"
```

---

### Task 2: Publish the Lesson and register it in the current Plan

**Files:**
- Modify: `apps/pi-teaching-web/src/study/write-workspace.ts`
- Modify: `apps/pi-teaching-web/tests/study/write-workspace.test.ts`

**Interfaces:**
- Consumes:

```ts
type PreparedLessonWrite = {
  lessonId: string;
  lessonPath: string;
  lessonTitle: string;
  source: string;
};
```

- Produces:

```ts
export type RegisteredLesson = {
  id: string;
  title: string;
  path: string;
  status: 'prepared';
};

export function writePreparedLesson(
  root: string,
  planPath: string,
  input: PreparedLessonWrite,
): RegisteredLesson;
```

- [ ] **Step 1: Write failing publication tests**

Append tests that create `plans/p1.md` with a real `## Lesson Index`, then call the new
writer:

```ts
test('writes and indexes a prepared Lesson exactly once', () => {
  const { root, path: planPath } = planFixture();
  mkdirSync(join(root, 'lessons'), { recursive: true });
  const input = {
    lessonId: 'lesson-blueprint-001',
    lessonPath: 'lessons/lesson-blueprint-001.md',
    lessonTitle: 'Blueprint 试验课',
    source: `---
id: lesson-blueprint-001
kind: lesson
plan_id: p1
status: prepared
---
# Blueprint 试验课
`,
  };

  const first = writePreparedLesson(root, planPath, input);
  const afterFirst = readFileSync(join(root, planPath), 'utf8');
  const second = writePreparedLesson(root, planPath, input);

  expect(first).toEqual({
    id: 'lesson-blueprint-001',
    title: 'Blueprint 试验课',
    path: 'lessons/lesson-blueprint-001.md',
    status: 'prepared',
  });
  expect(second).toEqual(first);
  expect(afterFirst.match(/\]\(\.\.\/lessons\/lesson-blueprint-001\.md\)/g)).toHaveLength(1);
  expect(readFileSync(join(root, planPath), 'utf8')).toBe(afterFirst);
});

test('replaces prepared content but never overwrites a started Lesson', () => {
  const { root, path: planPath } = planFixture();
  mkdirSync(join(root, 'lessons'), { recursive: true });
  const lessonPath = 'lessons/lesson-blueprint-001.md';
  const prepared = `---
id: lesson-blueprint-001
kind: lesson
plan_id: p1
status: prepared
---
# First
`;
  writePreparedLesson(root, planPath, {
    lessonId: 'lesson-blueprint-001',
    lessonPath,
    lessonTitle: 'First',
    source: prepared,
  });
  writePreparedLesson(root, planPath, {
    lessonId: 'lesson-blueprint-001',
    lessonPath,
    lessonTitle: 'Reprepared',
    source: prepared.replace('# First', '# Reprepared'),
  });
  expect(readFileSync(join(root, lessonPath), 'utf8')).toContain('# Reprepared');

  writeFileSync(
    join(root, lessonPath),
    readFileSync(join(root, lessonPath), 'utf8').replace('status: prepared', 'status: active'),
  );
  expect(() => writePreparedLesson(root, planPath, {
    lessonId: 'lesson-blueprint-001',
    lessonPath,
    lessonTitle: 'Forbidden',
    source: prepared,
  })).toThrow('LESSON_REPREPARE_REQUIRES_NEW_ID');
  expect(readFileSync(join(root, lessonPath), 'utf8')).toContain('status: active');
});
```

Import `writePreparedLesson` in the test.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
bun test tests/study/write-workspace.test.ts
```

Expected: FAIL because `writePreparedLesson` is not exported.

- [ ] **Step 3: Implement the narrow writer**

Add to `write-workspace.ts`:

```ts
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, posix } from 'node:path';

export type PreparedLessonWrite = {
  lessonId: string;
  lessonPath: string;
  lessonTitle: string;
  source: string;
};

export type RegisteredLesson = {
  id: string;
  title: string;
  path: string;
  status: 'prepared';
};

function registerLessonIndex(
  planSource: string,
  planPath: string,
  lessonPath: string,
  title: string,
): string {
  const heading = /^## Lesson Index[ \t]*$/m.exec(planSource);
  if (!heading) throw new Error('SECTION_NOT_FOUND: Lesson Index');
  const sectionStart = heading.index + heading[0].length;
  const nextHeading = /^## [^\n]+$/gm;
  nextHeading.lastIndex = sectionStart;
  const sectionEnd = nextHeading.exec(planSource)?.index ?? planSource.length;
  const section = planSource.slice(sectionStart, sectionEnd);
  const target = posix.relative(posix.dirname(planPath), lessonPath);
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existing = new RegExp(
    `^([ \\t]*\\d+\\.[ \\t]+)\\[[^\\]]+\\]\\(${escaped}\\).*?$`,
    'm',
  );
  if (existing.test(section)) {
    const nextSection = section.replace(existing, `$1[${title}](${target}) — prepared。`);
    return planSource.slice(0, sectionStart) + nextSection + planSource.slice(sectionEnd);
  }
  const numbers = [...section.matchAll(/^[ \t]*(\d+)\./gm)].map((match) => Number(match[1]));
  const number = Math.max(0, ...numbers) + 1;
  const before = planSource.slice(0, sectionEnd).trimEnd();
  const after = planSource.slice(sectionEnd);
  return `${before}\n${number}. [${title}](${target}) — prepared。\n\n${after.trimStart()}`;
}

export function writePreparedLesson(
  root: string,
  planPath: string,
  input: PreparedLessonWrite,
): RegisteredLesson {
  const absolute = resolveInsideRoot(root, input.lessonPath);
  if (existsSync(absolute)) {
    const current = readMarkdownFile(root, input.lessonPath);
    if (current.frontmatter.status !== 'prepared') {
      throw new Error(`LESSON_REPREPARE_REQUIRES_NEW_ID: ${input.lessonId}`);
    }
  }
  const plan = read(root, planPath);
  const nextPlan = registerLessonIndex(
    plan.source,
    planPath,
    input.lessonPath,
    input.lessonTitle,
  );
  mkdirSync(dirname(absolute), { recursive: true });
  write(absolute, input.source);
  if (nextPlan !== plan.source) write(plan.absolute, nextPlan);
  return {
    id: input.lessonId,
    title: input.lessonTitle,
    path: input.lessonPath,
    status: 'prepared',
  };
}
```

Before writing, ensure the Plan Index transformation has already succeeded in memory. Do not
change Current Position, Next Lesson Candidate, or Plan Summary.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
bun test tests/study/write-workspace.test.ts
```

Expected: all write-workspace tests pass.

- [ ] **Step 5: Commit the publication boundary**

```bash
git add \
  apps/pi-teaching-web/src/study/write-workspace.ts \
  apps/pi-teaching-web/tests/study/write-workspace.test.ts
git commit -m "feat: publish prepared lessons through plans"
```

---

### Task 3: Expose a Session-bound Coach `lesson_prepare` tool

**Files:**
- Create: `apps/pi-teaching-web/src/runtime/lesson-prepare.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`

**Interfaces:**
- Produces:

```ts
export function createLessonPrepareTool(
  root: string,
  ownerId: string,
  ownerPath: string,
): ToolDefinition;
```

- Receipt:

```ts
type LessonPrepareReceipt = {
  ok: true;
  ownerPath: string;
  factId: string;
  status: 'prepared';
  lessonPath: string;
  blockCount: number;
};
```

- [ ] **Step 1: Write failing tool and authority tests**

Add to `tests/runtime/study-tools.test.ts`:

```ts
import { createLessonPrepareTool } from '../../src/runtime/lesson-prepare';

test('prepares and rereads one Lesson with Plan authority bound by the Coach Session', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-lesson-prepare-tool-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const tool = createLessonPrepareTool(
    temporaryRoot,
    'domain-integrity',
    'plans/domain-integrity.md',
  );
  const parameters = JSON.stringify(tool.parameters);
  expect(parameters).not.toContain('planPath');
  expect(parameters).not.toContain('lessonPath');
  expect(parameters).not.toContain('status');
  expect(parameters).not.toContain('sessionId');

  const result = await tool.execute('prepare-1', {
    lessonId: 'lesson-blueprint-001',
    title: 'Blueprint 试验课',
    planContext: '核验定义域迁移。',
    capabilityTarget: '独立写全定义域并使用。',
    primaryTemplate: 'assessment',
    templateReason: '需要未见题证据。',
    adjustments: [],
    cards: [{
      alias: 'Q-EX22',
      cardPath: 'cards/derivative/mst_p0032_ex22.card.yaml',
      role: '连续性核验',
    }],
    sources: [],
    blocks: [
      {
        id: 'assessment-01',
        kind: 'problem',
        required: true,
        dependsOn: [],
        uses: ['Q-EX22'],
        studentView: '请独立完成 `Q-EX22`。',
        teacherControl: '首次采用 zero。',
      },
      {
        id: 'reflection',
        kind: 'reflection',
        required: true,
        dependsOn: ['assessment-01'],
        uses: [],
        studentView: '总结定义域的作用。',
        teacherControl: '只引用已产生证据。',
      },
    ],
  }, undefined, undefined, {} as never);
  const receipt = JSON.parse((result.content[0] as { text: string }).text);

  expect(receipt).toEqual({
    ok: true,
    ownerPath: 'plans/domain-integrity.md',
    factId: 'lesson-blueprint-001',
    status: 'prepared',
    lessonPath: 'lessons/lesson-blueprint-001.md',
    blockCount: 2,
  });
  expect(readFileSync(
    join(temporaryRoot, 'plans/domain-integrity.md'),
    'utf8',
  )).toContain('../lessons/lesson-blueprint-001.md');
});

test('rejects a nonexistent card without writing or indexing a Lesson', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-lesson-prepare-invalid-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const tool = createLessonPrepareTool(
    temporaryRoot,
    'domain-integrity',
    'plans/domain-integrity.md',
  );
  const before = readFileSync(join(temporaryRoot, 'plans/domain-integrity.md'), 'utf8');
  await expect(tool.execute('prepare-invalid', {
    lessonId: 'lesson-blueprint-invalid',
    title: 'Invalid',
    planContext: 'Invalid',
    capabilityTarget: 'Invalid',
    primaryTemplate: 'assessment',
    templateReason: 'Invalid',
    adjustments: [],
    cards: [{ alias: 'FAKE', cardPath: 'cards/fake.card.yaml', role: 'fake' }],
    sources: [],
    blocks: [{
      id: 'reflection',
      kind: 'reflection',
      required: true,
      dependsOn: [],
      uses: ['FAKE'],
      studentView: '反思。',
      teacherControl: '反思。',
    }],
  } as never, undefined, undefined, {} as never)).rejects.toThrow('题卡不存在');
  expect(readFileSync(join(temporaryRoot, 'plans/domain-integrity.md'), 'utf8')).toBe(before);
  expect(existsSync(join(temporaryRoot, 'lessons/lesson-blueprint-invalid.md'))).toBe(false);
});
```

Add `lesson_prepare` to the expected Coach tool list in
`tests/runtime/session-factory.test.ts`, immediately before `plan_register`. Assert Tutor does
not contain it.

- [ ] **Step 2: Run focused runtime tests and verify RED**

Run:

```bash
bun test tests/runtime/study-tools.test.ts tests/runtime/session-factory.test.ts
```

Expected: FAIL because `lesson-prepare.ts` does not exist and Coach does not expose the tool.

- [ ] **Step 3: Implement the TypeBox tool**

Create `runtime/lesson-prepare.ts`:

```ts
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { readMarkdownFile } from 'highschool-study-markdown/study-domain';
import {
  renderPreparedLesson,
  validateLessonBlueprint,
  type LessonBlueprint,
} from '../study/lesson-blueprint';
import { readPlanWorkspace } from '../study/read-workspace';
import { validatePreparedLessonSource } from '../study/validate-prepared-lesson';
import { writePreparedLesson } from '../study/write-workspace';

const nonempty = Type.String({ minLength: 1 });
const block = Type.Object({
  id: nonempty,
  kind: Type.Union([
    Type.Literal('dialogue'),
    Type.Literal('problem'),
    Type.Literal('material'),
    Type.Literal('reflection'),
  ]),
  required: Type.Boolean(),
  dependsOn: Type.Array(nonempty),
  uses: Type.Array(nonempty),
  studentView: nonempty,
  teacherControl: nonempty,
});

export function createLessonPrepareTool(
  root: string,
  ownerId: string,
  ownerPath: string,
) {
  return defineTool({
    name: 'lesson_prepare',
    label: '整理课堂结构',
    description: 'Compile and publish one source-grounded prepared Lesson for the current Plan.',
    parameters: Type.Object({
      lessonId: nonempty,
      title: nonempty,
      planContext: nonempty,
      capabilityTarget: nonempty,
      primaryTemplate: nonempty,
      templateReason: nonempty,
      adjustments: Type.Array(nonempty),
      cards: Type.Array(Type.Object({
        alias: nonempty,
        cardPath: nonempty,
        role: nonempty,
      })),
      sources: Type.Array(Type.Object({
        label: nonempty,
        target: nonempty,
        note: nonempty,
      })),
      blocks: Type.Array(block, { minItems: 1 }),
    }),
    execute: async (_id, input) => {
      const lessonPath = `lessons/${input.lessonId}.md`;
      const plan = readMarkdownFile(root, ownerPath);
      const planTitle = /^#\s+(.+)$/m.exec(plan.body)?.[1]
        ?.replace(/^Plan[:：]\s*/, '').trim();
      if (!planTitle) throw new Error(`PLAN_TITLE_REQUIRED: ${ownerPath}`);
      const blueprint = input as LessonBlueprint;
      const context = { planId: ownerId, planPath: ownerPath, planTitle, lessonPath };
      validateLessonBlueprint(root, context, blueprint);
      const source = renderPreparedLesson(context, blueprint);
      validatePreparedLessonSource(root, lessonPath, source);
      writePreparedLesson(root, ownerPath, {
        lessonId: input.lessonId,
        lessonPath,
        lessonTitle: input.title,
        source,
      });
      const lesson = readPlanWorkspace(root, ownerId).lessons
        .find((candidate) => candidate.id === input.lessonId);
      if (!lesson || lesson.path !== lessonPath || lesson.status !== 'prepared') {
        throw new Error(`LESSON_PREPARE_COMMIT_FAILED: ${input.lessonId}`);
      }
      const value = {
        ok: true as const,
        ownerPath,
        factId: lesson.id,
        status: 'prepared' as const,
        lessonPath: lesson.path,
        blockCount: lesson.blocks.length,
      };
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(value) }],
        details: { kind: 'lesson-prepare', value },
      };
    },
  });
}
```

- [ ] **Step 4: Register the tool for Coach only**

In `session-factory.ts`:

```ts
import { createLessonPrepareTool } from './lesson-prepare';
```

Add `'lesson_prepare'` to `roleToolNames('coach')`, and create the custom tool in the Coach
branch:

```ts
: [
  createLessonPrepareTool(root, ownerId, ownerPath),
  createPlanRegisterTool(root),
  createPlanUpdateTool(root, ownerPath),
]),
```

Do not add it to Tutor or `createStudyTools`; the public four-tool domain surface remains
unchanged.

- [ ] **Step 5: Run focused runtime tests and verify GREEN**

Run:

```bash
bun test tests/runtime/study-tools.test.ts tests/runtime/session-factory.test.ts
```

Expected: all focused runtime tests pass.

- [ ] **Step 6: Commit the Coach tool**

```bash
git add \
  apps/pi-teaching-web/src/runtime/lesson-prepare.ts \
  apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts \
  apps/pi-teaching-web/tests/runtime/session-factory.test.ts
git commit -m "feat: add session-bound lesson preparation"
```

---

### Task 4: Project safe status and teach Coach the new boundary

**Files:**
- Modify: `apps/pi-teaching-web/src/projection/projector.ts`
- Modify: `apps/pi-teaching-web/tests/projection/projector.test.ts`
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`

**Interfaces:**
- A `projectSessionEvent` call for `toolName: 'lesson_prepare'` produces a `work-status` event
  whose label is `正在整理课堂结构` and contains no tool arguments.
- Coach considers a Lesson prepared only after `lesson_prepare` returns `ok: true` and its
  reread receipt identifies the expected Lesson.

- [ ] **Step 1: Write the failing safe-projection test**

Append:

```ts
test('projects lesson preparation without leaking the Blueprint', () => {
  const events = projectSessionEvent('coach:domain-integrity', {
    type: 'tool_execution_start',
    toolName: 'lesson_prepare',
    toolCallId: 'prepare-1',
    args: {
      teacherControl: '隐藏内容',
      cards: [{ cardPath: 'cards/private.card.yaml' }],
    },
  } as never);

  expect(events).toEqual([expect.objectContaining({
    type: 'work-status',
    tool: 'lesson_prepare',
    label: '正在整理课堂结构',
  })]);
  expect(JSON.stringify(events)).not.toContain('隐藏内容');
  expect(JSON.stringify(events)).not.toContain('private.card.yaml');
});
```

- [ ] **Step 2: Run the projector test and verify RED**

Run:

```bash
bun test tests/projection/projector.test.ts
```

Expected: FAIL because the fallback label is `正在处理`.

- [ ] **Step 3: Add the one safe label**

Add to `projection/projector.ts`:

```ts
lesson_prepare: '正在整理课堂结构',
```

- [ ] **Step 4: Run the projector test and verify GREEN**

Run:

```bash
bun test tests/projection/projector.test.ts
```

Expected: all projector tests pass.

- [ ] **Step 5: Update Coach Skill without prose tests**

Replace the direct Lesson-writing portion of steps 5–7 with these behavioral rules, preserving
the current evidence retrieval and Plan review rules:

```markdown
- After agreeing on the direction, submit the customized activity graph through
  `lesson_prepare`. Supply real `cardPath` values returned by card search, Lesson-local
  aliases, Student View, Teacher Control, dependencies, and exactly one reflection Block.
- Do not hand-write or repair executable Lesson headings, Node State fields, aliases, status,
  owner paths, or Plan Lesson Index links during normal preparation; the runtime compiles them.
- A `prepared` Lesson may reuse its ID. A started Lesson must use a new ID and preserve the old
  record.
- Announce that the Lesson is ready only after a receipt with `ok: true`, the expected
  `lessonPath`, and `status: prepared`. On `LESSON_BLUEPRINT_INVALID`, correct the listed
  structure once; do not invent a card or route around the tool with direct writes.
```

Do not add a Skill wording test.

- [ ] **Step 6: Commit projection and Coach behavior**

```bash
git add \
  apps/pi-teaching-web/src/projection/projector.ts \
  apps/pi-teaching-web/tests/projection/projector.test.ts \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md
git commit -m "feat: route Coach preparation through blueprints"
```

---

### Task 5: Verify the runtime and document the implemented boundary

**Files:**
- Modify: `AGENTS.md`
- Modify: `apps/pi-teaching-web/README.md`
- Modify: `docs/zh-CN/完整说明书.md`

**Interfaces:**
- Documentation must describe the implemented behavior, not future UI editing.
- The public MCP list remains unchanged.

- [ ] **Step 1: Run the full Pi check before claiming implementation success**

Run:

```bash
cd apps/pi-teaching-web
bun run check
```

Expected: TypeScript, all non-E2E tests, and the production build exit 0.

- [ ] **Step 2: Run browser E2E**

Run:

```bash
bun run test:e2e
```

Expected: all Playwright workspace tests pass.

- [ ] **Step 3: Prove the public plugin surface stayed at four tools**

Run:

```bash
cd ../../plugins/highschool-study
bun run release:check
```

Expected: bundle, TypeScript, tests, strict plugin validation, and the four-tool contract pass.

- [ ] **Step 4: Update current documentation**

Add the following facts, using each document's existing tone:

```text
- Pi Coach normally prepares through the Session-bound lesson_prepare tool.
- LessonBlueprint is transient; lesson.md remains the only durable source.
- The runtime binds Plan/Lesson paths, statuses, links, and initial Block state.
- Prepared Lessons can be recompiled in place; started Lessons require a replacement ID.
- Public Claude MCP remains card_search, trace_search, trace_append, source_resolve.
```

Do not document the future visual editor as implemented.

- [ ] **Step 5: Re-run documentation-adjacent checks**

Run:

```bash
cd apps/pi-teaching-web
bun run typecheck
cd ../../plugins/highschool-study
bun run validate:plugin
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit the verified feature documentation**

```bash
git add AGENTS.md apps/pi-teaching-web/README.md docs/zh-CN/完整说明书.md
git commit -m "docs: explain structured lesson preparation"
```

---

### Task 6: Run one copied-learning-set real-model preparation smoke

**Files:**
- Create: `docs/superpowers/reports/2026-07-23-structured-lesson-blueprint-live.md`
- Inspect only: the concrete `/tmp/studyforge-blueprint-smoke-XXXXXX/learning-set` path
  printed by Step 1

**Interfaces:**
- Input prompt:

```text
请为当前 Plan 直接准备下一节短课。选择最合适的现有课堂模板，绑定至少两张真实题卡，
包含一个可选节点和恰好一个 reflection 节点。学生视图不要剧透；正常备课只使用
lesson_prepare，不要用 write/edit 手工拼接或修复 Lesson Markdown。
```

- Success criteria:
  - real Coach calls `lesson_prepare`;
  - one call creates an indexed `prepared` Lesson;
  - no direct `write` / `edit` Lesson repair;
  - generated Markdown passes admission on first start;
  - Student View does not expose Teacher Control;
  - repository example remains byte-for-byte unchanged.

- [ ] **Step 1: Create an isolated learning-set copy**

Run from repository root:

```bash
smoke_root="$(mktemp -d /tmp/studyforge-blueprint-smoke-XXXXXX)"
cp -R examples/derivative-demo/learning-set "$smoke_root/learning-set"
git diff -- examples/derivative-demo/learning-set
```

Expected: `smoke_root` is printed by the shell assignment when inspected, and Git reports no
example changes.

- [ ] **Step 2: Start the verified app on a free local port**

Run:

```bash
cd apps/pi-teaching-web
STUDY_LEARNING_SET="$smoke_root/learning-set" STUDY_WEB_PORT=65431 bun run start
```

Expected: server listens on `http://127.0.0.1:65431`.

- [ ] **Step 3: Use the real Coach through the browser**

Open the copied learning set, enter one active Plan, send the exact prompt above, and wait for
the Coach run to finish. Do not manually edit the generated Lesson.

Expected visible sequence:

```text
正在查找真实题卡
正在整理课堂结构
课堂准备完成的 Coach 文本
```

- [ ] **Step 4: Inspect durable and raw evidence**

Check:

```bash
rg -n "lesson_prepare|\"toolName\":\"write\"|\"toolName\":\"edit\"" "$smoke_root" ~/.pi/agent/sessions
rg -n "^## Block|^### Node State|^### Student View|^### Teacher Control|^## Aliases" \
  "$smoke_root/learning-set/lessons"
rg -n "lessons/.*\\.md" "$smoke_root/learning-set/plans"
```

Expected:

- the relevant Coach Session contains one successful `lesson_prepare`;
- it contains no direct Lesson `write` / `edit` repair after the tool;
- the Lesson contains canonical Block structures and real aliases;
- its owning Plan contains one link to the new Lesson.

- [ ] **Step 5: Start the generated Lesson once**

Click the new Lesson and start it.

Expected:

- no `PREPARED_LESSON_INVALID`;
- Lesson moves to `active`;
- Tutor opens an independent Session;
- the first Student View contains no Teacher Control text.

Stop before manufacturing assessment evidence; this smoke tests preparation and handoff, not
the quality of a full class.

- [ ] **Step 6: Record the result**

Write `docs/superpowers/reports/2026-07-23-structured-lesson-blueprint-live.md`. Populate every
identity value from the actual run: app commit, copied learning-set path, runtime URL,
provider/model name, Plan ID, created Lesson ID, Coach Session ID, and Tutor Session ID.
Then record exactly these six result rows with a concrete `PASS` or `FAIL` and a source path,
receipt ID, or observed UI state:

```markdown
# 结构化备课本真模试验

## Run Identity

- App commit
- Copied learning set
- Runtime URL
- Provider/model
- Plan
- Created Lesson
- Coach Session
- Tutor Session

## Results

| Boundary | Result | Evidence |
| --- | --- | --- |
| Structured authoring | PASS or FAIL | Tool receipt and Coach Session source |
| Authentic cards | PASS or FAIL | Resolved card paths |
| Canonical Markdown | PASS or FAIL | Generated Lesson path |
| Plan indexing | PASS or FAIL | Owning Plan path |
| First-start admission | PASS or FAIL | Start response and Lesson status |
| Student-view secrecy | PASS or FAIL | First projected activity |

## Observations

- Record only observed issues; do not infer a framework from one retry.

## Conclusion

- State whether the Blueprint reduced format repair and what smallest next change is justified.
```

Do not include provider credentials or full private transcript content.

- [ ] **Step 7: Verify the public example is untouched**

Run:

```bash
git diff --exit-code -- examples/derivative-demo/learning-set
```

Expected: exit 0.

- [ ] **Step 8: Commit only the acceptance report**

```bash
git add docs/superpowers/reports/2026-07-23-structured-lesson-blueprint-live.md
git commit -m "docs: report structured lesson preparation smoke"
```

If the real model fails, commit the truthful FAIL report only after the deterministic test
suite remains green; do not silently broaden the implementation during the smoke.

---

## Final Verification

- [ ] `git diff --check`
- [ ] `cd apps/pi-teaching-web && bun run check`
- [ ] `cd apps/pi-teaching-web && bun run test:e2e`
- [ ] `cd plugins/highschool-study && bun run release:check`
- [ ] `git diff --exit-code -- examples/derivative-demo/learning-set`
- [ ] Inspect `git status --short` and preserve unrelated user changes.
- [ ] Compare every implemented file and behavior against
  `docs/superpowers/specs/2026-07-23-structured-lesson-blueprint-design.md`.
