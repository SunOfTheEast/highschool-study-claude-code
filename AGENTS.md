# StudyForge M1 repository guide

`apps/pi-teaching-web/` is the only current StudyForge runtime and local student App.
`examples/derivative-m0/` is its public smoke learning set. Dated specifications and
audits may describe earlier designs, but they are history rather than supported runtime
surfaces.

## Durable domain

M1 has one Markdown control tree plus one Markdown teacher-memory network:

```text
ROADMAP.md
└── plans/<plan-id>/
    ├── PLAN.md
    └── lessons/<lesson-id>.md
        └── Block Classroom Logs

memory/
├── INDEX.md
├── indexes/
├── objects/
├── capabilities/
└── preferences/
```

`LEARNING_GUIDE.md` supplies learning-set-specific teaching principles. `cards/`,
`graph/`, and `materials/` are static source assets. Pi Session JSONL stores each
node's raw conversation and native tool history.

Markdown is the only durable truth. M1 memory is a routed teacher notebook: L0
`memory/INDEX.md`, L1 object/capability/preference judgments, and L2 source Lesson
evidence. Do not add a global event-summary pool, derived mastery state, handoff documents,
database, vector store, background consolidation service, or unified context compiler
without new repeated real-course evidence and explicit user approval.

## Document contracts

- Roadmap is always `active` and owns long-term goal, observable capability standard,
  direct test, Plan Tree, and current position.
- Plan states are `prepared → active → completed`. A Plan owns its stage goal,
  observable standard, test, Lesson Tree, current position, and next arrangement.
- Lesson states are `prepared → active → closed`. A Lesson owns one goal and one or
  more Blocks.
- A Block owns `Node State`, public `Student View`, private `Teacher Control`, and an
  append-only-in-spirit `Classroom Log`.
- A Lesson contains only its goal and Blocks. Classroom Logs and object Learning History
  entries are append-only facts.
- Object, capability, and preference current judgments may change, but their evolution
  overview, timeline, and source links must preserve how the judgment changed.
- Child status comes only from child frontmatter. Parent prose is not a status cache.
- Legacy Lesson sections are rejected by the parser rather than adapted.

Parents start from consolidated Markdown memory and drill into child evidence only for
missing, conflicting, or high-impact details. Roadmap may arrange future prepared Plans.
Plan may create or edit only prepared Lessons. Lesson writes its own Block state,
classroom log, Tutor-owned object/preference memory, and affected routes.
Earlier active or terminal child documents remain historical facts.

## Sessions and lifecycle

Every Roadmap, Plan, and Lesson has one node-owned native Pi Session. Plan IDs are
Roadmap-global; Lesson IDs are local to their parent Plan, so a Lesson Session key is
`lesson:<plan-id>:<lesson-id>`. Ownership is
`nodeKind + nodeId + nodePath + parentId + parentPath`; display labels do not identify
a Session. Parent and sibling transcripts are never copied into a new node Session.

A long Plan Session uses Pi's native compaction only at a semantic boundary: the
settled turn successfully edited or wrote `plans/*/lessons/*.md`, and active context usage is
at least 200,000 tokens. The compaction summary is a working Session index, not a
teaching fact or Handoff. Markdown remains authoritative, the parent rereads original
documents when detail matters, and the append-only Pi JSONL keeps the raw history.
Roadmap and Lesson Sessions do not use this StudyForge threshold.

The model receives only:

1. the canonical document and M1 memory contracts;
2. `LEARNING_GUIDE.md`;
3. the compact `memory/INDEX.md` L0 route when it exists;
4. shared mathematics teaching principles;
5. the node-role prompt;
6. shared default teacher presence and public-expression translation;
7. an optional selected persona overlay;
8. current node identity/path instructions;
9. the role's Skills.

Shared teacher agency has one semantic owner:
`apps/pi-teaching-web/resources/teaching/math-teaching-core.md`. Role prompts apply it
only at decisions specific to Roadmap, Plan, or Lesson. Optional files under
`apps/pi-teaching-web/resources/personas/` change expression, rhythm, humour, and
metaphor only; they never override mathematics, role authority, learning-set principles,
or student agency. `STUDY_PERSONA=<id>` selects one overlay for all three student-facing
node Sessions. The internal material Scout receives no persona or user-facing role-play.

Default student-facing expression has one separate semantic owner:
`apps/pi-teaching-web/resources/teaching/teacher-presence.md`. It is loaded after the
node-role prompt for Roadmap, Plan, and Lesson, including when no persona is selected.
It translates internal teaching judgments into concrete classroom language without
changing the judgment or adding another model pass.

Roadmap keeps the native `read`, `grep`, `find`, `ls`, `edit`, and `write` tools. Plan
keeps those tools and additionally has `subagent` for fresh-context copies of one
packaged read-only `study-material-scout`. Lesson has the native file tools plus the
node-bound `classroom_log_append`, `classroom_update`, and conditional
`lesson_memory_commit`. Its native `edit/write` calls are Runtime-blocked; Tutor cannot
write `capabilities/`, parent nodes, sibling Lessons, or memory Markdown directly. This
is a mechanical boundary, not a prompt convention.

The Coach derives temporary material slots from the agreed Lesson activities and normally
launches one Scout per slot, with at most three running concurrently. Each Scout uses
canonical feature fields and free text to recall a small shallow candidate set, reads
only metadata and the stem, and reports the feature slice it matched and inspected. The
parent chooses a primary, fully reads it, and owns every mathematical, route-level,
teaching-fit, and persistence decision. Scouts cannot write teaching facts. Roadmap and
Lesson Sessions do not receive `subagent`. Node activation and completion are student UI
actions handled by Runtime code. Do not replace these actions with prompt conventions or
model tool calls.

## Teaching behavior owners

- Roadmap introduction, long-horizon diagnosis, and student-approved Plan design:
  `apps/pi-teaching-web/resources/skills/roadmap-dialogue/SKILL.md`
- Materializing a student-approved Plan:
  `apps/pi-teaching-web/resources/skills/prepare-approved-plan/SKILL.md`
- Plan-stage interpretation, memory-first post-Lesson review, and
  student-approved next-Lesson design:
  `apps/pi-teaching-web/resources/skills/plan-dialogue/SKILL.md`
- Materializing a student-approved Lesson:
  `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/SKILL.md`
- Shared Plan-cycle archetype references:
  `apps/pi-teaching-web/resources/skills/references/plan-cycles/`
- Live Block teaching, logging, on-demand recall, and end-of-Lesson consolidation:
  `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Shared mathematics judgment:
  `apps/pi-teaching-web/resources/teaching/math-teaching-core.md`

Skills own teaching judgment and natural language. Runtime owns document parsing,
Session identity, lifecycle transitions, transport, persistence, L0 injection, and
Lesson write boundaries. Skill tests should assert observable structure and ownership,
not full-prose snapshots; real classes remain the behavioral gate.
The Material Scout is disposable working memory for asset search, not a Handoff,
teaching-fact store, planner, or post-Lesson reviewer. The parent Plan Coach keeps final
selection and every persistent write. StudyForge sets no wall-clock deadline for a
Scout fan-out, does not retry a failed fan-out automatically, and does not fall back to
parent-side bulk asset search.

## App surface

The only primary views are Course and Knowledge.

- Course routes: `/course`, `/course/plan/:id`,
  `/course/plan/:id/lesson/:id`.
- Knowledge route: `/knowledge`.
- API: health, course snapshot, static knowledge snapshot, node history/message,
  Plan lifecycle actions, and Plan-scoped Lesson lifecycle actions.
- WebSocket `/events` transports raw conversation items, tool activity, run
  state, errors, and invalidations.

Assistant text is rendered unchanged. Tool calls are separate collapsed activity
items. The normal Lesson view shows `Student View` and Block progress, not
`Teacher Control`.

## Repository map

- `apps/pi-teaching-web/src/study/`: strict Markdown and static knowledge readers.
- `apps/pi-teaching-web/src/runtime/`: node ownership, resource assembly, Session
  registry, frontmatter edits, and lifecycle.
- `apps/pi-teaching-web/resources/subagents/`: packaged read-only asset Scout used only
  by Plan Sessions.
- `apps/pi-teaching-web/resources/personas/`: optional expression overlays shared by
  Roadmap, Plan, and Lesson Sessions.
- `apps/pi-teaching-web/src/server/`: minimal HTTP/WebSocket transport.
- `apps/pi-teaching-web/src/client/`: Course/Knowledge App.
- `apps/pi-teaching-web/tests/m0/`: preserved M0 kernel regressions.
- `apps/pi-teaching-web/tests/m1/`: memory, routing, and retired-surface contracts.
- `apps/pi-teaching-web/tests/e2e/m0-cycle.spec.ts`: deterministic browser closure.
- `examples/derivative-m0/`: clean public learning set.

## Change discipline

- Prefer deletion to compatibility shims when an old surface has no current consumer.
- The retired plugin has no migration, compatibility, or double-write path. Do not
  recreate it as an adapter around the Pi App.
- Preserve unrelated user changes and never commit credentials or local Session files.
- Test mutations on copied learning sets.
- Add a new persistent mechanism only after the direct-document design fails repeatedly
  in real Lessons and the original Block records identify the limitation.
- Keep UI lifecycle student-owned and keep dialogue visually dominant.

## Verification

```bash
cd apps/pi-teaching-web
bun install --frozen-lockfile
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```
