# Adaptive Plan Cycle Archetypes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Roadmap and Plan Coaches five shared, on-demand Plan-cycle archetypes that compile into the existing public Plan arrangement and adapt from closed Lesson evidence.

**Architecture:** Store one index and five cycle references beside `plan-next-cycle`, a Skill already loaded by both Roadmap and Plan Sessions. Roadmap chooses an initial archetype and writes a concrete arc into the existing Plan. Plan Coach rereads closed Lessons and changes only future arrangement or prepared Lessons; no template ID, phase cursor, scheduler, or second fact store is added.

**Tech Stack:** Markdown Skill resources, Pi native role Skill loading, Bun tests, existing StudyForge M0 Plan/Lesson contract.

## Global Constraints

- Preserve `Stage Goal`, `Observable Capability Standard`, `Test`, `Lesson Tree`, `Current Position`, and `Next Lesson Arrangement` as the complete Plan body contract.
- Preserve student-owned node start and completion actions.
- The initial archetype is a planning hypothesis, not a student fact and not a persisted ID.
- Fix teaching functions and evidence boundaries; never fix Lesson count, phase duration, or a runtime phase cursor.
- Plan Coach may adapt future work while Goal, Standard, and Test keep the same meaning; a changed stage problem returns to Roadmap.
- Keep stage consolidation on the learning-progress chain and delayed retrieval on the forgetting-time chain.
- A future review queue only offers candidates; it never creates or mandates a Lesson.
- Add no schema, state machine, scheduler, Handoff, Trace, BKT, profile, vector store, or new tool.
- Do not add exact-wording tests for Skill prose. Test only resource packaging and current role loading.
- Preserve unrelated dirty-worktree changes and stage only task-owned hunks and files.

---

### Task 1: Package the five shared cycle references

**Files:**
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`
- Create: `apps/pi-teaching-web/resources/skills/plan-next-cycle/references/plan-cycles/INDEX.md`
- Create: `apps/pi-teaching-web/resources/skills/plan-next-cycle/references/plan-cycles/capability-construction.md`
- Create: `apps/pi-teaching-web/resources/skills/plan-next-cycle/references/plan-cycles/strategy-strengthening.md`
- Create: `apps/pi-teaching-web/resources/skills/plan-next-cycle/references/plan-cycles/remediation.md`
- Create: `apps/pi-teaching-web/resources/skills/plan-next-cycle/references/plan-cycles/systematic-review.md`
- Create: `apps/pi-teaching-web/resources/skills/plan-next-cycle/references/plan-cycles/diagnostic.md`

**Interfaces:**
- Consumes: the `plan-next-cycle` package shared by Roadmap and Plan roles.
- Produces: one cycle router and five independently readable Plan-level teaching references.

- [ ] **Step 1: Add a failing packaging test**

Add to `native-session.test.ts`:

```ts
test('packages the complete shared Plan-cycle reference set', () => {
  const directory = join(
    import.meta.dir,
    '../../resources/skills/plan-next-cycle/references/plan-cycles',
  );
  const expected = [
    'INDEX.md',
    'capability-construction.md',
    'diagnostic.md',
    'remediation.md',
    'strategy-strengthening.md',
    'systematic-review.md',
  ];

  expect(readdirSync(directory).sort()).toEqual(expected);
  for (const name of expected) {
    expect(readFileSync(join(directory, name), 'utf8').trim().length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts
```

Expected: FAIL with `ENOENT` for `references/plan-cycles`.

- [ ] **Step 3: Write the cycle index**

`INDEX.md` must route by the current stage problem:

| Cycle | Use when |
|---|---|
| `capability-construction.md` | A concept, method, representation, or structural connection must first be formed. |
| `strategy-strengthening.md` | Known methods need stability, discrimination, route choice, or transfer. |
| `remediation.md` | Original Lesson records show an important or recurring error that deserves a stage goal. |
| `systematic-review.md` | Review and reorganization are the Plan's main progress objective. |
| `diagnostic.md` | Uncertainty is too high to prescribe the next substantive stage responsibly. |

The index must state that Goal, Standard, and Test are fixed first; one main cycle is chosen; the selected reference is translated into actual `Next Lesson Arrangement` prose; and the template name is not persisted.

- [ ] **Step 4: Write the five cycle references**

Every file uses:

```markdown
# <Cycle name>

## Use when
## Stage problem
## Minimum starting information
## Default phase graph
## Evidence sought at each phase
## Branches and loops
## Sufficient completion boundary
## Common Lesson templates
## Common misjudgment
```

Implement these distinct graphs:

- `capability-construction.md`: prerequisites and baseline → construct one idea → guided near transfer → one-variable variation → unseen independent transfer → direct check.
- `strategy-strengthening.md`: independent route-choice baseline → compare conditions and costs → controlled variation → mixed/interleaved selection → unfamiliar transfer → direct check.
- `remediation.md`: reread and verify original problem → identify mechanism → qualitatively different corrective → targeted practice → unseen parallel recheck → return to main Roadmap line.
- `systematic-review.md`: cold representative retrieval → rebuild structure → compare confusable boundaries → mixed active use → local repair → cumulative transfer and stage check.
- `diagnostic.md`: name competing explanations → complementary short probes → observe starts/stops/help → discriminating recheck → student confirmation → return to Roadmap for the next substantive Plan.

Every reference must say that a phase may occupy zero, one, or several Lessons and may be skipped, repeated, merged, or revisited. It must not prescribe fixed Lesson IDs, counts, minutes, mastery scores, or runtime fields.

- [ ] **Step 5: Run the packaging test and verify GREEN**

```bash
bun test tests/m0/native-session.test.ts
```

Expected: all tests in the file pass.

### Task 2: Route Roadmap creation and Plan continuation through the cycle library

**Files:**
- Modify: `apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`

**Interfaces:**
- Consumes: the five cycle references, current Plan contract, closed Lesson Markdown, and the Lesson-template routing implemented by the preceding plan.
- Produces: concrete initial Plan arcs and evidence-driven future Lesson arrangements without a persisted cycle state.

- [ ] **Step 1: Give `plan-next-cycle` the shared cycle grammar**

Add a concise section that requires:

```text
Goal + observable standard + direct test
→ enough starting evidence
→ one main cycle reference
→ concrete public arc
→ closed Lesson evidence
→ continue, repair, rediagnose, or independently verify
```

State that the selected archetype is disposable planning guidance. Existing Plan prose and original Lessons are authoritative. Read `INDEX.md` only when the cycle is unclear, otherwise read one direct template. A cycle phase is a teaching function, not a persisted node or runtime state.

- [ ] **Step 2: Update initial Roadmap Plan creation**

In `roadmap-study/SKILL.md`, extend `Arrange the Roadmap` so the Roadmap Coach:

1. fixes the bounded stage problem, observable standard, and direct test;
2. selects one main cycle reference after diagnosis;
3. translates it into student-readable `Next Lesson Arrangement` rather than copying a template name;
4. creates no Lesson and no future child link;
5. explains uncertainty and allows the student to change the proposed arc.

Keep the existing orientation, one-question diagnosis, direct historical reading, child-first linking, and student-owned lifecycle unchanged.

- [ ] **Step 3: Update Plan-level continuation**

In `coach-study/SKILL.md`, add before Lesson-template selection:

1. compare all closed Lessons with the Plan Goal, Standard, and Test;
2. determine which teaching function is now needed;
3. normally follow the concrete Plan arc without rereading generic cycle files;
4. reread the selected cycle or index only when future phases must be reinterpreted or reordered;
5. discuss a consequential change with the student;
6. update `Current Position` and future `Next Lesson Arrangement`, then select one Lesson template and prepare only the next mature Lesson.

Allow repeating, skipping, merging, or reordering future functions while the stage contract is unchanged. A changed stage problem returns to Roadmap. Do not modify closed Lessons or invent a cycle-state field.

- [ ] **Step 4: Preserve the two review chains**

Across the shared Skill wording, keep these responsibilities explicit:

```text
stage consolidation → current Plan progress chain
systematic-review cycle → review is the Plan's main goal
spaced-retrieval candidate → time chain offers material to Coach
Coach → may select none, a warm-up Block, one review Lesson, or a review Plan
```

- [ ] **Step 5: Inspect all three Skill diffs**

```bash
git diff --check -- \
  apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md \
  apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md
git diff -- \
  apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md \
  apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md
```

Expected: no template body is copied into a root Skill; Coach history reading remains direct; existing dirty Scout guidance is preserved; no new schema or tool authority appears.

- [ ] **Step 6: Commit only Task 1–2 files and task-owned Skill hunks**

Stage the six new cycle references, packaging-test hunk, complete changes to the previously clean `plan-next-cycle` and `roadmap-study` files, and only the cycle-routing hunk from dirty `coach-study/SKILL.md`.

Commit:

```bash
git commit -m "feat: add adaptive Plan cycle archetypes"
```

### Task 3: Verify shared role access and complete deterministic behavior

**Files:**
- Inspect: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Inspect: `apps/pi-teaching-web/resources/contracts/m0-document-contract.md`

**Interfaces:**
- Consumes: both completed template implementations.
- Produces: evidence that Roadmap and Plan load the shared Skill package while Lesson does not gain Plan-level guidance.

- [ ] **Step 1: Run focused resource tests**

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts tests/m0/markdown-domain.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run complete deterministic verification**

```bash
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

Expected: typecheck, all non-E2E tests, production build, and the deterministic browser cycle pass.

- [ ] **Step 3: Inspect final commits and dirty-tree preservation**

```bash
git show --stat --oneline HEAD~1
git show --stat --oneline HEAD
git status --short
```

Expected: the two implementation commits contain only their template references, packaging tests, and task-owned Skill hunks. The pre-existing unrelated dirty changes remain present and uncommitted.

- [ ] **Step 4: Prepare real-cycle acceptance criteria**

For the next real-course run, require one Roadmap-created Plan and at least three closed Lessons to demonstrate:

```text
initial archetype becomes concrete Plan prose
→ Plan Coach reads original Lesson logs
→ one future teaching function is confirmed or changed
→ only one Lesson template is read for the next class
→ no cycle ID or phase state is written
→ an independent task genuinely exercises the declared Plan standard
```

Do not treat fixed Lesson count, template-name mentions, or a single successful answer as acceptance evidence.
