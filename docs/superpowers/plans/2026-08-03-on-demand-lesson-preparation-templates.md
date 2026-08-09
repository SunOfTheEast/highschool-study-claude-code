# On-Demand Lesson Preparation Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Plan Coach seven concise, on-demand Markdown preparation templates that produce materially different Lesson Block arrangements without adding a Lesson type or runtime template engine.

**Architecture:** Package one index and seven reference files beside the existing `coach-study` Skill. The Skill selects one main template after diagnosis and before material search, then translates it into the existing Lesson goal, Blocks, Student View, and Teacher Control. Runtime, schema, tools, persistence, and Tutor resources stay unchanged.

**Tech Stack:** Markdown Skill resources, Pi native Skill loading, Bun tests, existing StudyForge M0 document contract.

## Global Constraints

- Preserve Roadmap → Plan → Lesson → Block and direct parent reading of closed Lesson Markdown.
- Preserve the existing Lesson frontmatter, four Block kinds, Student View, Teacher Control, and Classroom Log.
- Add no Lesson type field, template ID, template compiler, state machine, timer, tool, database, index, Handoff, Trace, BKT, or review scheduler.
- Read one main Lesson template on demand; do not inject all seven into every Plan turn.
- Choose the teaching shape before deriving material slots or launching Scouts.
- Tutor does not read the template library; the prepared Lesson is the handoff.
- Do not add exact-wording tests for Skill prose. Test only resource packaging and existing mechanical contracts.
- Preserve unrelated dirty-worktree changes and stage only task-owned hunks and files.

---

### Task 1: Package the seven Lesson-template references

**Files:**
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`
- Create: `apps/pi-teaching-web/resources/skills/coach-study/references/lesson-templates/INDEX.md`
- Create: `apps/pi-teaching-web/resources/skills/coach-study/references/lesson-templates/diagnostic.md`
- Create: `apps/pi-teaching-web/resources/skills/coach-study/references/lesson-templates/concept-construction.md`
- Create: `apps/pi-teaching-web/resources/skills/coach-study/references/lesson-templates/deliberate-practice.md`
- Create: `apps/pi-teaching-web/resources/skills/coach-study/references/lesson-templates/remediation.md`
- Create: `apps/pi-teaching-web/resources/skills/coach-study/references/lesson-templates/assessment.md`
- Create: `apps/pi-teaching-web/resources/skills/coach-study/references/lesson-templates/review-stage-consolidation.md`
- Create: `apps/pi-teaching-web/resources/skills/coach-study/references/lesson-templates/review-spaced-retrieval.md`

**Interfaces:**
- Consumes: the existing `coach-study` Skill package and current Lesson document contract.
- Produces: one discoverable index plus seven independently readable teaching references.

- [ ] **Step 1: Add a failing packaging test**

Extend the `node:fs` import in `native-session.test.ts` with `readdirSync`, then add:

```ts
test('packages the complete Coach lesson-template reference set', () => {
  const directory = join(
    import.meta.dir,
    '../../resources/skills/coach-study/references/lesson-templates',
  );
  const expected = [
    'INDEX.md',
    'assessment.md',
    'concept-construction.md',
    'deliberate-practice.md',
    'diagnostic.md',
    'remediation.md',
    'review-spaced-retrieval.md',
    'review-stage-consolidation.md',
  ];

  expect(readdirSync(directory).sort()).toEqual(expected);
  for (const name of expected) {
    expect(readFileSync(join(directory, name), 'utf8').trim().length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts
```

Expected: FAIL with `ENOENT` for `references/lesson-templates`.

- [ ] **Step 3: Write the index**

`INDEX.md` must contain one compact routing table with these exact purposes:

| Template | Main question |
|---|---|
| `diagnostic.md` | What can the student actually do before instruction? |
| `concept-construction.md` | What new concept or method must be formed? |
| `deliberate-practice.md` | What known method needs stability, discrimination, or transfer? |
| `remediation.md` | What evidenced error needs a qualitatively different repair? |
| `assessment.md` | Has the Plan capability standard been independently met? |
| `review-stage-consolidation.md` | How should recent Lessons become one usable method structure? |
| `review-spaced-retrieval.md` | What older learning remains retrievable after delay? |

The index must say: choose one main template, read only that file, and treat mixed needs as Blocks inside the chosen main shape rather than creating a new hybrid type.

- [ ] **Step 4: Write the seven reference files**

Every file uses these headings:

```markdown
# <Template name>

## Use when
## Intended change
## Necessary teaching functions
## Default activity path and depth
## Adaptation from student evidence
## First-pass information boundary
## Sufficient closing evidence
## Reflection default
```

Implement the following distinct contracts:

- `diagnostic.md`: 3–5 short, structurally varied probes; neutral first pass; stop with a bounded diagnosis and next-step decision, not a mastery claim.
- `concept-construction.md`: activate prerequisites; construct or model one idea; require explanation; use a different task for near transfer and an independent exit; media must feed a later observation or task.
- `deliberate-practice.md`: normally 4–6 problem materials with different roles and depths; commonly two complete solutions plus recognition, contrast, transfer, and exit work; never require one universal problem.
- `remediation.md`: reread the original Block; confirm the problem; repair through a genuinely different representation or route; use a separate unseen parallel task for recheck.
- `assessment.md`: 2–4 representative unseen tasks; no teaching between independent attempts; requested help ends that attempt's independent status; conclusions stay within the declared standard.
- `review-stage-consolidation.md`: reread recent closed Lessons; retrieve representative ideas, compare adjacent methods, reorganize boundaries, and finish with route choice or transfer.
- `review-spaced-retrieval.md`: first complete 5–8 mixed cold-retrieval probes, then teach only the observed weak points and independently recheck them on new material.

Each file must state that activity count is a default capacity rather than a quota, and that runtime fields, fixed minutes, fixed Block IDs, and template-specific schemas are out of scope.

- [ ] **Step 5: Run the packaging test and verify GREEN**

Run:

```bash
bun test tests/m0/native-session.test.ts
```

Expected: all tests in the file pass.

### Task 2: Route Coach preparation through one selected template

**Files:**
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`

**Interfaces:**
- Consumes: `references/lesson-templates/INDEX.md`, the seven templates, Plan history, and the existing material-slot workflow.
- Produces: a prepared Lesson whose Blocks embody one main teaching shape before any Scout task is derived.

- [ ] **Step 1: Add the on-demand routing section**

Insert a short section after diagnosis and before `Select material privately` with this positive recipe:

```text
clear Lesson purpose
→ read the one matching template
unclear purpose
→ read INDEX.md, choose, then read one template
→ adapt its functions to this student
→ agree the public activity shape
→ derive material slots only for Blocks needing external assets
```

Require the Coach to:

- select by the main teaching purpose, not by chapter name;
- use one main template even when a few Blocks serve secondary needs;
- write all Tutor-relevant decisions into Lesson Goal, Student View, Teacher Control, dependencies, and required/optional Blocks;
- avoid persisting the template name or asking Tutor to reread it;
- use the stage-consolidation and spaced-retrieval templates for their separate progress-chain and time-chain purposes;
- create no Lesson when an agreed required material role remains unfilled.

Keep the existing student inquiry, Scout JSON contract, tool-only rhythm, direct Lesson reading, public summary boundary, and prepared-only write authority unchanged.

- [ ] **Step 2: Inspect the Skill diff**

Run:

```bash
git diff --check -- apps/pi-teaching-web/resources/skills/coach-study/SKILL.md
git diff -- apps/pi-teaching-web/resources/skills/coach-study/SKILL.md
```

Expected: the new section precedes material search, does not duplicate template bodies, and does not overwrite the existing dirty slot-Scout improvements.

- [ ] **Step 3: Commit only Task 1–2 files and the task-owned Coach hunk**

Stage the eight new references, the packaging-test hunk, and only the new Lesson-template routing hunk from `coach-study/SKILL.md`. Do not stage pre-existing unrelated hunks.

Commit:

```bash
git commit -m "feat: add on-demand lesson preparation templates"
```

### Task 3: Verify resource loading and unchanged M0 mechanics

**Files:**
- Inspect: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Inspect: `apps/pi-teaching-web/resources/contracts/m0-document-contract.md`

**Interfaces:**
- Consumes: the resource-only implementation.
- Produces: fresh evidence that template references coexist with current node resources without changing schema or tools.

- [ ] **Step 1: Run focused tests**

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts tests/m0/markdown-domain.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run the complete deterministic check**

```bash
bun run check
```

Expected: typecheck, complete Bun suite, and production build pass.

- [ ] **Step 3: Verify the final file set**

```bash
git show --stat --oneline HEAD
git status --short
```

Expected: the implementation commit contains only the eight Lesson-template references, the packaging test, and the task-owned Coach routing hunk. Existing unrelated dirty files remain uncommitted.
