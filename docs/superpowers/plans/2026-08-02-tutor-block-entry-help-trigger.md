# Tutor Block Entry and Help Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Tutor persist a pending Block as active before presenting it and honor the current Block's student-confirmed help trigger literally.

**Architecture:** Keep the M0 Runtime, Markdown schema, tools, and lifecycle unchanged. Tighten the existing Tutor Skill with two observable recipes, then validate the assembled resources and repeat the failed behavior in a fresh real-model Lesson Session.

**Tech Stack:** Markdown Agent Skill, Pi native Session, Bun tests, StudyForge M0 local web app.

## Global Constraints

- Modify no runtime or schema file.
- Add no projection, permission layer, tool, state machine, or persistent field.
- Do not add exact-wording tests for Skill prose; use existing resource assembly tests plus real-class behavior.
- Preserve all unrelated tracked and untracked user files.

---

### Task 1: Tighten Tutor Block entry and help conditions

**Files:**
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Test: existing `apps/pi-teaching-web/tests/m0/native-session.test.ts`
- Real validation: a copied M0 learning set and a fresh Pi Lesson Session under `/tmp`

**Interfaces:**
- Consumes: existing Lesson Block fields `Status`, `Student View`, `Teacher Control`, and `Classroom Log`.
- Produces: the same Skill interface; no new command, field, or runtime API.

- [x] **Step 1: Preserve the failing baseline**

Use the recorded real Lesson baseline at
`/tmp/studyforge-m0-acceptance-nyVrov/learning-set/lessons/lesson-001.md`:

- the first question was presented while `block-001` still said `Status: pending`;
- after the student said only “还没想清楚”, Tutor supplied
  `f(x)-1=e^u-1-au` and directed the student to `e^u-u-1` despite the confirmed
  “没说卡住之前不要提示” agreement.

This is the RED behavior. Do not add a brittle prose assertion to the test suite.

- [x] **Step 2: Add the minimal Block-entry recipe**

Replace the ambiguous “begin the first suitable pending Block” instruction with this
observable order:

```markdown
If no Block is active, enter the first suitable pending Block in this order: read its
`Uses`; make one narrow edit that changes only that Block from `pending` to `active`;
read the Lesson back; only then present its `Student View`. Do not combine this state
edit with a `Classroom Log` append. Writing "activated" in prose does not replace the
`Status` edit. Never activate a second Block while another is active.
```

- [x] **Step 3: Add the minimal help-trigger recipe**

Insert this conditional before the general hint ladder:

```markdown
Follow any help trigger agreed in the current Block literally. When the trigger is an
explicit request such as "卡住了" or "给我提示", unfinished thinking, uncertainty,
or “还没想清楚” is not a help request. Before the trigger, you may restate, clarify,
or judge only what the student already expressed; do not add a new equation,
transformation, method name, target relation, or route-selecting question. If intent
is unclear, ask whether the student wants more thinking time or a hint. A request to
judge one step permits judging that step, not advancing the unrequested solution.
```

Keep the existing graduated help rule for Blocks without a stricter agreement and for
turns after the agreed trigger occurs.

- [x] **Step 4: Inspect the assembled resource**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts
```

Expected: all native-session tests pass, including loading the M0 Tutor Skill and
canonical document contract.

- [x] **Step 5: Run the full static verification**

Run:

```bash
cd apps/pi-teaching-web
bun run check
```

Expected: typecheck, 30 unit/contract tests, and production build all pass.

- [x] **Step 6: Reproduce both cases in a fresh real Lesson Session**

Start a copied learning set with a new `PI_CODING_AGENT_DIR`, active `lesson-001`,
all Blocks reset to `pending`, and empty Classroom Logs. In the browser:

1. ask Tutor to start the Lesson and inspect `lesson-001.md` before replying;
2. verify `block-001` is already `active` while the first question is on screen;
3. submit the original style of response ending in “还没想清楚”; 
4. verify Tutor asks whether the student wants time or help, or only judges the
   student's stated route, without supplying the withheld equation or mother-function
   direction;
5. explicitly request a hint and verify a proportionate hint is then allowed;
6. complete the Block, verify `block-001: completed`, `block-002: active`, and reload
   the page to confirm the same route, Session, and active Block restore.

- [x] **Step 7: Commit the Skill change**

```bash
git add apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  docs/superpowers/plans/2026-08-02-tutor-block-entry-help-trigger.md
git commit -m "fix: honor tutor block entry and help triggers"
```
