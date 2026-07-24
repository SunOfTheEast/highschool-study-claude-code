# StudyForge repository guide

This repository contains two front ends over one Markdown-first learning domain:

- `plugins/highschool-study/` is the distributable Claude Code plugin.
- `apps/pi-teaching-web/` is the local Pi runtime and student web interface.
- `examples/derivative-demo/` is the public derivative learning set used for demos and acceptance tests.

The current user-facing feature reference is
`docs/zh-CN/完整说明书.md`. Historical designs, plans, and audits explain how a
feature was reached; they are not the current product contract.

## Source-of-truth hierarchy

1. `learning-set/ROADMAP.md`, `plans/`, `lessons/`, and confirmed `memory/`
   files are durable learning facts.
2. Problem cards and the method vocabulary live under `cards/` and `graph/`.
3. Active Trace is append-only Lesson evidence. A later event corrects an
   earlier one through `Supersedes`; ordinary search and projection ignore
   superseded events.
4. Pi Session JSONL is the raw conversation/tool history. It may explain how a
   fact was produced, but it is not a second learning-state database.
5. Summaries, planner attention, ability nodes, task lists, replay, and other
   UI views are projections. They must remain traceable to the facts above.

Do not add a database, background index, vector store, or unified
`study_context_get` unless the user explicitly changes this architecture.

## Runtime boundaries

### Claude Code plugin

The public plugin exposes exactly four MCP tools:

- `card_search`
- `trace_search`
- `trace_append`
- `source_resolve`

Keep this public tool surface narrow. Card search must return only real cards
and their complete active Trace history. Empty search results are a valid
authenticity fence; never compensate by inventing a card, path, source, or
session ID.

### Pi teaching runtime

The web runtime has two durable Agent roles:

- one Coach Session per Plan;
- one Tutor Session per started Lesson.

Coach prepares and reviews; Tutor teaches and records classroom facts. Their
histories are not copied into each other. They hand off through the Plan,
Lesson, active Trace, and source-linked summaries.

Pi write authority is Session-bound:

- Coach owns the current Plan and may use `lesson_prepare`, `plan_register`, and
  `plan_update`;
- Tutor owns the current Lesson and may use `trace_append`,
  `classroom_update`, `lesson_close`, and `card_alternative_append`;
- model-generated arguments must not select or override `ownerPath`,
  `lessonPath`, or a session ID.

Every Pi Session carries exactly one `studyforge.session-owner.v1` custom
entry containing `role`, `ownerId`, and `ownerPath`. A frontmatter Session ID
is reused only when all three fields match. Missing, malformed, duplicate, or
mismatched owner metadata creates a fresh Session; display names are not
identity.

A Coach-created Plan becomes available only after `plan_register` validates
the file and idempotently links it under `ROADMAP.md / Plan Graph`. A
`prepared` Lesson becomes `active` only after admission confirms its required
top-level sections, every used problem-card alias, and exactly one explicit
`Kind: reflection` Block. Admission failures do not change status or create a
Tutor Session.

Fact-writing tools return a minimal receipt with `ok: true` and `ownerPath`;
Trace writes also return `factId`, and closure returns `status: closed`.
Agents must not claim persistence from an error, empty result, or missing
success receipt. `LESSON_*` errors require Coach to repair the source rather
than Tutor search, guessing, substitution, or repeated calls.

One independently assessed response is one `problem` Block, and every problem
Block must bind exactly one authentic Lesson alias through `Uses`. If parts of
one card receive separate responses or judgments, separate Blocks reuse the
same alias; they must not share one Block. Pi `trace_append` accepts the
selected `blockId`, derives its card identity from the Session-owned Lesson,
and rejects a second parallel active Trace for that attempt. Completion,
correction, repeat, and method confirmation supersede its active Trace. The
public MCP remains explicit and may retain card-step Trace because it has no Pi
Session owner.

A prepared Lesson may be revised in place. Once it is active, paused, closed,
or abandoned, re-preparation creates a replacement Lesson and preserves the
old record. Its `plan_id` is immutable: another Plan cannot take over even a
still-prepared Lesson with the same ID. A completed Plan cannot prepare a
Lesson until an explicit `plan_update` reactivates or replans it.

Plan switching is student-owned UI navigation. When the current Plan is
completed, the frontend may list the other Roadmap Plans; it opens a target
Coach Session only after the student clicks that Plan. Agents do not select or
silently switch the active Plan.

Normal Pi preparation uses the transient `lesson_prepare` Blueprint contract.
The runtime binds the Plan, paths, initial statuses, relative aliases, and Plan
Lesson Index; the compiled Lesson Markdown remains the only durable source.
Do not add a persistent Blueprint file or a fifth public MCP tool.

`plan_update` accepts only `decision`, `currentPosition`,
`nextLessonCandidate`, and `planSummary`. On every Plan audit, the runtime
reconstructs Lesson Index from the real same-Plan Lesson files, preserves the
existing linked order, appends missing Lessons, and synchronizes the matching
Roadmap Plan Graph status. Model-authored text never owns these structural
links or status projections.

## Teaching authority map

Do not maintain a second full teaching protocol in this repository guide.
Operational authorities are:

- Pi Tutor judgment and classroom event triggers:
  `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`.
- Pi Coach evidence, preparation, source, and Plan decisions:
  `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`.
- Claude plugin classroom evidence meaning:
  `plugins/highschool-study/skills/run-lesson/references/evidence-protocol.md`.
- Claude plugin reveal and template semantics:
  `plugins/highschool-study/skills/prepare-next-lesson/references/`.
- Tool purpose, call timing, local fields, scope, and immediate result:
  the corresponding TypeBox or Zod tool definition.
- Session identity, authenticity, state transitions, atomicity, uniqueness,
  projection refresh, and persistent facts: runtime code and executable tests.
- Current user-facing behavior: `docs/zh-CN/完整说明书.md`.

The two runtimes may express the same teaching judgment in different files
because their tool surfaces differ. When changing a shared teaching rule,
update both semantic owners together, but do not copy their tool signatures
or runtime error branches into Skills, Agent prompts, or this guide.

## Student-view and workflow invariants

- Default message projection is `safe`. Mixed tool-call text and arguments are
  replaced by structured status; raw Pi JSONL remains untouched.
- `raw-stream` is a local diagnostic option, not the student default.
- Student View never reveals Teacher Control, card answers, rubric text,
  unrevealed hints, private evidence matrices, or stored alternative
  solutions.
- Deep workflow is optional and Session-scoped. One read-only Evidence Scout
  may isolate a Plan-scale or cross-card retrieval question from the parent
  context. Multiple workflow tasks require genuinely independent questions
  that can change the next teaching action. Parent Agents remain the only
  writers of learning facts.
- Child raw JSON and artifacts stay private to the parent runtime. The UI may
  project goal, dependencies, progress, budgets, and source counts, not child
  conclusions.

## Repository map

- `plugins/highschool-study/server/src/`: shared card, Trace, source, method,
  alternative, and projection domain logic.
- `plugins/highschool-study/skills/`: Claude Code learning workflows.
- `apps/pi-teaching-web/src/runtime/`: Session ownership and role-scoped tools.
- `apps/pi-teaching-web/src/study/`: Markdown workspace reads, writes, replay,
  routes, and ability projection.
- `apps/pi-teaching-web/src/projection/`: safe/raw message and workflow views.
- `apps/pi-teaching-web/resources/`: Pi Coach/Tutor prompts and Skills.
- `docs/zh-CN/完整说明书.md`: current functional reference.
- `docs/audits/`: evidence for completed acceptance runs.
- `docs/superpowers/specs/` and `docs/superpowers/plans/`: historical design
  and implementation records.

## Change discipline

- Prefer the smallest change that preserves the Markdown-first architecture.
- Do not add compatibility layers, rule engines, new persistent fields, extra
  Agents, or defensive infrastructure without an explicit requirement.
- When changing a teaching rule shared by both runtimes, update the Pi Skill
  and public plugin Skill together. Do not test Skill or Agent prose, exact
  phrases, headings, or word lists; test only executable schemas, tools,
  permissions, persistence, projections, and runtime behavior.
- When changing a persistent schema or tool contract, first inspect the
  relevant schema design and every reader, writer, projection, fixture, and
  source link.
- Run real-model or mutation-heavy acceptance only on a copied learning set,
  never directly against `examples/derivative-demo/learning-set`.
- Never commit credentials, provider tokens, local Pi Session files,
  `CLAUDE.local.md`, or generated private classroom transcripts.
- Preserve unrelated dirty files and existing user changes.

## Verification

Run the suites that cover the changed surface:

```bash
cd plugins/highschool-study
bun install --frozen-lockfile
bun run release:check
```

```bash
cd apps/pi-teaching-web
bun install --frozen-lockfile
bun run check
bun run test:e2e
```

`release:check` must keep the public MCP tool count at four and pass strict
Claude plugin validation. `check` must pass type checking, unit tests, and the
production build. Browser-sensitive routing, replay, ability refresh, and
student-view changes also require Playwright E2E.
