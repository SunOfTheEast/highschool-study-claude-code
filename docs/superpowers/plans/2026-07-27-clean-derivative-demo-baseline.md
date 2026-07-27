# Clean Derivative Demo Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate the deterministic `domain-integrity` regression fixture from the public derivative learning set, then reset the public Roadmap, Plans, Lessons, and derived preparation projection to a clean high-level baseline.

**Architecture:** Pi runtime tests receive a small, self-contained learning-set fixture containing the old domain-integrity state and four referenced cards. The public derivative demo keeps its 519 cards, graph, materials, personas, and empty confirmed profiles, but exposes no active Plan or Lesson until a new advanced Roadmap is designed.

**Tech Stack:** Markdown learning-set files, Bun 1.3, TypeScript 7, Bun test, Playwright, existing `readLearningSet()` / `readPlanWorkspace()` parsers.

## Global Constraints

- Preserve all 519 public problem cards without modifying their contents.
- Preserve the public knowledge graph, materials, persona files, `student-profile.md`, and `teaching-profile.md`.
- Do not design or create the replacement advanced Plan or Lesson in this change.
- Back up the working Roadmap, Plan, Lessons, and memory outside the repository before deleting active state.
- Do not copy the working tree's local `coach_session` into the regression fixture.
- Keep `plans/.gitkeep` and `lessons/.gitkeep`.
- Reset `planner-attention.md` because its old sources point to Lessons being removed.
- Do not stage or modify `.superpowers/` or `docs/superpowers/plans/2026-07-22-three-lesson-teaching-quality-optimization.md`.
- Use `apply_patch` for authored text changes and deletions; bulk file copies may use `cp`.

---

## File Map

**Create**

- `apps/pi-teaching-web/tests/support/fixture-paths.ts` — one canonical path for the old regression learning set.
- `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/**` — the isolated regression fixture.
- `apps/pi-teaching-web/tests/study/domain-integrity-fixture.test.ts` — validates the regression fixture boundary.
- `apps/pi-teaching-web/tests/study/clean-derivative-demo.test.ts` — validates the public clean baseline and asset preservation.

**Modify**

- `apps/pi-teaching-web/tests/study/read-workspace.test.ts`
- `apps/pi-teaching-web/tests/study/student-notebook.test.ts`
- `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`
- `apps/pi-teaching-web/tests/e2e/fixture-server.ts`
- `examples/derivative-demo/learning-set/ROADMAP.md`
- `examples/derivative-demo/learning-set/memory/planner-attention.md`
- `examples/derivative-demo/README.md`

**Delete from the public demo**

- `examples/derivative-demo/learning-set/plans/domain-integrity.md`
- `examples/derivative-demo/learning-set/lessons/lesson-001.md`
- `examples/derivative-demo/learning-set/lessons/lesson-002.md`
- `examples/derivative-demo/learning-set/lessons/lesson-003.md`

---

### Task 1: Freeze the Domain-Integrity Regression Fixture

**Files:**

- Create: `apps/pi-teaching-web/tests/support/fixture-paths.ts`
- Create: `apps/pi-teaching-web/tests/study/domain-integrity-fixture.test.ts`
- Create: `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/ROADMAP.md`
- Create: `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/plans/domain-integrity.md`
- Create: `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/lessons/lesson-001.md`
- Create: `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/lessons/lesson-002.md`
- Create: `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/lessons/lesson-003.md`
- Create: `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/cards/derivative/*.card.yaml`
- Create: `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/memory/*.md`

**Interfaces:**

- Consumes: the current committed domain-integrity Roadmap, Plan, Lessons, four aliased cards, and three memory files.
- Produces: `domainIntegrityFixtureRoot: string`, used by all Pi frontend regression tests.

- [ ] **Step 1: Add the fixture-path helper**

Create `apps/pi-teaching-web/tests/support/fixture-paths.ts`:

```ts
import { resolve } from 'node:path';

export const domainIntegrityFixtureRoot = resolve(
  import.meta.dir,
  '../fixtures/domain-integrity-learning-set',
);
```

- [ ] **Step 2: Write the failing fixture-boundary test**

Create `apps/pi-teaching-web/tests/study/domain-integrity-fixture.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readLearningSet, readPlanWorkspace } from '../../src/study/read-workspace';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

test('keeps the old domain-integrity state in an isolated regression fixture', () => {
  const learningSet = readLearningSet(domainIntegrityFixtureRoot);
  expect(learningSet.plans.map((plan) => plan.id)).toEqual(['domain-integrity']);

  const workspace = readPlanWorkspace(domainIntegrityFixtureRoot, 'domain-integrity');
  expect(workspace.lessons.map((lesson) => [lesson.id, lesson.status])).toEqual([
    ['lesson-001', 'closed'],
    ['lesson-002', 'closed'],
    ['lesson-003', 'prepared'],
  ]);

  expect(readdirSync(join(domainIntegrityFixtureRoot, 'cards/derivative')).sort()).toEqual([
    'mst_p0017_ex05.card.yaml',
    'mst_p0019_ex11.card.yaml',
    'mst_p0030_ex16.card.yaml',
    'mst_p0032_ex22.card.yaml',
  ]);

  for (const path of [
    'plans/domain-integrity.md',
    'lessons/lesson-001.md',
    'lessons/lesson-002.md',
    'lessons/lesson-003.md',
  ]) {
    expect(readFileSync(join(domainIntegrityFixtureRoot, path), 'utf8'))
      .not.toMatch(/^(coach_session|tutor_session):/m);
  }
});
```

- [ ] **Step 3: Run the test and confirm the fixture is absent**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/domain-integrity-fixture.test.ts
```

Expected: FAIL because `tests/fixtures/domain-integrity-learning-set/ROADMAP.md` does not exist.

- [ ] **Step 4: Copy the exact old regression state**

From the repository root:

```bash
mkdir -p apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/{plans,lessons,cards/derivative,memory}
cp examples/derivative-demo/learning-set/ROADMAP.md \
  apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/ROADMAP.md
cp examples/derivative-demo/learning-set/plans/domain-integrity.md \
  apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/plans/domain-integrity.md
cp examples/derivative-demo/learning-set/lessons/lesson-001.md \
  examples/derivative-demo/learning-set/lessons/lesson-002.md \
  examples/derivative-demo/learning-set/lessons/lesson-003.md \
  apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/lessons/
cp examples/derivative-demo/learning-set/cards/derivative/mst_p0017_ex05.card.yaml \
  examples/derivative-demo/learning-set/cards/derivative/mst_p0019_ex11.card.yaml \
  examples/derivative-demo/learning-set/cards/derivative/mst_p0030_ex16.card.yaml \
  examples/derivative-demo/learning-set/cards/derivative/mst_p0032_ex22.card.yaml \
  apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/cards/derivative/
cp examples/derivative-demo/learning-set/memory/planner-attention.md \
  examples/derivative-demo/learning-set/memory/student-profile.md \
  examples/derivative-demo/learning-set/memory/teaching-profile.md \
  apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/memory/
```

Remove the working tree's local Session binding from the copied fixture with `apply_patch`:

```diff
*** Update File: apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/plans/domain-integrity.md
@@
-coach_session: 019f8795-ec33-7c88-bf02-05ea81e40f28
```

Also remove any `tutor_session:` line if one appears in a copied Lesson. Do not alter any other fixture content.

- [ ] **Step 5: Run the fixture test**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/domain-integrity-fixture.test.ts
```

Expected: 1 test passes.

- [ ] **Step 6: Commit the fixture**

```bash
git add \
  apps/pi-teaching-web/tests/support/fixture-paths.ts \
  apps/pi-teaching-web/tests/study/domain-integrity-fixture.test.ts \
  apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set
git commit -m "test: isolate domain integrity learning fixture"
```

---

### Task 2: Point Regression Tests at the Isolated Fixture

**Files:**

- Modify: `apps/pi-teaching-web/tests/study/read-workspace.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/student-notebook.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`

**Interfaces:**

- Consumes: `domainIntegrityFixtureRoot` from Task 1.
- Produces: all runtime regression tests are independent of `examples/derivative-demo/learning-set`.

- [ ] **Step 1: Replace every public-demo test root**

Apply these exact import and constant changes.

`tests/study/read-workspace.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { readLearningSet, readPlanWorkspace } from '../../src/study/read-workspace';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const root = domainIntegrityFixtureRoot;
```

Remove its now-unused `node:path` import.

`tests/study/student-notebook.test.ts`:

```ts
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const sourceRoot = domainIntegrityFixtureRoot;
```

Keep `join` because the test still uses it for temporary directories.

`tests/runtime/study-tools.test.ts`:

```ts
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const root = domainIntegrityFixtureRoot;
```

`tests/runtime/workspace-registry.test.ts`:

```ts
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';
```

Replace the public-demo path inside `fixture()` with:

```ts
cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
```

`tests/e2e/fixture-server.ts`:

```ts
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const sourceRoot = domainIntegrityFixtureRoot;
```

Remove its now-unused `resolve` import from `node:path`.

- [ ] **Step 2: Confirm no Pi frontend test still reads the public demo**

Run:

```bash
rg -n "examples/derivative-demo/learning-set|derivative-demo/learning-set" \
  apps/pi-teaching-web/tests
```

Expected: no output.

- [ ] **Step 3: Run all affected unit tests**

Run:

```bash
cd apps/pi-teaching-web
bun test \
  tests/study/domain-integrity-fixture.test.ts \
  tests/study/read-workspace.test.ts \
  tests/study/student-notebook.test.ts \
  tests/runtime/study-tools.test.ts \
  tests/runtime/workspace-registry.test.ts
```

Expected: all tests pass.

- [ ] **Step 4: Commit the test-root migration**

```bash
git add \
  apps/pi-teaching-web/tests/study/read-workspace.test.ts \
  apps/pi-teaching-web/tests/study/student-notebook.test.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts \
  apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts \
  apps/pi-teaching-web/tests/e2e/fixture-server.ts
git commit -m "test: decouple runtime checks from public demo"
```

---

### Task 3: Reset the Public Derivative Learning State

**Files:**

- Create: `apps/pi-teaching-web/tests/study/clean-derivative-demo.test.ts`
- Modify: `examples/derivative-demo/learning-set/ROADMAP.md`
- Modify: `examples/derivative-demo/learning-set/memory/planner-attention.md`
- Delete: `examples/derivative-demo/learning-set/plans/domain-integrity.md`
- Delete: `examples/derivative-demo/learning-set/lessons/lesson-001.md`
- Delete: `examples/derivative-demo/learning-set/lessons/lesson-002.md`
- Delete: `examples/derivative-demo/learning-set/lessons/lesson-003.md`

**Interfaces:**

- Consumes: the isolated test fixture from Tasks 1–2.
- Produces: a valid public `LearningSetSnapshot` with title `高阶导数学习` and an empty `plans` array.

- [ ] **Step 1: Write the failing clean-baseline test**

Create `apps/pi-teaching-web/tests/study/clean-derivative-demo.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readLearningSet } from '../../src/study/read-workspace';

const root = resolve(
  import.meta.dir,
  '../../../../examples/derivative-demo/learning-set',
);

test('keeps the public derivative demo clean and asset-complete', () => {
  const learningSet = readLearningSet(root);
  expect(learningSet.title).toBe('高阶导数学习');
  expect(learningSet.plans).toEqual([]);

  expect(readdirSync(join(root, 'plans')).filter((name) => name.endsWith('.md')))
    .toEqual([]);
  expect(readdirSync(join(root, 'lessons')).filter((name) => name.endsWith('.md')))
    .toEqual([]);

  const cards = Array.from(
    new Bun.Glob('cards/**/*.card.yaml').scanSync({ cwd: root }),
  );
  expect(cards).toHaveLength(519);

  for (const path of [
    'graph/VOCABULARY.md',
    'materials/demo-notes.md',
    '.claude/personas/.gitkeep',
    'memory/student-profile.md',
    'memory/teaching-profile.md',
  ]) {
    expect(existsSync(join(root, path))).toBe(true);
  }

  const plannerAttention = readFileSync(
    join(root, 'memory/planner-attention.md'),
    'utf8',
  );
  expect(plannerAttention).not.toContain('lessons/lesson-');
  expect(plannerAttention).toContain('尚无课堂表现可供整理');
});
```

- [ ] **Step 2: Run the clean-baseline test and confirm the old state fails**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/clean-derivative-demo.test.ts
```

Expected: FAIL because the title is still `导数学习 Roadmap` and the Plan list contains `domain-integrity`.

- [ ] **Step 3: Back up the exact working learning state**

From the repository root:

```bash
BACKUP_DIR="$(mktemp -d /tmp/studyforge-domain-integrity-before-reset.XXXXXX)"
mkdir -p "$BACKUP_DIR"
cp -R examples/derivative-demo/learning-set/ROADMAP.md \
  examples/derivative-demo/learning-set/plans \
  examples/derivative-demo/learning-set/lessons \
  examples/derivative-demo/learning-set/memory \
  "$BACKUP_DIR/"
echo "$BACKUP_DIR"
```

Expected: the command prints one backup directory. Record it in the execution handoff. Confirm the user's local binding was preserved:

```bash
rg -n "^coach_session:" "$BACKUP_DIR/plans/domain-integrity.md"
```

Expected: one match containing the current Session ID.

- [ ] **Step 4: Replace the public Roadmap with the neutral baseline**

Replace `examples/derivative-demo/learning-set/ROADMAP.md` with:

```markdown
---
id: roadmap
kind: roadmap
status: active
---
# 高阶导数学习

## Learning Set Overview

- 学什么：围绕同构变形、切线与公切线、参变量分离、数形结合和局部逼近等主干方法，建立处理高阶导数综合题的结构感。
- 适合谁：已经掌握高中导数基础，希望系统提升综合题识别、转化与论证能力的学生。
- 当前状态：题卡、方法图谱与学习材料已经就绪，尚未建立任何个性化学习阶段。
- 如何开始：先在学习商议中确定最想强化的方向，再共同写出第一阶段的可观察能力标准与检验方式。

## Goal

尚未确定。由学生与学习商议根据当前目标共同建立，不从旧课堂记录推断薄弱点。

## Observable Capability Standard

尚未建立。随第一个 Plan 一起确定，并且必须可以通过真实题目和课堂表现观察。

## Test

尚未建立。随第一个 Plan 的能力标准一起确定。

## Plan Graph

（尚未创建学习阶段）

## Change Log

- 2026-07-27：清除旧的个性化补缺状态，保留 519 张题卡、方法图谱、材料和空白画像，等待从主干能力重新设计学习路线。
```

- [ ] **Step 5: Reset the derived preparation projection**

Replace `examples/derivative-demo/learning-set/memory/planner-attention.md` with:

```markdown
---
id: planner-attention
kind: preparation-projection
---
# Planner Attention

Uncalibrated preparation signal; not a mastery claim.

## Method Signals

（尚无课堂表现可供整理。）
```

- [ ] **Step 6: Delete the old public Plan and Lessons**

Use `apply_patch` to delete exactly:

```text
examples/derivative-demo/learning-set/plans/domain-integrity.md
examples/derivative-demo/learning-set/lessons/lesson-001.md
examples/derivative-demo/learning-set/lessons/lesson-002.md
examples/derivative-demo/learning-set/lessons/lesson-003.md
```

Do not delete either `.gitkeep`.

- [ ] **Step 7: Run the clean-baseline and regression tests**

Run:

```bash
cd apps/pi-teaching-web
bun test \
  tests/study/clean-derivative-demo.test.ts \
  tests/study/domain-integrity-fixture.test.ts \
  tests/study/read-workspace.test.ts \
  tests/study/student-notebook.test.ts \
  tests/runtime/study-tools.test.ts \
  tests/runtime/workspace-registry.test.ts
```

Expected: all tests pass.

- [ ] **Step 8: Commit the public-state reset**

```bash
git add \
  apps/pi-teaching-web/tests/study/clean-derivative-demo.test.ts \
  examples/derivative-demo/learning-set/ROADMAP.md \
  examples/derivative-demo/learning-set/memory/planner-attention.md
git add -u \
  examples/derivative-demo/learning-set/plans/domain-integrity.md \
  examples/derivative-demo/learning-set/lessons
git commit -m "refactor: reset derivative demo learning state"
```

---

### Task 4: Rewrite the Demo Tutorial for a Clean Start

**Files:**

- Modify: `apps/pi-teaching-web/tests/study/clean-derivative-demo.test.ts`
- Modify: `examples/derivative-demo/README.md`

**Interfaces:**

- Consumes: the empty public Plan Graph from Task 3.
- Produces: first-run instructions that do not route testers back to domain-integrity or Lesson 003.

- [ ] **Step 1: Extend the clean-baseline test with tutorial assertions**

Append inside the existing test:

```ts
  const tutorial = readFileSync(resolve(root, '../README.md'), 'utf8');
  for (const stale of [
    '定义域完整性的系统加固',
    'Lesson 003',
    'mst_p0032_ex22',
  ]) {
    expect(tutorial).not.toContain(stale);
  }
  expect(tutorial).toContain('尚未建立个性化学习阶段');
```

- [ ] **Step 2: Run the test and confirm the tutorial is stale**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/clean-derivative-demo.test.ts
```

Expected: FAIL because the tutorial still recommends `定义域完整性的系统加固`.

- [ ] **Step 3: Update the tutorial introduction and first prompt**

In `examples/derivative-demo/README.md`, replace the opening paragraph with:

```markdown
这是从 StudyForge 导数学习集迁出的公开试用版，包含 519 张题卡、知识图谱和三份 memory 文件。公开基线不预设学生缺陷，也不自带 active Plan 或 Lesson；第一次使用时由学生与学习商议共同确定学习方向。教材 PNG、整书文本、旧系统快照和可识别会话信息没有进入公开仓库。
```

Replace the recommended first message with:

```text
我想开始一个新的高阶导数学习阶段。
请先读取学习集概述和方法图谱，概括可以选择的主干方向。
不要根据旧课堂假设我的薄弱点；先询问我希望强化什么，
再和我共同确定第一个 Plan 的可观察能力标准与检验方式。
先不要备课，也不要直接上课。
```

Replace “当前示例状态” and its bullets with:

```markdown
当前示例状态：

- 519 张题卡与高级方法图谱已经就绪；
- Roadmap 尚未建立个性化学习阶段；
- `plans/` 与 `lessons/` 为空；
- 两份长期偏好画像和备课关注列表均为空；
- 第一个 Plan、Lesson 和课堂记录将在真实讨论与学习后产生。
```

- [ ] **Step 4: Replace the Lesson-003 walkthrough**

Replace the old `## 4. 上课时会发生什么` section, stopping before `## 5. 查看与更正`, with:

```markdown
## 4. 建立第一阶段并开始上课

学习商议先根据你的目标，从同构变形、切线与公切线、参变量分离、数形结合、局部逼近等主干方向中确定一个阶段。阶段文档必须写明长期目标、可观察能力标准和真实题目检验方式。

方向确认后再准备第一课。课堂可以包含说明、材料、示例、独立练习、迁移、可选回顾和课堂回望等环节；环节可以依赖、重排或略过，不是固定流水线。每次读取题卡都会同时读取其已有学习记录；找不到合适真实题卡时缩减课堂目标，不临时编卡。

产生课堂表现后，系统会把学习记录绑定到真实题卡和课堂环节。完成一个 Plan 后，才会汇总本周期课堂记录并请学生确认长期偏好。

```

- [ ] **Step 5: Run the tutorial test**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/clean-derivative-demo.test.ts
```

Expected: 1 test passes.

- [ ] **Step 6: Commit the tutorial update**

```bash
git add \
  apps/pi-teaching-web/tests/study/clean-derivative-demo.test.ts \
  examples/derivative-demo/README.md
git commit -m "docs: start derivative demo without learner assumptions"
```

---

### Task 5: Full Verification

**Files:**

- Verify only; no planned source changes.

**Interfaces:**

- Consumes: Tasks 1–4.
- Produces: evidence that public assets remain complete while runtime tests use the isolated fixture.

- [ ] **Step 1: Stop the visual companion before Playwright claims port 65000**

Run from the repository root if the current brainstorming server is still active:

```bash
/Users/yangrundong/.codex/plugins/cache/superpowers-dev/superpowers/6.1.1/skills/brainstorming/scripts/stop-server.sh \
  /Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.superpowers/brainstorm/55896-1785135567
```

Expected: the visual companion stops; do not kill unrelated processes.

- [ ] **Step 2: Run the complete non-E2E check**

```bash
cd apps/pi-teaching-web
bun run check
```

Expected: TypeScript, all non-E2E tests, and the Vite production build pass.

- [ ] **Step 3: Run the browser regression suite against the isolated fixture**

```bash
cd apps/pi-teaching-web
bunx playwright test
```

Expected: all workspace and deep-workflow E2E tests pass while continuing to show the domain-integrity fixture.

- [ ] **Step 4: Verify the public asset boundary**

From the repository root:

```bash
find examples/derivative-demo/learning-set/cards -type f -name '*.card.yaml' | wc -l
find examples/derivative-demo/learning-set/plans -type f ! -name '.gitkeep'
find examples/derivative-demo/learning-set/lessons -type f ! -name '.gitkeep'
rg -n "lessons/lesson-00[1-3]" examples/derivative-demo/learning-set/memory
rg -n "examples/derivative-demo/learning-set|derivative-demo/learning-set" \
  apps/pi-teaching-web/tests \
  --glob '!**/clean-derivative-demo.test.ts'
rg -n "^(coach_session|tutor_session):" \
  apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set
```

Expected:

- first command prints `519`;
- every remaining command prints no output.

- [ ] **Step 5: Inspect final scope**

```bash
git status --short
git log -5 --oneline
```

Expected:

- implementation changes are committed;
- the pre-existing `.superpowers/` and `docs/superpowers/plans/2026-07-22-three-lesson-teaching-quality-optimization.md` may remain untracked;
- no problem card, graph, material, persona, or confirmed profile appears in the diff;
- the execution handoff reports the external backup directory.
