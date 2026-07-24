# Assessment Shared Card Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent a multi-part assessment card from revealing future parts when one alias is reused across several problem Blocks, and keep first-attempt assessment language neutral.

**Architecture:** Keep the existing Lesson, card and StudentNotebook contracts. `readStudentNotebook` will withhold an otherwise visible alias while any assessment problem Block using that alias is still pending or skipped; once every related Block is active/completed, the existing full-card projection resumes. Coach and Tutor Skills will state the same no-cue rule without adding prose tests.

**Tech Stack:** TypeScript, Bun test, React/Vite, Playwright, Markdown Skills.

## Global Constraints

- Do not change Lesson, Blueprint, problem-card, Trace or StudentNotebook schemas.
- Do not parse or crop problem-card `parts`.
- Preserve single-Block card behavior and every non-assessment projection.
- Do not rewrite existing generated Lessons.
- Do not add tests for exact Skill wording.
- Keep the public Claude plugin MCP tool count at four.

---

### Task 1: Withhold a shared assessment card until all related Blocks are visible

**Files:**
- Modify: `apps/pi-teaching-web/tests/study/student-notebook.test.ts`
- Modify: `apps/pi-teaching-web/src/study/student-notebook.ts`

**Interfaces:**
- Consumes: `LessonNode.blocks`, where each Block exposes `kind`, `status` and `uses`.
- Produces: unchanged `readStudentNotebook(root, lessonId, authoring): StudentNotebook`.

- [ ] **Step 1: Write the failing shared-alias test**

Add this test after the existing card-visibility test:

```ts
test('withholds a shared assessment card until every related problem Block is visible', () => {
  const root = fixture();
  const lessonPath = join(root, 'lessons/lesson-003.md');
  writeFileSync(
    lessonPath,
    readFileSync(lessonPath, 'utf8')
      .replace('- Uses: Q-DOMAIN-EX16', '- Uses: Q-DOMAIN-EX22'),
  );

  setBlockStatus(root, 'lessons/lesson-003.md', 'orientation', 'completed');
  setBlockStatus(root, 'lessons/lesson-003.md', 'assessment-01', 'active');
  expect(readStudentNotebook(root, 'lesson-003', false).cards).toEqual({});

  setBlockStatus(root, 'lessons/lesson-003.md', 'assessment-01', 'completed');
  setBlockStatus(root, 'lessons/lesson-003.md', 'assessment-02', 'active');
  expect(Object.keys(readStudentNotebook(root, 'lesson-003', false).cards))
    .toEqual(['Q-DOMAIN-EX22']);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/student-notebook.test.ts
```

Expected: FAIL because `Q-DOMAIN-EX22` is returned while `assessment-02` is still pending.

- [ ] **Step 3: Implement the minimal alias gate**

Add these helpers above `readStudentNotebook`:

```ts
function lessonTemplate(source: string): string | null {
  return /^-\s+Primary template:\s*`?([^`\n]+)`?\s*$/m
    .exec(source)?.[1]?.trim() ?? null;
}

function blockIsVisible(status: string): boolean {
  return status === 'active' || status === 'completed';
}
```

Replace the current visible-alias setup with:

```ts
const visibleAliases = new Set(
  lesson.blocks
    .filter((block) => blockIsVisible(block.status))
    .flatMap((block) => block.uses),
);
const withheldAliases = new Set(
  lessonTemplate(source) === 'assessment' && lesson.status !== 'closed'
    ? lesson.blocks
      .filter((block) => block.kind === 'problem' && !blockIsVisible(block.status))
      .flatMap((block) => block.uses)
    : [],
);
```

Change the alias loop guard to:

```ts
if (!visibleAliases.has(alias) || withheldAliases.has(alias)) continue;
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/student-notebook.test.ts
```

Expected: all tests in the file PASS, including the existing single-card and closed-Lesson cases.

- [ ] **Step 5: Commit the executable fix**

```bash
git add apps/pi-teaching-web/src/study/student-notebook.ts \
  apps/pi-teaching-web/tests/study/student-notebook.test.ts
git commit -m "fix: delay shared assessment card reveal"
```

---

### Task 2: Keep first-attempt assessment language neutral

**Files:**
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
- Modify: `plugins/highschool-study/skills/run-lesson/SKILL.md`

**Interfaces:**
- Consumes: existing assessment template and active-Block rules.
- Produces: synchronized Coach/Tutor instructions for Pi and the Claude plugin.

- [ ] **Step 1: Tighten both Coach Skills**

In the lesson-design rule of each Coach Skill, add:

```text
For assessment, each problem Student View must stay neutral: state only the
current task and response requirement, without method names, capability
labels, recognition cues, domain reminders, transformation entries or other
answering hints.
```

- [ ] **Step 2: Tighten both Tutor Skills**

In the active-Block presentation rule of each Tutor Skill, add:

```text
Before an assessment first attempt, present only the exact current question
and a neutral request to answer. Do not announce the assessed capability or
method category, and do not repeat recognition cues, domain reminders or
Teacher Control checkpoints.
```

- [ ] **Step 3: Review the four-file diff**

Run:

```bash
git diff --check
git diff -- apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  plugins/highschool-study/skills/prepare-next-lesson/SKILL.md \
  plugins/highschool-study/skills/run-lesson/SKILL.md
```

Expected: only the two synchronized teaching rules change; no schema, tool or unrelated prose changes.

- [ ] **Step 4: Commit the Skill contract**

```bash
git add apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  plugins/highschool-study/skills/prepare-next-lesson/SKILL.md \
  plugins/highschool-study/skills/run-lesson/SKILL.md
git commit -m "fix: keep assessment first attempts neutral"
```

---

### Task 3: Run repository verification

**Files:**
- Verify only; no planned modifications.

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: acceptance evidence for the Web runtime and distributable plugin.

- [ ] **Step 1: Run the complete Pi Web check**

```bash
cd apps/pi-teaching-web
bun run check
```

Expected: TypeScript, unit tests and production build PASS.

- [ ] **Step 2: Run browser-sensitive E2E**

```bash
cd apps/pi-teaching-web
bun run test:e2e
```

Expected: all Playwright tests PASS.

- [ ] **Step 3: Run the plugin release check**

```bash
cd plugins/highschool-study
bun run release:check
```

Expected: all plugin tests and strict validation PASS with exactly four public MCP tools.

- [ ] **Step 4: Confirm final repository state**

```bash
git status --short --branch
git log -3 --oneline
```

Expected: no uncommitted implementation files; latest commits are the executable fix and synchronized Skill contract.
