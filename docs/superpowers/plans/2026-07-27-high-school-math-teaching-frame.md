# High-School Math Teaching Frame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one shared high-school-math teaching core, focused Coach and Tutor frames, and a versioned learning-set guide, then prove the change with a real-model A/B teaching comparison.

**Architecture:** Keep the existing Markdown-first facts, two Agent roles, LessonBlueprint, tools, Trace, and session boundaries. Pi composes the shared core into each role's fixed context; the public Claude plugin loads an equivalent core Skill. Each learning set owns one `LEARNING_GUIDE.md`: students see only its public principles, while Coach can read the full guide and Tutor normally receives only Lesson-selected guidance.

**Tech Stack:** Markdown, Bun 1.3.14, TypeScript 7, React 19.2.8, Vite 8.1.5, Pi 0.81.0, Claude Code plugin Skills, Bun test, Playwright 1.61.1.

## Global Constraints

- Follow `docs/superpowers/specs/2026-07-27-high-school-math-teaching-frame-design.md`.
- Keep exactly two durable Pi roles and exactly four public MCP tools.
- Do not add a schema, database, vector store, rule engine, teaching state machine, critic Agent, hint gate, or persistent teaching-frame object.
- Do not duplicate tool signatures, owner paths, Trace correction rules, Block transitions, or Markdown compilation rules inside the new teaching core.
- Do not add tests for Skill/Agent prose, headings, phrase lists, or prompt wording. Test only executable resource assembly, packaging, parsing, visibility, and rendering.
- A missing `LEARNING_GUIDE.md` produces an empty public projection and does not block learning.
- Student-facing projections must never include `Internal Teaching Notes`.
- Run real-model acceptance only on isolated copies; never mutate `examples/derivative-demo/learning-set`.
- Preserve and do not stage `.superpowers/` or `docs/superpowers/plans/2026-07-22-three-lesson-teaching-quality-optimization.md`.
- The known pre-existing red assertion in `public-demo.test.ts` must be repaired and reported separately from feature improvement.

---

## File Map

**Create**

- `apps/pi-teaching-web/resources/teaching/math-teaching-core.md`
- `apps/pi-teaching-web/tests/runtime/resource-loader.test.ts`
- `apps/pi-teaching-web/tests/client/learning-set-home.test.tsx`
- `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/LEARNING_GUIDE.md`
- `plugins/highschool-study/skills/math-teaching-core/SKILL.md`
- `plugins/highschool-study/learning-set-template/LEARNING_GUIDE.md`
- `examples/derivative-demo/learning-set/LEARNING_GUIDE.md`
- `docs/audits/2026-07-27-high-school-math-teaching-frame-ab.md`

**Modify**

- `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- `apps/pi-teaching-web/src/shared/contracts.ts`
- `apps/pi-teaching-web/src/study/read-workspace.ts`
- `apps/pi-teaching-web/src/client/components/LearningSetHome.tsx`
- `apps/pi-teaching-web/src/client/styles.css`
- `apps/pi-teaching-web/tests/study/read-workspace.test.ts`
- `apps/pi-teaching-web/tests/study/clean-derivative-demo.test.ts`
- `apps/pi-teaching-web/tests/client/state.test.ts`
- `apps/pi-teaching-web/tests/client/session-tree.test.tsx`
- `apps/pi-teaching-web/tests/server/workspace-api.test.ts`
- `plugins/highschool-study/agents/study-coach.md`
- `plugins/highschool-study/agents/lesson-designer.md`
- `plugins/highschool-study/skills/enter-learning-set/SKILL.md`
- `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
- `plugins/highschool-study/skills/run-lesson/SKILL.md`
- `plugins/highschool-study/tests/contract/package-and-template.test.ts`
- `plugins/highschool-study/tests/contract/public-demo.test.ts`
- `plugins/highschool-study/README.md`
- `examples/derivative-demo/README.md`
- `docs/zh-CN/完整说明书.md`

---

### Task 1: Restore the honest pre-feature test baseline

**Files:**

- Modify: `plugins/highschool-study/tests/contract/public-demo.test.ts`
- Modify: `plugins/highschool-study/tests/contract/adaptive-lesson-demo.test.ts`

- [x] **Step 1: Confirm the known stale assertion**

Run:

```bash
cd plugins/highschool-study
bun test tests/contract/public-demo.test.ts
```

Expected: the old `定义域完整性` assertion fails, and the adaptive-Lesson contract errors
because both still address classroom state intentionally removed from the public demo.

- [x] **Step 2: Replace only the obsolete expectation**

Keep the orientation and persona assertions. Replace the old topic-specific line with the clean public state:

```ts
expect(roadmap).toContain('## Plan Graph');
expect(roadmap).toContain('（尚未创建学习阶段）');
```

Point the adaptive-Lesson contract at
`apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set`, where that frozen
Lesson and its cards now live. Remove only the three assertions that require the clean public
demo README to narrate Lesson 003; retain the generic template and reveal-boundary contract.

- [x] **Step 3: Verify and commit the baseline repair**

```bash
bun test tests/contract/public-demo.test.ts tests/contract/adaptive-lesson-demo.test.ts
git add tests/contract/public-demo.test.ts tests/contract/adaptive-lesson-demo.test.ts
git commit -m "test: align public demo with clean learning state"
```

Expected: PASS. Do not count this repair as evidence that the new teaching frame works.

---

### Task 2: Project public learning principles into the Pi home

**Files:**

- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/study/read-workspace.ts`
- Modify: `apps/pi-teaching-web/src/client/components/LearningSetHome.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Create: `apps/pi-teaching-web/tests/client/learning-set-home.test.tsx`
- Create: `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/LEARNING_GUIDE.md`
- Modify: `apps/pi-teaching-web/tests/study/read-workspace.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/clean-derivative-demo.test.ts`
- Modify: `apps/pi-teaching-web/tests/client/state.test.ts`
- Modify: `apps/pi-teaching-web/tests/client/session-tree.test.tsx`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

**Interface:**

```ts
export type LearningSetSnapshot = {
  title: string;
  overview: string;
  learningPrinciples: string;
  goal: string;
  plans: PlanSummary[];
};
```

- [x] **Step 1: Add failing parser and rendering tests**

Give the domain-integrity fixture a synthetic guide containing distinct public and internal markers. Extend `read-workspace.test.ts`:

```ts
expect(learningSet.learningPrinciples).toContain('PUBLIC LEARNING PRINCIPLE');
expect(learningSet.learningPrinciples).not.toContain('PRIVATE TEACHING NOTE');
```

Create `learning-set-home.test.tsx` with a synthetic snapshot and assert that the rendered HTML contains the public marker and not the private marker. Add `learningPrinciples: ''` to unrelated snapshot fixtures so TypeScript exposes every caller.

- [x] **Step 2: Run the focused tests and verify red**

```bash
cd apps/pi-teaching-web
bun test tests/study/read-workspace.test.ts tests/client/learning-set-home.test.tsx
bun run typecheck
```

Expected: FAIL because the contract, reader, and UI do not yet expose learning principles.

- [x] **Step 3: Implement the optional guide reader**

In `read-workspace.ts`, read only the fixed root file when present:

```ts
function studentLearningPrinciples(root: string): string {
  const guidePath = resolve(root, 'LEARNING_GUIDE.md');
  if (!existsSync(guidePath)) return '';
  return section(
    readMarkdownFile(root, 'LEARNING_GUIDE.md').body,
    'Student Learning Principles',
  );
}
```

Return it as `learningPrinciples` from `readLearningSet()`. Do not expose the full guide through the API.

- [x] **Step 4: Render a restrained “研习要领” section**

After the overview, render the section only when non-empty:

```tsx
{value.learningPrinciples && (
  <section className="home-principles" aria-label="研习要领">
    <p className="section-label">研习要领</p>
    <MarkdownView>{value.learningPrinciples}</MarkdownView>
  </section>
)}
```

Add only local typography and spacing styles that fit the current 留白新中式 theme.

- [x] **Step 5: Verify the projection boundary and commit**

```bash
bun test tests/study/read-workspace.test.ts \
  tests/study/clean-derivative-demo.test.ts \
  tests/client/learning-set-home.test.tsx \
  tests/client/state.test.ts \
  tests/client/session-tree.test.tsx \
  tests/server/workspace-api.test.ts
bun run typecheck
git add src tests
git commit -m "feat: surface public learning principles"
```

Expected: public principles render; internal notes never enter `LearningSetSnapshot`.

---

### Task 3: Add versioned learning guides and entry behavior

**Files:**

- Create: `plugins/highschool-study/learning-set-template/LEARNING_GUIDE.md`
- Create: `examples/derivative-demo/learning-set/LEARNING_GUIDE.md`
- Modify: `plugins/highschool-study/skills/enter-learning-set/SKILL.md`
- Modify: `plugins/highschool-study/tests/contract/package-and-template.test.ts`
- Modify: `plugins/highschool-study/tests/contract/public-demo.test.ts`

- [x] **Step 1: Add packaging tests for the guide files**

Assert only that both distributable roots contain `LEARNING_GUIDE.md`. Do not test headings or prose.

- [x] **Step 2: Run the contract tests and verify red**

```bash
cd plugins/highschool-study
bun test tests/contract/package-and-template.test.ts tests/contract/public-demo.test.ts
```

Expected: FAIL because the two guide assets do not exist.

- [x] **Step 3: Create the compact template**

Use exactly the approved public/private split:

```markdown
# <学习集名称>学习指南

## Student Learning Principles

<!-- 给学生看的高效学习原则。 -->

## Internal Teaching Notes

### Learning logic
### Learner difficulties
### Teaching choices
```

Keep placeholders short and useful to a learning-set author.

- [x] **Step 4: Write the derivative guide**

The public section should teach structure-before-calculation, method-choice explanation, transfer across different problem shells, and error-type distinction. Internal notes should keep the main line on structural recognition, method choice, execution, and transfer; they should explicitly prevent domain-integrity corner cases from crowding out the advanced method graph. Include no card answer or hidden Lesson content.

- [x] **Step 5: Update entry semantics**

`enter-learning-set` reads the optional guide, presents only `Student Learning Principles`, and treats a missing guide as empty. It returns no internal notes to the student.

- [x] **Step 6: Verify and commit**

```bash
bun test tests/contract/package-and-template.test.ts tests/contract/public-demo.test.ts
git add learning-set-template/LEARNING_GUIDE.md \
  skills/enter-learning-set/SKILL.md \
  tests/contract/package-and-template.test.ts \
  tests/contract/public-demo.test.ts \
  ../../examples/derivative-demo/learning-set/LEARNING_GUIDE.md
git commit -m "feat: add learning-set teaching guides"
```

---

### Task 4: Compose the shared teaching core into Pi roles

**Files:**

- Create: `apps/pi-teaching-web/resources/teaching/math-teaching-core.md`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Create: `apps/pi-teaching-web/tests/runtime/resource-loader.test.ts`
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`

**Interface:**

```ts
export function composeRoleContext(
  teachingCore: string,
  roleContext: string,
  ownerContext: string,
): string;
```

- [x] **Step 1: Add the failing executable assembly test**

Use sentinel strings and assert exact order and one occurrence:

```ts
expect(composeRoleContext('CORE', 'ROLE', 'OWNER'))
  .toBe('CORE\n\nROLE\n\nOWNER');
```

This tests resource composition, not Prompt prose.

- [x] **Step 2: Run the focused test and verify red**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/resource-loader.test.ts
```

Expected: FAIL because `composeRoleContext` does not exist.

- [x] **Step 3: Add the shared mathematical judgment core**

Keep it short. It owns five judgments only:

- target;
- starting point;
- task;
- intervention;
- evidence.

Its global principles are authentic mathematical facts, non-binary interpretation of one answer, and long-term change only from repeated cross-task evidence. It must not mention tool fields, session IDs, Trace repair, Markdown syntax, or fixed action sequences.

- [x] **Step 4: Compose the core before the role context**

Read `resources/teaching/math-teaching-core.md` once when creating a role loader and use:

```ts
export function composeRoleContext(
  teachingCore: string,
  roleContext: string,
  ownerContext: string,
): string {
  return [teachingCore, roleContext, ownerContext]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n');
}
```

Do not add a new runtime state or tool.

- [x] **Step 5: Refine the Pi Coach and Tutor frames**

Coach reads the full guide during Plan design/revision and preparation, then:

1. understands how this student currently thinks;
2. chooses one primary cognitive change;
3. organizes non-duplicative tasks that can produce that change;
4. anticipates student reactions and defines independent ending evidence.

Coach copies only the principles relevant to this Lesson into existing Lesson/Teacher Control
text; it does not add a guide field to the Blueprint.

Tutor normally uses Lesson-selected guidance and may read one relevant internal guide subsection when an unanticipated live route makes it useful. Its live loop is:

```text
understand → judge → intervene → observe again
```

Keep all existing evidence, student-control, route-settlement, and closure semantics. Do not turn teaching moves into an exhaustive enum.

- [x] **Step 6: Verify and commit**

```bash
bun test tests/runtime/resource-loader.test.ts
bun run typecheck
git add resources/teaching/math-teaching-core.md \
  resources/skills/coach-study/SKILL.md \
  resources/skills/tutor-lesson/SKILL.md \
  src/runtime/resource-loader.ts \
  tests/runtime/resource-loader.test.ts
git commit -m "feat: add pi math teaching frames"
```

---

### Task 5: Align the public Claude plugin teaching frames

**Files:**

- Create: `plugins/highschool-study/skills/math-teaching-core/SKILL.md`
- Modify: `plugins/highschool-study/agents/study-coach.md`
- Modify: `plugins/highschool-study/agents/lesson-designer.md`
- Modify: `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
- Modify: `plugins/highschool-study/skills/run-lesson/SKILL.md`

- [ ] **Step 1: Create the public shared core Skill**

Use the same five judgments and three principles as the Pi core, expressed as a non-user-invocable Skill. Keep it independent of Pi-specific tools and session mechanics.

- [ ] **Step 2: Load it for both public Agent roles**

Add `highschool-study:math-teaching-core` to the `skills` frontmatter of `study-coach` and `lesson-designer`. Preserve the designer's existing memory Skill.

- [ ] **Step 3: Apply the Coach and Tutor frames to their semantic owners**

Refine `prepare-next-lesson` around the four Coach responsibilities and `run-lesson` around the live teaching loop. Preserve all current authenticity, reveal, evidence, alternative-route, task-list, and closure behavior.

Preparation carries only the relevant guide principles into existing Lesson/Teacher Control
text. Do not add a persistent guide field or copy the whole guide into every Lesson.

Do not add prompt string tests. Review the diff manually for duplicated protocol and over-enumeration.

- [ ] **Step 4: Validate the plugin and commit**

```bash
cd plugins/highschool-study
bun run validate:plugin
bun run typecheck
git add agents/study-coach.md \
  agents/lesson-designer.md \
  skills/math-teaching-core/SKILL.md \
  skills/prepare-next-lesson/SKILL.md \
  skills/run-lesson/SKILL.md
git commit -m "feat: align plugin math teaching frames"
```

Expected: strict validation passes and the public MCP tool count remains four.

---

### Task 6: Document the four teaching assets and run deterministic verification

**Files:**

- Modify: `plugins/highschool-study/README.md`
- Modify: `examples/derivative-demo/README.md`
- Modify: `docs/zh-CN/完整说明书.md`

- [ ] **Step 1: Document the user-facing model**

Explain:

- the four teaching assets;
- the public/internal guide boundary;
- Coach full-guide access and Tutor Lesson-first/on-demand access;
- the five shared judgments;
- the Plan-or-3–5-Lesson review loop;
- why isolated slips do not immediately expand Prompt text.

Keep implementation details in the full manual and keep the two READMEs task-oriented.

- [ ] **Step 2: Run the complete plugin checks**

```bash
cd plugins/highschool-study
bun install --frozen-lockfile
bun run release:check
```

Expected: bundle, typecheck, all tests, strict plugin validation, and four-tool contract pass.

- [ ] **Step 3: Run the complete Pi checks**

```bash
cd apps/pi-teaching-web
bun install --frozen-lockfile
bun run check
bun run test:e2e
```

Expected: typecheck, unit tests, production build, and browser E2E pass.

- [ ] **Step 4: Check boundaries and commit documentation**

```bash
git diff --check
git diff --exit-code -- examples/derivative-demo/learning-set/cards
git status --short
git add plugins/highschool-study/README.md \
  examples/derivative-demo/README.md \
  docs/zh-CN/完整说明书.md
git commit -m "docs: explain math teaching frames"
```

---

### Task 7: Run the final real-model A/B teaching comparison

**Files:**

- Create: `docs/audits/2026-07-27-high-school-math-teaching-frame-ab.md`
- Inspect only: two isolated runtime roots and their Pi Session histories

**Comparison contract:**

- A = the pre-implementation runtime commit.
- B = the final candidate commit.
- Same configured real Provider/model; record names, never credentials.
- Same clean derivative learning-set starting state, persona, deep-mode setting, message projection, student profile, and initial requests.
- Two paired short-course scenarios:
  1. Coach must turn a broad advanced-derivative goal into one cognitive-change target and a purposeful task sequence.
  2. Tutor receives a plausible partial or non-reference route, then a help request, and must adapt before checking independent transfer.
- The student responds only to visible content. Do not tell either arm which teaching move, tool call, Trace, or score is expected.
- Do not patch product or Prompt during either arm.

- [ ] **Step 1: Record immutable run identities**

Before feature commits, save the pre-implementation commit as `baselineCommit`. After Task 6, save `candidateCommit`. Record both commits and dirty states in the report.

- [ ] **Step 2: Create isolated A and B copies**

Use detached code worktrees and separate `/tmp/studyforge-math-frame-ab-*` learning-set and Pi runtime roots. Copy the matching commit's derivative demo into each root. Use separate free ports and Session directories. Never print or copy credentials.

- [ ] **Step 3: Run paired Scenario 1**

Send the same natural student goal to each Coach:

```text
我做导数综合题时一看到参数就容易急着分类讨论。想系统练一下怎么先看结构、再决定方法。
请先和我确认这一阶段真正要改变什么，然后给我准备一节短课。
```

Enter the resulting Tutor Lesson and answer naturally from student-visible material. Use the same student disposition in both arms: state the current idea first, preserve a plausible misconception until the Tutor responds, and attempt the final transfer independently.

- [ ] **Step 4: Run paired Scenario 2**

Start both arms from fresh copies. Use the same request for a lesson that distinguishes structural recognition from mechanical calculation. In Tutor, offer a mathematically plausible non-reference route, ask for one limited hint only if blocked, and explicitly choose when to end.

- [ ] **Step 5: Produce blinded comparison packets**

Export/sanitize the four student-visible transcripts into the temporary runtime only. Randomly label each pair `X` and `Y`; keep the mapping unread until the evidence table is complete. Exclude system prompts, Teacher Control, tool arguments, credentials, hidden answers, and raw private reasoning.

- [ ] **Step 6: Judge six teaching dimensions**

For each pair, mark `X better`, `same`, or `Y better`, with exact turn references:

| Dimension | Observable question |
| --- | --- |
| Target | Did Coach name a worthwhile cognitive change rather than a topic label? |
| Task sequence | Did tasks have distinct functions and build toward that change? |
| Student thinking | Did Tutor reconstruct and use the student's actual route? |
| Intervention | Was help timely, proportionate, and non-substitutive? |
| Transfer evidence | Did a fresh independent response test the intended change? |
| Classroom quality | Was the exchange natural, focused, and student-controlled? |

Unblind only after all judgments are written. “Clearly improved” requires B to improve at least four dimensions in both pairs, with no safety/fact regression and no dimension consistently worse. Otherwise report `INCONCLUSIVE` or `REGRESSION`.

- [ ] **Step 7: Audit non-quality invariants**

For every arm, verify real cards, student-view secrecy, role/session ownership, active Trace meaning, and student-controlled closure from the exact Session and durable files. Tool success is a gate, not part of the quality score.

- [ ] **Step 8: Write and commit the sanitized report**

The report must contain:

```markdown
## Run Identity
## Controls
## Paired Teaching Evidence
## Blinded Quality Comparison
## Runtime Invariants
## Result
## Remaining Uncertainty
## Next Action
```

Do not include full transcripts or hidden Prompt text. Preserve temporary evidence roots for user audit, stop both servers, and verify the repository demo is unchanged.

```bash
git diff --exit-code -- examples/derivative-demo/learning-set
git diff --check
git add docs/audits/2026-07-27-high-school-math-teaching-frame-ab.md
git commit -m "test: compare math teaching frame quality"
```

---

## Final Completion Gate

- [ ] The public demo baseline test is green and its old failure is not attributed to this feature.
- [ ] Pi loads one shared teaching core before each role context.
- [ ] Public Claude roles load the equivalent shared core Skill.
- [ ] Coach and Tutor semantic owners express the approved frames without duplicating runtime protocol.
- [ ] The template and derivative demo both ship `LEARNING_GUIDE.md`.
- [ ] Pi API and home expose only public learning principles.
- [ ] Missing guides remain valid and empty.
- [ ] No Skill/Agent prose-string tests were added.
- [ ] Public MCP tool count remains exactly four.
- [ ] Plugin release checks and Pi unit/build/E2E checks pass.
- [ ] A real-model, two-pair, blinded A/B comparison reports `CLEAR IMPROVEMENT`, `INCONCLUSIVE`, or `REGRESSION` from preserved evidence.
- [ ] The repository example learning set remains unmodified by live acceptance.
