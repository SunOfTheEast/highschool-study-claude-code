# Assessment No-Spoiler Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent assessment preparation announcements and future classroom Blocks from revealing problem content before the Tutor activates them.

**Architecture:** Keep complete content in the existing Lesson Markdown. Add a template-aware student projection in `read-workspace.ts`, then shape Coach completion announcements through the two preparation Skills. No persistent schema or tool contract changes.

**Tech Stack:** TypeScript, Bun test, React student notebook, Markdown Skills.

## Global Constraints

- Apply strict hiding only when `Primary template` is `assessment`.
- Do not modify persistent Lesson or Trace schemas.
- Do not add a semantic output filter or another Agent.
- Do not add tests for exact Skill prose.
- Keep authoring source and non-assessment previews unchanged.

---

### Task 1: Hide future assessment Student Views

**Files:**
- Modify: `apps/pi-teaching-web/tests/study/read-workspace.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/student-notebook.test.ts`
- Modify: `apps/pi-teaching-web/src/study/read-workspace.ts`

**Interfaces:**
- Consumes: Existing Lesson `## Lesson Configuration / Primary template`, Lesson status, and Block status.
- Produces: `readPlanWorkspace(root, planId)` with template-aware `ActivityBlock.studentView` projection.

- [ ] **Step 1: Write failing projection tests**

Change the prepared assessment assertion to:

```ts
expect(workspace.lessons[2]?.blocks.map((block) => block.studentView))
  .toEqual(['', '', '', '', '']);
```

Add notebook cases that activate one Block and assert that only active/completed
Student Views are present, then change the template to `deliberate-practice`
and assert that Pending Student Views remain present.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
bun test tests/study/read-workspace.test.ts tests/study/student-notebook.test.ts
```

Expected: the prepared assessment assertion fails because current code returns
the Pending Block text.

- [ ] **Step 3: Implement the minimal projection**

Parse the existing template line and project Block text:

```ts
function lessonTemplate(body: string): string | null {
  return /^- Primary template:\s*`?([^`\n]+)`?\s*$/m
    .exec(section(body, 'Lesson Configuration'))?.[1]?.trim() ?? null;
}

function studentViewFor(
  template: string | null,
  lessonStatus: LessonStatus,
  blockStatus: BlockStatus,
  value: string,
): string {
  if (template !== 'assessment' || lessonStatus === 'closed') return value;
  return blockStatus === 'active' || blockStatus === 'completed' ? value : '';
}
```

Pass the parsed Lesson status and template into `lessonBlocks` and apply
`studentViewFor` to each Block.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
bun test tests/study/read-workspace.test.ts tests/study/student-notebook.test.ts
```

Expected: all focused tests pass.

### Task 2: Shape assessment preparation announcements

**Files:**
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`

**Interfaces:**
- Consumes: The already selected `primaryTemplate` and problem Block count.
- Produces: A readiness-only student announcement for assessment; existing behavior for other templates.

- [ ] **Step 1: Add the Pi Coach output contract**

Extend the successful preparation rule with:

```markdown
When `primaryTemplate` is `assessment`, the student announcement contains only
readiness and the number of problem Blocks, for example: “考察课已备好，共两道题。
准备好就可以开始。” Keep its stems, formulas, problem types, methods,
recognition targets, traps and card IDs inside the Lesson until Tutor activates
the corresponding Block. Other templates may summarize their activity roles.
```

- [ ] **Step 2: Mirror the contract in the Claude plugin Skill**

Add the same conditional output shape after the Lesson reread requirement in
`prepare-next-lesson/SKILL.md`.

- [ ] **Step 3: Verify the complete Pi surface**

Run:

```bash
bun run check
```

Expected: typecheck passes, every Bun test passes, and the production build
finishes successfully.

