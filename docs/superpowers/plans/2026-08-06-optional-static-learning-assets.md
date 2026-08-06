# Optional Static Learning Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `LEARNING_GUIDE.md` plus `ROADMAP.md` the complete minimum StudyForge Learning Set while retaining graph, card, material, Scout, and private-corpus behavior as optional enhancements.

**Architecture:** Split cheap static-asset discovery from full asset parsing. The Course snapshot carries one metadata-only `knowledgeAvailable` projection, while `/api/knowledge` preserves its stable three-array contract and strict parsing of present assets. A new cardless public starter becomes the default; the existing asset-rich fixture and private corpus remain isolated regression lanes.

**Tech Stack:** Bun 1.3.14, TypeScript 7, React 19, Vite 8, Bun test, Playwright 1.61, Markdown/YAML Learning Sets.

## Global Constraints

- Required Learning Set content is exactly `LEARNING_GUIDE.md`, `ROADMAP.md`, and a writable root.
- `graph/`, `cards/`, and `materials/` are independent optional slices; missing and empty slices return empty arrays.
- A present malformed supported asset must fail with its exact relative path; do not silently treat it as absent.
- `KnowledgeSnapshot` remains `{ methods, cards, materials }` with three arrays.
- `knowledgeAvailable` is metadata-only: method-tree file, card YAML candidate, or material file presence; it never parses all card bodies.
- Teacher-inline tasks remain first-class and never auto-promote into a card, material, memory store, or index.
- Do not change Roadmap/Plan/Lesson lifecycle, Session identity, Scout behavior, card schema, the 519-card corpus, or symbolic-link policy.
- Do not implement M1, clean export, merge, push, public repository creation, tags, or GitHub visibility changes.

---

## File Structure

### New files

- `apps/studyforge/src/study/static-assets.ts`: recursive metadata-only asset discovery shared by Course and Knowledge readers.
- `examples/math-starter-m0/{README.md,LICENSE}`: public starter description and CC BY 4.0 boundary.
- `examples/math-starter-m0/learning-set/{LEARNING_GUIDE.md,ROADMAP.md}`: valid cardless default Learning Set.
- `apps/studyforge/tests/fixtures/m0-cardless-learning-set/**`: deterministic Course/Lesson fixture with inline material and no static assets.
- `apps/studyforge/tests/fixtures/card-recall-learning-set/**`: tiny original card/index fixture for public index testing.

### Modified files

- `apps/studyforge/src/study/knowledge.ts`: optional method tree and shared file enumeration.
- `apps/studyforge/src/study/markdown.ts`: attach metadata-only `knowledgeAvailable` to Course snapshots.
- `apps/studyforge/src/shared/contracts.ts`: add `CourseSnapshot.knowledgeAvailable`.
- `apps/studyforge/src/client/{App.tsx,styles/knowledge.css}`: propagate availability and render the full-page empty state.
- `apps/studyforge/src/client/components/{AppShell.tsx,PrimaryViewNav.tsx}`: suppress Knowledge navigation when unavailable.
- `scripts/lib/doctor.ts`: default to the public starter.
- Domain, API, UI, release, index, and E2E tests listed in the approved specification.
- `README.md`, `README.en.md`, `AGENTS.md`, `docs/architecture/m0-runtime.zh-CN.md`, `docs/guides/agent-assisted-setup.zh-CN.md`, and `docs/guides/learning-set.zh-CN.md`: document the new minimum and private opt-in path.

---

### Task 1: Optional-asset reader and Course projection

**Files:**
- Create: `apps/studyforge/src/study/static-assets.ts`
- Modify: `apps/studyforge/src/study/knowledge.ts`
- Modify: `apps/studyforge/src/study/markdown.ts`
- Modify: `apps/studyforge/src/shared/contracts.ts`
- Test: `apps/studyforge/tests/m0/markdown-domain.test.ts`
- Test: `apps/studyforge/tests/m0/server-api.test.ts`

**Interfaces:**
- Produces: `filesBelow(root: string, directory: string): string[]`.
- Produces: `hasKnowledgeAssets(root: string): boolean`.
- Produces: required `CourseSnapshot.knowledgeAvailable: boolean`.
- Preserves: `readKnowledge(root: string): KnowledgeSnapshot`.

- [ ] **Step 1: Add failing domain tests for missing, independent, and malformed slices**

Add tests that copy the asset-rich fixture, remove `graph`, `cards`, and `materials`, and assert:

```ts
expect(readKnowledge(root)).toEqual({ methods: [], cards: [], materials: [] });
expect(readCourseTree(root).knowledgeAvailable).toBe(false);
```

Then recreate empty optional directories and assert the same result. Add independent-slice cases by restoring only `materials/note.md`, only `cards/sample.card.yaml`, and only `graph/method_tree.yaml`; each case must populate only its own array and set `knowledgeAvailable` to `true`. Finally, write malformed YAML to `graph/method_tree.yaml` and a supported problem-card YAML missing `content_item_id`, and assert `StudyDocumentError` includes each relative path.

- [ ] **Step 2: Add a failing empty-asset API assertion**

In `server-api.test.ts`, remove the three optional directories from a copied fixture and assert:

```ts
expect(await course?.json()).toMatchObject({ knowledgeAvailable: false });
expect(await knowledge?.json()).toEqual({ methods: [], cards: [], materials: [] });
```

Run:

```bash
bun test apps/studyforge/tests/m0/markdown-domain.test.ts apps/studyforge/tests/m0/server-api.test.ts
```

Expected: FAIL because `readMethods()` still requires `graph/method_tree.yaml` and Course snapshots lack `knowledgeAvailable`.

- [ ] **Step 3: Implement metadata-only static-asset discovery**

Create `static-assets.ts` with focused recursive helpers:

```ts
import { existsSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

export function filesBelow(root: string, directory: string): string[] {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) return [];
  const files: string[] = [];
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(relative(root, path).replaceAll('\\', '/'));
    }
  };
  visit(absolute);
  return files.sort();
}

function hasFileBelow(
  root: string,
  directory: string,
  accept: (path: string) => boolean,
): boolean {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) return false;
  const visit = (current: string): boolean => readdirSync(current, { withFileTypes: true })
    .some((entry) => {
      const path = join(current, entry.name);
      return entry.isDirectory() ? visit(path) : entry.isFile() && accept(path);
    });
  return visit(absolute);
}

export function hasKnowledgeAssets(root: string): boolean {
  return existsSync(join(root, 'graph/method_tree.yaml'))
    || hasFileBelow(root, 'cards', (path) => ['.yaml', '.yml'].includes(extname(path).toLowerCase()))
    || hasFileBelow(root, 'materials', () => true);
}
```

Do not resolve or follow symbolic links beyond existing `Dirent` behavior.

- [ ] **Step 4: Make full Knowledge parsing optional but strict when present**

In `knowledge.ts`, import `filesBelow`, remove its local duplicate, and make the method tree optional:

```ts
function readMethods(root: string): KnowledgeMethodNode[] {
  const path = 'graph/method_tree.yaml';
  if (!existsSync(join(root, path))) return [];
  const value = yamlFile(root, path);
  // existing schema and node validation remains unchanged
}
```

Do not catch `StudyDocumentError` from present YAML files.

- [ ] **Step 5: Add `knowledgeAvailable` to Course snapshots**

In `contracts.ts`:

```ts
export type CourseSnapshot = {
  guide: { title: string; body: string; raw: string };
  roadmap: RoadmapDocument;
  tree: CourseTreeNode;
  selected: RoadmapDocument | PlanDocument | LessonDocument | null;
  knowledgeAvailable: boolean;
};
```

In `markdown.ts`, import `hasKnowledgeAssets` and return:

```ts
return {
  guide: readGuide(root),
  roadmap,
  tree,
  selected: null,
  knowledgeAvailable: hasKnowledgeAssets(root),
};
```

The Server needs no new endpoint or full Knowledge read on `/api/course`; its existing Course reader serializes the new field.

- [ ] **Step 6: Run focused tests and commit**

Run:

```bash
bun test apps/studyforge/tests/m0/markdown-domain.test.ts apps/studyforge/tests/m0/server-api.test.ts
bun run typecheck
```

Expected: focused tests PASS and TypeScript reports no errors.

Commit:

```bash
git add apps/studyforge/src/study/static-assets.ts apps/studyforge/src/study/knowledge.ts apps/studyforge/src/study/markdown.ts apps/studyforge/src/shared/contracts.ts apps/studyforge/tests/m0/markdown-domain.test.ts apps/studyforge/tests/m0/server-api.test.ts
git commit -m "feat: allow cardless StudyForge learning sets"
```

---

### Task 2: Availability-aware navigation and honest Knowledge empty state

**Files:**
- Modify: `apps/studyforge/src/client/App.tsx`
- Modify: `apps/studyforge/src/client/components/AppShell.tsx`
- Modify: `apps/studyforge/src/client/components/PrimaryViewNav.tsx`
- Modify: `apps/studyforge/src/client/pages/KnowledgePage.tsx`
- Modify: `apps/studyforge/src/client/styles/knowledge.css`
- Test: `apps/studyforge/tests/m0/course-ui.test.tsx`
- Test: `apps/studyforge/tests/m0/knowledge-ui.test.tsx`

**Interfaces:**
- Produces: `PrimaryViewNavProps.knowledgeAvailable: boolean`.
- Produces: `AppShellProps.knowledgeAvailable: boolean`.
- Consumes: `CourseSnapshot.knowledgeAvailable` from Task 1.

- [ ] **Step 1: Add failing UI tests**

Extend the primary-navigation test to render both states:

```tsx
<PrimaryViewNav
  active="course"
  knowledgeAvailable={false}
  hrefs={{ course: '/course', knowledge: '/knowledge' }}
  onNavigate={() => {}}
/>
```

Assert `课程脉络` is present and `知识山河` is absent. Preserve the existing rich case with `knowledgeAvailable={true}`.

Add a Knowledge page test with three empty arrays and assert it contains `当前学习集没有预置静态资产`, mentions student-provided and teacher-prepared content, omits the search input, and does not render the three normal columns.

Run:

```bash
bun test apps/studyforge/tests/m0/course-ui.test.tsx apps/studyforge/tests/m0/knowledge-ui.test.tsx
```

Expected: FAIL because the new prop and full-page empty state do not exist.

- [ ] **Step 2: Filter the primary views in one place**

Add `knowledgeAvailable` to `PrimaryViewNavProps` and render:

```tsx
{PRIMARY_VIEWS.filter((view) => view === 'course' || knowledgeAvailable).map((view) => (
  // existing anchor unchanged
))}
```

Thread the required boolean through `AppShell`.

- [ ] **Step 3: Derive availability safely in `App`**

Use Course metadata on Course routes and the loaded snapshot on a direct Knowledge route:

```ts
const knowledgeAvailable = course?.knowledgeAvailable
  ?? Boolean(knowledge && (
    knowledge.methods.length > 0
    || knowledge.cards.length > 0
    || knowledge.materials.length > 0
  ));
```

Pass it to `AppShell`. Do not add a second Course or Knowledge request.

- [ ] **Step 4: Render and style the full-page empty state**

At the start of `KnowledgePage`, after hooks are initialized consistently, derive:

```ts
const empty = value.methods.length === 0
  && value.cards.length === 0
  && value.materials.length === 0;
```

Return a `main.knowledge-workspace.knowledge-workspace-empty` containing the normal title plus a single `section.knowledge-empty-state` with this copy:

```text
当前学习集没有预置静态资产
课程仍可使用你提供的材料，以及老师为当前目标准备的任务。
```

Add restrained layout rules in `knowledge.css`; do not fabricate counters or loading states.

- [ ] **Step 5: Run focused tests, typecheck, and commit**

Run:

```bash
bun test apps/studyforge/tests/m0/course-ui.test.tsx apps/studyforge/tests/m0/knowledge-ui.test.tsx
bun run typecheck
```

Expected: tests PASS and TypeScript reports no errors.

Commit:

```bash
git add apps/studyforge/src/client/App.tsx apps/studyforge/src/client/components/AppShell.tsx apps/studyforge/src/client/components/PrimaryViewNav.tsx apps/studyforge/src/client/pages/KnowledgePage.tsx apps/studyforge/src/client/styles/knowledge.css apps/studyforge/tests/m0/course-ui.test.tsx apps/studyforge/tests/m0/knowledge-ui.test.tsx
git commit -m "feat: present cardless learning sets honestly"
```

---

### Task 3: Public cardless starter and default Doctor path

**Files:**
- Create: `examples/math-starter-m0/README.md`
- Create: `examples/math-starter-m0/LICENSE`
- Create: `examples/math-starter-m0/learning-set/LEARNING_GUIDE.md`
- Create: `examples/math-starter-m0/learning-set/ROADMAP.md`
- Modify: `scripts/lib/doctor.ts`
- Test: `tests/release/doctor.test.ts`
- Test: `tests/release/docs-contract.test.ts`

**Interfaces:**
- Preserves: `resolveDemoPaths(repoRoot, env)`.
- Changes default: `examples/math-starter-m0/learning-set`.
- Preserves explicit `STUDY_LEARNING_SET` precedence.

- [ ] **Step 1: Change release tests first**

Update the default-path assertion to:

```ts
expect(resolveDemoPaths('/repo', {}).learningSet)
  .toBe('/repo/examples/math-starter-m0/learning-set');
```

Add a test using `defaultDoctorDependencies().validateLearningSet` or direct readers against the new starter and assert Course has an empty Plan Tree and Knowledge has three empty arrays. Extend `docs-contract.test.ts` to require the starter README/license/Guide/Roadmap and to verify its README contains `CC BY 4.0` and `no preloaded graph, cards, or materials`.

Run:

```bash
bun test tests/release/doctor.test.ts tests/release/docs-contract.test.ts
```

Expected: FAIL because the starter does not exist and the old private default remains.

- [ ] **Step 2: Add the public starter files**

Create a project-original Guide with frontmatter:

```yaml
---
id: math-starter-m0
title: 数学学习起点
---
```

Its teaching principles must require concrete diagnosis, small reversible probes when the student is unsure, gradual hints, student-owned confirmation, and transfer checks without claiming a preset weakness.

Create a Roadmap with the canonical `roadmap/active/null` frontmatter, all six required sections, an empty `Plan Tree`, and `Current Position` that says the first action is a natural Roadmap discussion with a student who may not know how to study.

The starter README must state that it intentionally has no `graph/`, `cards/`, or `materials/`, that the two Markdown files are the minimum contract, and that its educational content is CC BY 4.0. The local LICENSE must name CC BY 4.0 and link to `https://creativecommons.org/licenses/by/4.0/legalcode`.

- [ ] **Step 3: Switch only the default path**

In `scripts/lib/doctor.ts`, replace:

```ts
'examples/derivative-m0/learning-set'
```

with:

```ts
'examples/math-starter-m0/learning-set'
```

Do not change environment-variable handling.

- [ ] **Step 4: Run release tests and commit**

Run:

```bash
bun test tests/release/doctor.test.ts tests/release/docs-contract.test.ts
STUDY_LEARNING_SET=examples/math-starter-m0/learning-set bun run doctor -- --json
```

Expected: release tests PASS; Doctor may report only environment-dependent model/port outcomes, while its `learning-set` and `write` checks PASS.

Commit:

```bash
git add examples/math-starter-m0 scripts/lib/doctor.ts tests/release/doctor.test.ts tests/release/docs-contract.test.ts
git commit -m "feat: add a public cardless starter"
```

---

### Task 4: Public fixtures, index isolation, and cardless browser closure

**Files:**
- Create: `apps/studyforge/tests/fixtures/m0-cardless-learning-set/LEARNING_GUIDE.md`
- Create: `apps/studyforge/tests/fixtures/m0-cardless-learning-set/ROADMAP.md`
- Create: `apps/studyforge/tests/fixtures/m0-cardless-learning-set/plans/plan-001/PLAN.md`
- Create: `apps/studyforge/tests/fixtures/m0-cardless-learning-set/plans/plan-001/lessons/lesson-001.md`
- Create: `apps/studyforge/tests/fixtures/card-recall-learning-set/cards/public-sample.card.yaml`
- Create: `apps/studyforge/tests/fixtures/card-recall-learning-set/graph/card-recall-index.tsv`
- Modify: `apps/studyforge/tests/m0/card-recall-index.test.ts`
- Modify: `apps/studyforge/tests/m0/derivative-demo.test.ts`
- Modify: `apps/studyforge/tests/e2e/fixture-server.ts`
- Modify: `apps/studyforge/tests/e2e/m0-cycle.spec.ts`

**Interfaces:**
- Preserves: existing `m0-learning-set` as the asset-rich domain/UI fixture.
- Produces: an E2E fixture whose problem Block has `Uses:` empty and complete inline `Student View`.
- Preserves: private 519-card validation only in `derivative-demo.test.ts`.

- [ ] **Step 1: Add a tiny original index fixture and point index tests at it**

Create one original card with complete recall metadata:

```yaml
schema: highschool-study.problem-card.v1
content_item_id: public-sample
storage_uri: cards/public-sample.card.yaml
stem: 已知函数 $f(x)=x^2-2ax+1$，求其最小值并说明参数的作用。
graph:
  goal:
    primary: 求最值
    part_level:
      - { part: 1, goal: 求最值 }
  method:
    primary: 配方法
    secondary: []
  structure:
    primary: 二次函数结构
    secondary: []
```

Generate and commit the exact one-row TSV, then rewrite the test to assert one deterministic row, the expected three vocabulary values, no answer leakage, sorted paths, and the same public columns. Remove all assertions tied to private card names or count 519.

Run:

```bash
bun test apps/studyforge/tests/m0/card-recall-index.test.ts
```

Expected: PASS against the one-card fixture.

- [ ] **Step 2: Create the cardless E2E fixture**

Copy only Guide, Roadmap, Plan, and Lesson semantics from the existing deterministic fixture. Do not create `graph`, `cards`, or `materials`. Change Block `block-002` to:

```markdown
- Uses:

### Student View

先观察这道题的参数位置，说说你准备从哪里切入。

\[
\frac{x^2-1}{x-1}=x+1
\]
```

Keep the prepared-to-active runtime mutations in `fixture-server.ts`, but change its `source` path to `m0-cardless-learning-set`.

- [ ] **Step 3: Rewrite the E2E Knowledge tail for the cardless path**

After completing the Plan, assert the `知识山河` primary link is absent. Navigate directly to `/knowledge` and assert the empty-state heading and explanatory copy are visible, while the search input and fake counts are absent. Preserve Course lifecycle, handout, math overflow, history restoration, and missing-memory assertions.

Run:

```bash
bun run --cwd apps/studyforge test:e2e
```

Expected: all browser tests PASS using the cardless fixture.

- [ ] **Step 4: Keep private-corpus validation explicitly private and commit**

Rename the derivative test description to `validates the private beta derivative corpus in the private repository`, retain its 519-card assertions, and add a comment that the test must be excluded with `examples/derivative-m0` during clean export. Do not alter any private corpus file.

Commit:

```bash
git add apps/studyforge/tests/fixtures/m0-cardless-learning-set apps/studyforge/tests/fixtures/card-recall-learning-set apps/studyforge/tests/m0/card-recall-index.test.ts apps/studyforge/tests/m0/derivative-demo.test.ts apps/studyforge/tests/e2e/fixture-server.ts apps/studyforge/tests/e2e/m0-cycle.spec.ts
git commit -m "test: prove the public cycle needs no card corpus"
```

---

### Task 5: Public documentation and repository contract

**Files:**
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `AGENTS.md`
- Modify: `docs/architecture/m0-runtime.zh-CN.md`
- Modify: `docs/guides/agent-assisted-setup.zh-CN.md`
- Modify: `docs/guides/learning-set.zh-CN.md`
- Test: `tests/release/docs-contract.test.ts`

**Interfaces:**
- Documents: default public starter, optional slices, explicit private opt-in, stable Knowledge empty behavior.
- Preserves: private corpus license warning and M1 non-goals.

- [ ] **Step 1: Tighten documentation assertions before prose edits**

Require active public docs to contain `math-starter-m0`, state that `graph/`, `cards/`, and `materials/` are optional, and show the explicit private command:

```bash
STUDY_LEARNING_SET=examples/derivative-m0/learning-set bun run start:demo
```

Run:

```bash
bun test tests/release/docs-contract.test.ts
```

Expected: FAIL until active docs describe the new default accurately.

- [ ] **Step 2: Update all six documentation surfaces consistently**

Make these exact semantic changes:

- README files: default `start:demo` is the public cardless starter; static assets are optional acceleration, not the course model.
- AGENTS: minimum Learning Set is two required Markdown files; Doctor strict-parses only assets that are present; private corpus requires explicit environment selection.
- Runtime architecture: show optional directories with `?` and state Course/Session/Lesson do not depend on Knowledge contents.
- Setup guide: use the public default command first and show private/custom opt-in separately.
- Learning Set guide: minimum tree has only Guide and Roadmap; Plan directories are created later; each optional slice has missing/empty/present-invalid semantics.

Do not claim clean export has happened or that the private corpus is publicly licensed.

- [ ] **Step 3: Run release contract and commit**

Run:

```bash
bun test tests/release/docs-contract.test.ts
```

Expected: PASS, including local-link resolution.

Commit:

```bash
git add README.md README.en.md AGENTS.md docs/architecture/m0-runtime.zh-CN.md docs/guides/agent-assisted-setup.zh-CN.md docs/guides/learning-set.zh-CN.md tests/release/docs-contract.test.ts
git commit -m "docs: explain optional StudyForge assets"
```

---

### Task 6: Full deterministic and real-model acceptance

**Files:**
- Create: `docs/audits/2026-08-06-cardless-m0-implementation-report.md`
- Do not modify runtime behavior during this task unless a deterministic or real-model failure is reproduced and fixed with its own regression test.

**Interfaces:**
- Verifies: public cardless default, private asset-rich regression, no-Scout two-Lesson model behavior.
- Produces: evidence-backed implementation report with commands, results, commits, and residual risks.

- [ ] **Step 1: Run the complete deterministic gate**

Run from repository root:

```bash
bun install --frozen-lockfile
bun run check
bun run test:e2e
STUDY_LEARNING_SET=examples/math-starter-m0/learning-set bun run doctor -- --json
STUDY_LEARNING_SET=examples/derivative-m0/learning-set bun run doctor -- --json
```

Expected: install exits 0; typecheck, release tests, App tests, build, and E2E all pass. Both Doctor reports must show `learning-set: pass` and `write: pass`; model/port outcomes are reported separately if environment-dependent.

- [ ] **Step 2: Run a real Server smoke against the public starter**

Copy `examples/math-starter-m0/learning-set` to a fresh temporary directory, start the built server on an unused loopback port, and assert:

```text
GET /api/health       → 200 and { ok: true }
GET /api/course       → 200, knowledgeAvailable=false, empty Plan Tree
GET /api/knowledge    → 200, three empty arrays
```

Stop only the exact process started by this step.

- [ ] **Step 3: Run the real-model two-Lesson cardless cycle**

On a second fresh copy, use the normal HTTP Session API and student-owned lifecycle endpoints. The simulated student begins with a natural statement equivalent to `我真的不知道该怎么学数学，也说不清问题在哪里。` Continue naturally through Roadmap diagnosis, explicit first-Plan confirmation, first-Lesson preparation, student start, classroom interaction, student close, Plan review, second-Lesson preparation and interaction, then complete the first Plan.

Inspect the resulting Markdown and Session/tool records. Acceptance requires:

- both Lesson problem Blocks use complete inline `Student View` and empty `Uses` unless the student supplied content;
- no Material Scout call and no enumeration of missing `graph/`, `cards/`, or `materials/`;
- no claim that generated tasks came from a card bank;
- second-Lesson preparation reads the first closed Lesson and adapts to its concrete evidence;
- confirmation gates, parent-before-prepare write order, Plan-local paths, lifecycle ownership, and handout behavior remain intact.

If model behavior fails but deterministic infrastructure is correct, record the exact first-hit failure without adding unrelated prompt constraints.

- [ ] **Step 4: Write the implementation report and review the diff**

The report must list:

- design and plan links;
- commits in order;
- files added/modified grouped by core, UI, starter, tests, docs;
- exact deterministic command results;
- real-model transcript/session location and acceptance verdict;
- explicitly unchanged areas and residual risks.

Run:

```bash
git diff 5488329..HEAD --check
git diff --stat 5488329..HEAD
git status --short
```

Read every changed production file and spot-check all new public content. Confirm no credentials, Pi Session JSONL, student-identifying data, or private corpus edits are present.

- [ ] **Step 5: Commit the report and final verification state**

```bash
git add docs/audits/2026-08-06-cardless-m0-implementation-report.md
git commit -m "docs: report cardless M0 acceptance"
```

Then rerun:

```bash
git diff 5488329..HEAD --check
git status --short --branch
git log --oneline 5488329..HEAD
```

Expected: no whitespace errors, a clean worktree, and only the planned local commits. Do not merge or push.
