# Strict Plan Contract and Cross-Treatment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reject every incomplete or legacy Plan at the shared Markdown boundary, then rerun the controlled history-swap gate and continue the matched-versus-mismatched two-Lesson cross-treatment when that gate passes.

**Architecture:** Add one canonical Plan validator to the shared `highschool-study-markdown` domain so Claude and Pi consume the same contract. `plan_register` inherits strict, pre-write validation from that reader; checked-in fixtures move to the current eight-section shape rather than using a migration layer. Freeze the resulting candidate commit before any real-model traffic, rerun planning on corrected histories, and only then create four treatment branches for outcome comparison.

**Tech Stack:** Bun 1.3.14, TypeScript 7, shared Markdown domain, Pi coding-agent runtime, React 19, Playwright 1.61, Markdown learning sets, Git.

## Global Constraints

- Do not add a schema version, migration layer, compatibility fallback, database, LangGraph workflow, or public MCP tool.
- A Plan status is exactly `ready`, `active`, or `completed`.
- Every Plan has exactly one non-empty H1 and exactly one non-empty body for each of the eight required H2 sections.
- Extra H2 sections are allowed; required-section order is not significant.
- `coach_session` is optional, but when present must be `null` or a string.
- Invalid Plan reads fail the entire learning set; do not hide or skip the invalid Plan.
- Invalid registration leaves Plan and Roadmap byte-for-byte unchanged.
- Do not add sentence-level tests for Skill prose.
- Do not modify product code, Skills, prompts, candidate Plans, or controlled histories after real-model traffic starts.
- Do not print or commit credentials, raw private child conclusions, hidden Teacher Control, or tool arguments.
- Cross-treatment starts only after both corrected history-swap pairs pass the strict planning gate.

---

### Task 1: Enforce one canonical Plan document contract

**Files:**
- Create: `plugins/highschool-study/server/src/plan-document.ts`
- Modify: `plugins/highschool-study/server/src/errors.ts`
- Modify: `plugins/highschool-study/server/src/markdown.ts`
- Modify: `plugins/highschool-study/tests/unit/learning-set.test.ts`
- Modify: `plugins/highschool-study/tests/fixtures/learning-set/plans/max-value.md`
- Modify: `plugins/highschool-study/tests/fixtures/learning-set/plans/transfer.md`
- Modify: `plugins/highschool-study/tests/integration/method-signals.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/write-workspace.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/read-workspace.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`
- Modify: `apps/pi-teaching-web/tests/client/session-tree.test.tsx`
- Modify: `apps/pi-teaching-web/tests/client/state.test.ts`

**Interfaces:**
- Produces:

```ts
export const PLAN_REQUIRED_SECTIONS: readonly string[];

export function validatePlanDocument(
  path: string,
  frontmatter: Record<string, unknown>,
  body: string,
): void;
```

- `readMarkdownFile(root, "plans/{id}.md")` calls this validator after canonical path and filename-ID validation.
- Existing callers keep the same return type; invalid Plans throw `StudyError`.

- [ ] **Step 1: Add failing shared-reader tests**

In `plugins/highschool-study/tests/unit/learning-set.test.ts`, add a local strict Plan builder and focused tests:

```ts
const requiredPlanSections = [
  'Goal',
  'Observable Capability Standard',
  'Test',
  'Planning Basis',
  'Lesson Index',
  'Current Position',
  'Next Lesson Candidate',
  'Plan Summary',
] as const;

function strictPlanSource(options: {
  kind?: string;
  status?: string;
  coachSession?: string;
  omit?: string;
  empty?: string;
  duplicate?: string;
  missingTitle?: boolean;
  duplicateTitle?: boolean;
  reverse?: boolean;
  extra?: string;
} = {}): string {
  const headings = options.reverse
    ? [...requiredPlanSections].reverse()
    : [...requiredPlanSections];
  const sections = headings
    .filter((heading) => heading !== options.omit)
    .map((heading) => [
      `## ${heading}`,
      '',
      heading === options.empty ? '   ' : `${heading} content.`,
      options.duplicate === heading
        ? `\n## ${heading}\n\nDuplicate content.`
        : '',
    ].join('\n'))
    .join('\n\n');
  const coachSession = options.coachSession === undefined
    ? ''
    : `coach_session: ${options.coachSession}\n`;
  return `---
id: strict-plan
kind: ${options.kind ?? 'plan'}
status: ${options.status ?? 'active'}
${coachSession}---
${options.missingTitle ? '' : '# Strict Plan'}
${options.duplicateTitle ? '\n# Duplicate title\n' : ''}
${sections}
${options.extra ?? ''}
`;
}

test('rejects every missing or empty required Plan section', () => {
  for (const heading of requiredPlanSections) {
    const root = makeLearningSet();
    writeFileSync(
      join(root, 'plans/strict-plan.md'),
      strictPlanSource({ omit: heading }),
    );
    expect(() => readMarkdownFile(root, 'plans/strict-plan.md')).toThrow(
      `PLAN_SECTION_REQUIRED: plans/strict-plan.md#${heading.toLowerCase().replaceAll(' ', '-')}`,
    );

    writeFileSync(
      join(root, 'plans/strict-plan.md'),
      strictPlanSource({ empty: heading }),
    );
    expect(() => readMarkdownFile(root, 'plans/strict-plan.md')).toThrow(
      `PLAN_SECTION_REQUIRED: plans/strict-plan.md#${heading.toLowerCase().replaceAll(' ', '-')}`,
    );
  }
});

test('rejects duplicate Plan structure and invalid frontmatter', () => {
  const root = makeLearningSet();
  const path = join(root, 'plans/strict-plan.md');

  writeFileSync(path, strictPlanSource({ duplicate: 'Planning Basis' }));
  expect(() => readMarkdownFile(root, 'plans/strict-plan.md')).toThrow(
    'PLAN_SECTION_DUPLICATE: plans/strict-plan.md#planning-basis',
  );

  writeFileSync(path, strictPlanSource({ duplicateTitle: true }));
  expect(() => readMarkdownFile(root, 'plans/strict-plan.md')).toThrow(
    'PLAN_TITLE_DUPLICATE: plans/strict-plan.md',
  );

  writeFileSync(path, strictPlanSource({ missingTitle: true }));
  expect(() => readMarkdownFile(root, 'plans/strict-plan.md')).toThrow(
    'PLAN_TITLE_REQUIRED: plans/strict-plan.md',
  );

  writeFileSync(path, strictPlanSource({ kind: 'lesson' }));
  expect(() => readMarkdownFile(root, 'plans/strict-plan.md')).toThrow(
    'INVALID_PLAN_KIND: plans/strict-plan.md',
  );

  writeFileSync(path, strictPlanSource({ status: 'prepared' }));
  expect(() => readMarkdownFile(root, 'plans/strict-plan.md')).toThrow(
    'INVALID_PLAN_STATUS: plans/strict-plan.md',
  );

  writeFileSync(path, strictPlanSource({ coachSession: '[]' }));
  expect(() => readMarkdownFile(root, 'plans/strict-plan.md')).toThrow(
    'INVALID_PLAN_COACH_SESSION: plans/strict-plan.md',
  );
});

test('accepts extra Plan sections and ignores fenced fake headings', () => {
  const root = makeLearningSet();
  writeFileSync(
    join(root, 'plans/strict-plan.md'),
    strictPlanSource({
      reverse: true,
      extra: '\n## Optional Analysis\n\n```md\n## Planning Basis\n\nfake\n```\n',
    }),
  );
  expect(readMarkdownFile(root, 'plans/strict-plan.md')).toMatchObject({
    id: 'strict-plan',
    frontmatter: { kind: 'plan', status: 'active' },
  });
});
```

- [ ] **Step 2: Add the failing `blue-2` registration regression**

First make `registrationFixture()` in
`apps/pi-teaching-web/tests/study/write-workspace.test.ts` a valid current Plan by
using this complete body:

```md
# Plan：同构变形

## Goal

识别同构结构。

## Observable Capability Standard

在陌生外壳中独立说明同构结构。

## Test

完成一张未见题的首次尝试。

## Planning Basis

当前需要区分结构识别与计算执行。来源：[Roadmap](../ROADMAP.md#goal)。

## Lesson Index

尚未创建 Lesson。

## Current Position

等待开始。

## Next Lesson Candidate

准备一节诊断课。

## Plan Summary

尚无课堂结果。
```

Then add:

```ts
test('rejects an incomplete Plan before changing the Roadmap', () => {
  const { root, roadmapPath, planPath } = registrationFixture();
  const incomplete = readFileSync(planPath, 'utf8')
    .replace(/\n## Planning Basis[\s\S]*?(?=\n## Lesson Index)/, '')
    .replace(/\n## Lesson Index[\s\S]*?(?=\n## Current Position)/, '');
  writeFileSync(planPath, incomplete);
  const planBefore = readFileSync(planPath, 'utf8');
  const roadmapBefore = readFileSync(roadmapPath, 'utf8');

  expect(() => registerPlan(root, 'isomorphic-transformation')).toThrow(
    'PLAN_SECTION_REQUIRED: plans/isomorphic-transformation.md#planning-basis',
  );
  expect(readFileSync(planPath, 'utf8')).toBe(planBefore);
  expect(readFileSync(roadmapPath, 'utf8')).toBe(roadmapBefore);
});
```

Also add this read-boundary regression to
`apps/pi-teaching-web/tests/study/read-workspace.test.ts`, importing `cpSync`,
`mkdtempSync`, `readFileSync`, `rmSync`, `writeFileSync`, `tmpdir` and `join`:

```ts
test('rejects a linked legacy Plan instead of projecting an empty rationale', () => {
  const copy = mkdtempSync(join(tmpdir(), 'study-strict-read-'));
  try {
    cpSync(root, copy, { recursive: true });
    const path = join(copy, 'plans/domain-integrity.md');
    writeFileSync(
      path,
      readFileSync(path, 'utf8')
        .replace(/\n## Planning Basis[\s\S]*?(?=\n## Lesson Index)/, ''),
    );
    expect(() => readLearningSet(copy)).toThrow(
      'PLAN_SECTION_REQUIRED: plans/domain-integrity.md#planning-basis',
    );
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});
```

- [ ] **Step 3: Run the two RED tests**

Run:

```bash
cd plugins/highschool-study
bun test tests/unit/learning-set.test.ts

cd ../../apps/pi-teaching-web
bun test \
  tests/study/write-workspace.test.ts \
  tests/study/read-workspace.test.ts \
  --test-name-pattern "rejects"
```

Expected:

- shared-reader tests fail because incomplete Plan files still load;
- registration regression fails because `registerPlan` still accepts the incomplete
  file and modifies Roadmap.

- [ ] **Step 4: Add stable Plan errors**

Extend `plugins/highschool-study/server/src/errors.ts`:

```ts
export type StudyErrorCode =
  | 'OUTSIDE_LEARNING_SET'
  | 'INVALID_DOCUMENT_ID'
  | 'INVALID_PLAN_KIND'
  | 'INVALID_PLAN_STATUS'
  | 'INVALID_PLAN_COACH_SESSION'
  | 'PLAN_TITLE_REQUIRED'
  | 'PLAN_TITLE_DUPLICATE'
  | 'PLAN_SECTION_REQUIRED'
  | 'PLAN_SECTION_DUPLICATE';

export class StudyError extends Error {
  readonly code: StudyErrorCode;

  constructor(code: StudyErrorCode, detail?: string) {
    super(detail === undefined ? code : `${code}: ${detail}`);
    this.name = 'StudyError';
    this.code = code;
  }
}
```

Keep `isStudyError` unchanged.

- [ ] **Step 5: Implement the canonical Plan validator**

Create `plugins/highschool-study/server/src/plan-document.ts` with:

```ts
import { StudyError } from './errors';

export const PLAN_REQUIRED_SECTIONS = [
  'Goal',
  'Observable Capability Standard',
  'Test',
  'Planning Basis',
  'Lesson Index',
  'Current Position',
  'Next Lesson Candidate',
  'Plan Summary',
] as const;

type Heading = {
  level: number;
  text: string;
  line: number;
};

function planAnchor(heading: string): string {
  return heading.toLowerCase().replaceAll(' ', '-');
}

function structuralHeadings(body: string): { headings: Heading[]; lines: string[] } {
  const lines = body.split(/\r?\n/);
  const headings: Heading[] = [];
  let fence: { marker: '`' | '~'; length: number } | null = null;

  for (let line = 0; line < lines.length; line += 1) {
    const value = lines[line] ?? '';
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(value);
    if (fence !== null) {
      if (fenceMatch?.[1]?.startsWith(fence.marker)
        && fenceMatch[1].length >= fence.length
        && /^[ \t]*$/.test(fenceMatch[2] ?? '')) {
        fence = null;
      }
      continue;
    }
    if (fenceMatch?.[1]) {
      fence = {
        marker: fenceMatch[1][0] as '`' | '~',
        length: fenceMatch[1].length,
      };
      continue;
    }
    const atx = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*$/.exec(value);
    if (!atx?.[1] || !atx[2]) continue;
    headings.push({
      level: atx[1].length,
      text: atx[2].replace(/[ \t]+#+[ \t]*$/, '').trim(),
      line,
    });
  }
  return { headings, lines };
}

export function validatePlanDocument(
  path: string,
  frontmatter: Record<string, unknown>,
  body: string,
): void {
  if (frontmatter.kind !== 'plan') {
    throw new StudyError('INVALID_PLAN_KIND', path);
  }
  if (!['ready', 'active', 'completed'].includes(String(frontmatter.status ?? ''))) {
    throw new StudyError('INVALID_PLAN_STATUS', path);
  }
  if (
    Object.hasOwn(frontmatter, 'coach_session')
    && frontmatter.coach_session !== null
    && typeof frontmatter.coach_session !== 'string'
  ) {
    throw new StudyError('INVALID_PLAN_COACH_SESSION', path);
  }

  const { headings, lines } = structuralHeadings(body);
  const titles = headings.filter((heading) => heading.level === 1);
  if (titles.length === 0 || titles[0]!.text === '') {
    throw new StudyError('PLAN_TITLE_REQUIRED', path);
  }
  if (titles.length > 1) {
    throw new StudyError('PLAN_TITLE_DUPLICATE', path);
  }

  for (const required of PLAN_REQUIRED_SECTIONS) {
    const matches = headings.filter(
      (heading) => heading.level === 2 && heading.text === required,
    );
    const detail = `${path}#${planAnchor(required)}`;
    if (matches.length > 1) {
      throw new StudyError('PLAN_SECTION_DUPLICATE', detail);
    }
    const match = matches[0];
    if (!match) throw new StudyError('PLAN_SECTION_REQUIRED', detail);
    const nextBoundary = headings.find(
      (heading) => heading.line > match.line && heading.level <= 2,
    );
    const bodyEnd = nextBoundary?.line ?? lines.length;
    if (lines.slice(match.line + 1, bodyEnd).join('\n').trim() === '') {
      throw new StudyError('PLAN_SECTION_REQUIRED', detail);
    }
  }
}
```

- [ ] **Step 6: Invoke validation from the shared Markdown reader**

In `plugins/highschool-study/server/src/markdown.ts`:

```ts
import { validatePlanDocument } from './plan-document';
```

After existing filename-ID validation and before returning:

```ts
if (/^plans\/[^/]+\.md$/.test(normalizedPath)) {
  validatePlanDocument(normalizedPath, frontmatter, body);
}
```

Do not duplicate the eight-section checks in Pi or `registerPlan`.

- [ ] **Step 7: Migrate every checked-in Plan fixture**

Bring these fixtures to the exact eight-section contract while preserving their
existing teaching content:

- `plugins/highschool-study/tests/fixtures/learning-set/plans/max-value.md`
- `plugins/highschool-study/tests/fixtures/learning-set/plans/transfer.md`
- the `max-value.md` string in
  `plugins/highschool-study/tests/integration/method-signals.test.ts`
- `planFixture()` and `registrationFixture()` in
  `apps/pi-teaching-web/tests/study/write-workspace.test.ts`
- the generated Plan in `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- the generated Plan in `apps/pi-teaching-web/tests/e2e/fixture-server.ts`

Use this minimal content where a fixture has no meaningful value yet:

```md
## Goal

完成当前测试 Plan。

## Observable Capability Standard

满足本测试声明的可观察行为。

## Test

完成一次与该能力标准对应的验证。

## Planning Basis

当前测试需要一份完整 Plan。来源：[Roadmap](../ROADMAP.md#plan-graph)。

## Lesson Index

尚未创建 Lesson。

## Current Position

等待开始。

## Next Lesson Candidate

由当前测试决定。

## Plan Summary

尚无课堂结果。
```

Change test-only `status: prepared` to `status: active`. Keep `ready` and `completed`
fixtures where those statuses are part of the test. In
`apps/pi-teaching-web/tests/study/write-workspace.test.ts`, also change the test setup
that replaces `status: prepared` with `status: completed` so it replaces
`status: active` instead.

Replace empty mock values in:

```ts
planningBasis: '当前测试 Plan 的公开安排依据。'
```

in:

- `apps/pi-teaching-web/tests/client/session-tree.test.tsx`
- `apps/pi-teaching-web/tests/client/state.test.ts`

Update the runtime registration receipt test so its generated Plan is complete and add:

```ts
expect(JSON.parse((result.content[0] as { text: string }).text))
  .toMatchObject({
    plan: {
      planningBasis: expect.stringContaining('完整 Plan'),
    },
  });
```

- [ ] **Step 8: Verify GREEN**

Run:

```bash
cd plugins/highschool-study
bun run check

cd ../../apps/pi-teaching-web
bun run typecheck
bun run test
```

Expected: plugin tests and all non-E2E Pi tests pass; no Plan fixture uses the
old shape.

- [ ] **Step 9: Commit the strict contract**

```bash
git add \
  plugins/highschool-study/server/src/plan-document.ts \
  plugins/highschool-study/server/src/errors.ts \
  plugins/highschool-study/server/src/markdown.ts \
  plugins/highschool-study/tests \
  apps/pi-teaching-web/tests
git commit -m "feat: enforce strict plan documents"
```

---

### Task 2: Remove legacy wording and define source priority

**Files:**
- Modify: `apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md`
- Modify: `plugins/highschool-study/skills/plan-next-cycle/SKILL.md`
- Modify: `apps/pi-teaching-web/README.md`
- Modify: `plugins/highschool-study/README.md`
- Modify: `docs/design/architecture.zh-CN.md`
- Modify: `docs/design/architecture.en.md`
- Modify: `docs/zh-CN/完整说明书.md`

**Interfaces:**
- Consumes: the strict shared Plan contract from Task 1.
- Produces: identical Claude/Pi authoring expectations and an explicit source-priority
  rule for the real-model rerun.

- [ ] **Step 1: Update both `plan-next-cycle` Skills**

After the existing retrieval instructions, add this exact rule to both Skill variants:

```md
When sources disagree, active Trace owns attempt outcome, support, actual method and
recorded time. A source-linked Lesson or Plan Summary is the compact retrieval index,
not permission to override conflicting original facts. Planner Attention is a
rebuildable preparation signal. Do not use a hand-authored or explicitly prototype
HEATMAP as current learner evidence. Open the decisive original source before choosing
between Plans when a conflict could change the direction.
```

Change the write instruction from advisory wording to:

```md
Every Plan must contain exactly one non-empty Goal, Observable Capability Standard,
Test, Planning Basis, Lesson Index, Current Position, Next Lesson Candidate and Plan
Summary section. `plan_register` rejects the whole Plan when any required section is
missing, empty or duplicated. Repair the same file and retry; do not report success
until the returned Plan has a non-empty `planningBasis`.
```

Do not add a prose-string test.

- [ ] **Step 2: Replace legacy compatibility documentation**

In every listed README/manual/architecture document, remove statements equivalent to:

```text
Planning Basis is optional.
Old Plans need no migration.
The panel is hidden when an old Plan has no Planning Basis.
```

Replace them with:

```text
Every Plan uses the current eight-section contract. The shared reader rejects an old
or incomplete Plan before the learning set opens or the Plan is registered. There is
no automatic migration: add the missing sections manually, preserving the original
content and sources, before using the new runtime.
```

Document the same source priority used by the two Skills:

```text
active Trace → source-linked Lesson/Plan Summary → Planner Attention
```

State separately that a manually maintained prototype HEATMAP is not current learner
evidence.

- [ ] **Step 3: Run structural and documentation verification**

Run:

```bash
rg -n -i \
  "旧 Plan 无须迁移|旧 Plan.*没有这个小节|Readers treat the section as optional|old Plans need" \
  apps/pi-teaching-web/README.md \
  plugins/highschool-study/README.md \
  docs/design/architecture.zh-CN.md \
  docs/design/architecture.en.md \
  docs/zh-CN/完整说明书.md

cd plugins/highschool-study
bun run release:check

cd ../../apps/pi-teaching-web
bun run check
```

Expected:

- the legacy phrases have zero matches;
- plugin validation and all deterministic checks pass;
- public MCP tool count remains four.

- [ ] **Step 4: Commit Skill and documentation alignment**

```bash
git add \
  apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md \
  plugins/highschool-study/skills/plan-next-cycle/SKILL.md \
  apps/pi-teaching-web/README.md \
  plugins/highschool-study/README.md \
  docs/design/architecture.zh-CN.md \
  docs/design/architecture.en.md \
  docs/zh-CN/完整说明书.md
git commit -m "docs: require the current plan contract"
```

---

### Task 3: Freeze and verify the deterministic candidate

**Files:**
- Do not modify product files in this task.

**Interfaces:**
- Produces: `candidateCommit`, a clean worktree, and a deterministic verification
  record used by the real-model stages.

- [ ] **Step 1: Run the complete deterministic suite**

Run:

```bash
git diff --check
git status --short

cd plugins/highschool-study
bun run release:check

cd ../../apps/pi-teaching-web
bun run check
bun run test:e2e
```

Expected:

- plugin: 52 or more tests pass, strict plugin validation passes;
- Pi: 170 or more unit/integration tests pass and build succeeds;
- Playwright: all 13 or more E2E tests pass;
- worktree is clean after generated build artifacts are ignored.

- [ ] **Step 2: Prove legacy Plans fail**

Copy the valid domain-integrity fixture to a temporary root, remove
`## Planning Basis`, and run a one-line Bun import of `readLearningSet`.

```bash
STRICT_SMOKE="$(mktemp -d /tmp/studyforge-strict-plan-XXXXXX)"
cp -R apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/. "$STRICT_SMOKE/"
perl -0pi -e 's/\\n## Planning Basis.*?(?=\\n## Lesson Index)//s' \
  "$STRICT_SMOKE/plans/domain-integrity.md"
STRICT_SMOKE="$STRICT_SMOKE" bun -e \
  'import { readLearningSet } from "./apps/pi-teaching-web/src/study/read-workspace.ts";
   readLearningSet(process.env.STRICT_SMOKE!);'
```

Expected: non-zero exit with:

```text
PLAN_SECTION_REQUIRED: plans/domain-integrity.md#planning-basis
```

- [ ] **Step 3: Freeze identities**

Run:

```bash
git rev-parse HEAD
git status --short
git diff --exit-code "$(git merge-base HEAD main)" -- \
  examples/derivative-demo/learning-set
```

Store the HEAD as `candidateCommit`. Expected: clean status and unchanged repository
demo.

---

### Task 4: Rerun the corrected four-session planning gate

**Files:**
- Modify after scoring only:
  `docs/audits/2026-07-27-longitudinal-personalization-acceptance.md`
- Do not modify product source, Skills, prompts, candidate Plans, or repository
  learning-set fixtures.

**Interfaces:**
- Consumes: `candidateCommit` from Task 3.
- Produces: four strict `cycle-04.md` files, two blinded pair scores, and either a
  `PLANNING_ONLY` gate pass or a recorded stop.

- [ ] **Step 1: Load the real-model validation procedure**

Read and follow:

```text
/Users/yangrundong/.codex/skills/studyclaw-e2e-validation/SKILL.md
```

Use visible browser actions through Playwright/Chromium, preserve raw Pi JSONL, use
safe message projection, and shut every server down after the run. Never print auth
files or environment keys.

- [ ] **Step 2: Create fresh isolated roots**

Create a new root; do not reuse `/tmp/studyforge-personalization-20260727-vH7G0x`.

```bash
ACCEPT_ROOT="$(mktemp -d /tmp/studyforge-strict-personalization-XXXXXX)"
for name in red-1 blue-1 red-2 blue-2; do
  mkdir -p "$ACCEPT_ROOT/$name"
  cp -R examples/derivative-demo/learning-set \
    "$ACCEPT_ROOT/$name/learning-set"
  mkdir -p "$ACCEPT_ROOT/$name/pi-agent"
done
```

Configure all four Pi roots without printing credentials:

```json
{
  "defaultProvider": "deepseek",
  "defaultModel": "deepseek-v4-pro",
  "defaultThinkingLevel": "high"
}
```

Use persona `calm-senpai`, deep mode off, safe projection, and confirm ports
`65431`, `65432`, `65433`, and `65434` are free before starting.

- [ ] **Step 3: Seed corrected controlled histories**

Use the same Roadmap, profiles, cards and attempt totals in every root:

| Attempt | Card | History A | History B |
| --- | --- | --- | --- |
| 1 | `mst_p0016_ex01` | correct / none; familiar structure independent | correct / none; structure and calculation independent |
| 2 | `mst_p0016_ex02` | correct / none; familiar shell independent | correct / none; structure and calculation independent |
| 3 | `mst_p0017_ex05` | correct / none; fluent after recognition | partially_correct / tutor; omitted `a>0`, corrected after prompt |
| 4 | `mst_p0019_ex11` | correct / none; domain written first | partially_correct / tutor; omitted logarithm domain |
| 5 | `mst_p0020_ex12` | partially_correct / tutor; method-start hint needed | correct / none; written checkpoint used |
| 6 | `mst_p0032_ex22` | partially_correct / tutor; new shell again blocked | correct / none; checkpoint transferred to another shell |

Use:

```text
cycle-01 → lesson-001, lesson-002
cycle-02 → lesson-003, lesson-004
cycle-03 → lesson-005, lesson-006
```

Use identical timestamps in A and B, with the final two less than seven days apart:

```text
2026-01-05T09:00:00.000Z
2026-01-12T09:00:00.000Z
2026-02-02T09:00:00.000Z
2026-02-09T09:00:00.000Z
2026-03-02T09:00:00.000Z
2026-03-04T09:00:00.000Z
```

Every seeded Plan must satisfy the strict eight-section contract. In History B,
`cycle-03` says:

```text
The written checkpoint has two near-transfer successes across different shells.
Delayed retention remains untested because both attempts occurred in the same short
observation window.
```

Rebuild `memory/planner-attention.md` from active Trace in every root. Do not use
`graph/HEATMAP.md` as a seeded longitudinal fact.

Assign:

```text
red-1  = A
blue-1 = B
red-2  = B
blue-2 = A
```

- [ ] **Step 4: Verify controls before traffic**

Write a temporary verifier under `$ACCEPT_ROOT` and assert:

- exactly three completed strict Plans and six closed Lessons;
- four correct, two partially correct, two Tutor-supported attempts;
- all six real card paths resolve;
- all required Plan sections exist and are non-empty;
- Lesson 005 to 006 elapsed time is exactly two days;
- Roadmap, profiles, card tree, graph and learning guide hashes match across roots;
- Planner Attention hashes match across roots;
- no `cycle-04`, next Plan or Planning Basis beyond the three seeded Plans exists;
- only the specified longitudinal notes and summaries differ.

Stop before model traffic if any assertion fails.

- [ ] **Step 5: Start four servers and send the identical planning request**

Build once:

```bash
cd apps/pi-teaching-web
bun run build
```

Start one process per root in four persistent terminal sessions:

```bash
PI_CODING_AGENT_DIR="$ACCEPT_ROOT/red-1/pi-agent" \
STUDY_LEARNING_SET="$ACCEPT_ROOT/red-1/learning-set" \
STUDY_WEB_PORT=65431 \
STUDYFORGE_MESSAGE_PROJECTION=safe \
bun run start

PI_CODING_AGENT_DIR="$ACCEPT_ROOT/blue-1/pi-agent" \
STUDY_LEARNING_SET="$ACCEPT_ROOT/blue-1/learning-set" \
STUDY_WEB_PORT=65432 \
STUDYFORGE_MESSAGE_PROJECTION=safe \
bun run start

PI_CODING_AGENT_DIR="$ACCEPT_ROOT/red-2/pi-agent" \
STUDY_LEARNING_SET="$ACCEPT_ROOT/red-2/learning-set" \
STUDY_WEB_PORT=65433 \
STUDYFORGE_MESSAGE_PROJECTION=safe \
bun run start

PI_CODING_AGENT_DIR="$ACCEPT_ROOT/blue-2/pi-agent" \
STUDY_LEARNING_SET="$ACCEPT_ROOT/blue-2/learning-set" \
STUDY_WEB_PORT=65434 \
STUDYFORGE_MESSAGE_PROJECTION=safe \
bun run start
```

Through visible browser UI, send to each `coach:cycle-03`:

```text
我准备进入下一个学习阶段。请根据已有 Roadmap 和长期学习记录，
判断现在最值得改变的一个认知动作；如果证据不足，就先建议一个短诊断 Plan。
请先说明判断、真正影响决定的来源和可能推翻它的后续表现，等我确认后再创建 Plan。
```

After the recommendation, send unchanged:

```text
我确认按这个方向进入下一 Plan。请写入、注册并重新读取后告诉我最终状态。
```

Do not help Coach repair an invalid Plan. A strict tool error may trigger autonomous
same-turn repair; preserve the full raw sequence.

- [ ] **Step 6: Audit strict persistence**

For each root verify:

- exactly one new `plans/cycle-04.md`;
- all eight sections occur once and are non-empty;
- `planningBasis` in the `plan_register` receipt is non-empty;
- the matching Roadmap entry exists once;
- Coach reread Plan and Roadmap after the final successful registration;
- every decisive Markdown link resolves;
- no writes occurred outside that root;
- provider/model/thinking/persona/deep-mode settings match;
- no student-visible console error or private projection leak occurred.

Treat any unrepaired strict rejection as a planning-gate failure.

- [ ] **Step 7: Blind and score both swapped pairs**

Create random learner aliases after capture. Include only:

- safe recommendation before confirmation;
- final persisted Goal, capability standard, Test and Planning Basis;
- resolvable source paths;
- strict registration success.

Keep the mapping unread while an isolated no-tool evaluator scores:

1. materially different cognitive action;
2. direction caused by supplied history;
3. evidence distinguished from hypothesis;
4. prior intervention response used;
5. different validation/replanning signals;
6. authentic decisive sources;
7. complete strict Plan persistence.

Both pairs must pass after unblinding.

- [ ] **Step 8: Update and commit the planning-gate report**

Append a “Strict-contract rerun” section to:

```text
docs/audits/2026-07-27-longitudinal-personalization-acceptance.md
```

Record run identities, corrected control hashes, raw Session IDs, randomized mapping,
blind scores, strict registration retries, source audit and result.

If both pairs pass, set the intermediate result to `PLANNING_ONLY` and record the
predeclared pair-one treatment Plans. Otherwise retain `NO_EFFECT`, shut down all
servers, commit the report and stop.

```bash
git add docs/audits/2026-07-27-longitudinal-personalization-acceptance.md
git commit -m "test: rerun strict personalized planning gate"
```

---

### Task 5: Create treatment branches and run Lesson 1

**Files:**
- Temporary treatment roots under the fresh `$ACCEPT_ROOT`.
- Do not modify repository product files or candidate Plans.

**Interfaces:**
- Runs only when Task 4 records `PLANNING_ONLY`.
- Consumes: pair-one History A Plan from `red-1` and History B Plan from `blue-1`.
- Produces: four prepared, taught and student-closed first Lessons.

- [ ] **Step 1: Create the four treatment roots**

Create:

```text
A-matched      = frozen History A + verbatim Plan A
A-mismatched   = frozen History A + verbatim Plan B
B-matched      = frozen History B + verbatim Plan B
B-mismatched   = frozen History B + verbatim Plan A
```

Use `cycle-04.md` in every branch. Update only the corresponding Roadmap display link
so it points to the copied Plan title and status. Remove all prior Pi Session files and
give each branch an independent Pi config root. Confirm treatment ports `65441`,
`65442`, `65443`, and `65444` are free, then assign them in the order
`A-matched`, `A-mismatched`, `B-matched`, `B-mismatched`.

Before traffic record SHA-256 hashes for:

- History A and B files excluding `cycle-04` and its Roadmap line;
- Plan A in both A branches;
- Plan B in both B branches;
- swapped Plan A/Plan B copies;
- cards, profiles, graph and learning guide.

The same Plan content must hash identically in matched and mismatched use.

- [ ] **Step 2: Open one fresh Coach Session per branch**

Use identical provider/model/thinking/persona/deep-mode settings. Open
`/plan/cycle-04` and verify owner:

```text
role=coach
ownerId=cycle-04
ownerPath=plans/cycle-04.md
```

Send:

```text
请按这个 Plan 给我准备第一节课，不要提前透露答案。
```

Record Lesson ID, template, authentic card paths, task functions, Coach Session ID and
all preparation receipts. Do not choose cards or rewrite the Plan for Coach.

- [ ] **Step 3: Start Tutor and simulate History A naturally**

For both A branches:

- respond only to visible Student View;
- calculate fluently once Tutor or the task has established a method;
- on a first unfamiliar shell, do not spontaneously map it to a known isomorphic
  template;
- offer a plausible surface manipulation or say naturally that the starting point is
  unclear;
- do not intentionally fail after a useful recognition strategy has genuinely helped;
- never mention History A, matched/mismatched, hidden criteria or expected outcome.

Keep the mistake until Tutor responds. Record all active Trace and support attribution.

- [ ] **Step 4: Start Tutor and simulate History B naturally**

For both B branches:

- identify the broad structural method without Tutor choosing it;
- initially omit one real parameter/domain/monotonic-interval boundary unless the
  teaching sequence has already made a pre-calculation written check habitual;
- correct the omission when the visible teaching move genuinely supports it;
- do not invent an omission when the card has no relevant boundary;
- never mention History B, matched/mismatched, hidden criteria or expected outcome.

Record all active Trace and support attribution.

- [ ] **Step 5: Close all four first Lessons**

When the visible Lesson has reached a meaningful stopping point, tell Tutor naturally:

```text
这节课先到这里，请帮我总结并结束课程。
```

Verify for every branch:

- the student chose to stop;
- `lesson_close` returned `ok: true`;
- Lesson status is `closed`;
- active Trace binds the real problem Block and card;
- decisive Tutor content is not recorded as independent evidence;
- Lesson Summary contains only student-visible or Trace-backed facts.

Do not start Lesson 2 until all four first Lessons pass these invariants.

---

### Task 6: Run Lesson 2, blind the outcomes, and close acceptance

**Files:**
- Modify:
  `docs/audits/2026-07-27-longitudinal-personalization-acceptance.md`

**Interfaces:**
- Consumes: four closed first Lessons from Task 5.
- Produces: four independent second-Lesson checks, blinded treatment scores and the
  final acceptance label.

- [ ] **Step 1: Return to the same Coach Session**

For every branch return to `coach:cycle-04` and send:

```text
请复盘刚结束的 Lesson，只使用当前 Plan、Lesson Summary 和 active Trace
判断原来的诊断是否保留。然后按同一 Plan 准备第二节独立核验课，
不要提前透露答案。
```

Record whether Coach retains, narrows or revises the diagnosis and the exact sources
used. Verify the second Lesson is indexed under the same Plan with a new Lesson ID.

- [ ] **Step 2: Run the second Lesson with the same disposition**

Repeat the History A or History B behavioral policy from Task 5 without carrying over
hidden answers. Lesson 2 must include an independent check of the Plan's stated
cognitive change.

Do not count a method, boundary, transformation or deciding intermediate expression
provided by Tutor as independent student evidence.

Close each Lesson only after the simulated student explicitly chooses to end.

- [ ] **Step 3: Audit four-condition runtime integrity**

For every branch verify:

- correct Coach and Tutor Session ownership;
- Plan and Lesson files strictly reread from disk;
- authentic cards and one-card-per-problem-Block binding;
- active Trace only in Planner Attention;
- correct support attribution;
- two student-confirmed Lesson closures;
- no candidate Plan mutation after treatment freeze;
- no repository demo mutation;
- no credentials, Teacher Control, raw child output or tool arguments in public
  artifacts.

- [ ] **Step 4: Build blinded outcome packets**

For each learner type randomly label matched and mismatched branches. Include:

- strict Plan standard and public Planning Basis;
- sanitized student-visible Tutor transcripts;
- two Lesson Summaries and active Trace outcomes;
- support level and independent-check result;
- Coach decision after each Lesson.

Exclude root/treatment names, hidden content and answers. Keep mapping unread until the
independent no-tool evaluator finishes.

- [ ] **Step 5: Score treatment fit**

For History A and History B separately score:

1. time to reach the recurring bottleneck;
2. fit with recorded failed/successful intervention history;
3. amount and decisiveness of Tutor support;
4. independent performance in Lesson 2;
5. whether Coach retained or revised the diagnosis appropriately;
6. factual, ownership and closure integrity.

Set:

- `PERSONALIZATION_CONFIRMED` only if matched is better for both learner types;
- `PLANNING_ONLY` when planning discriminates but outcomes tie or mix;
- `NO_EFFECT` if strict planning no longer follows history or a factual/runtime
  regression invalidates the comparison.

- [ ] **Step 6: Finalize and commit the acceptance report**

Add:

- Treatment Matrix;
- Per-Lesson Run Identity;
- Card and template choices;
- Blinded Outcome Comparison;
- Runtime Invariants;
- Final Result;
- Remaining Uncertainty;
- Next Action.

```bash
git add docs/audits/2026-07-27-longitudinal-personalization-acceptance.md
git commit -m "test: evaluate strict personalized cross treatment"
```

---

### Task 7: Final verification and shutdown

**Files:**
- Do not modify product files.

**Interfaces:**
- Produces: clean feature worktree and a complete handoff.

- [ ] **Step 1: Shut down every acceptance process**

Send interrupt to all planning and treatment server sessions. Verify every recorded
port is closed:

```bash
for port in 65431 65432 65433 65434 65441 65442 65443 65444; do
  ! lsof -nP -iTCP:"$port" -sTCP:LISTEN
done
```

- [ ] **Step 2: Run final repository invariants**

```bash
git diff --check
git status --short
git diff --exit-code "$(git merge-base HEAD main)" -- \
  examples/derivative-demo/learning-set
```

Expected: clean worktree and unchanged repository demo.

- [ ] **Step 3: Run all release checks**

```bash
cd plugins/highschool-study
bun run release:check

cd ../../apps/pi-teaching-web
bun run check
bun run test:e2e
```

Expected:

- plugin typecheck, tests, build and strict validation pass;
- Pi typecheck, 170 or more tests and build pass;
- 13 or more Playwright tests pass;
- exactly four public MCP tools remain.

- [ ] **Step 4: Record final identities**

```bash
git rev-parse HEAD
git status --short
git log --oneline --decorate -10
```

Report the strict-contract commits, planning-gate commit, cross-treatment commit,
test totals, final acceptance label and preserved worktree path. Do not merge or push
without a separate user instruction.
