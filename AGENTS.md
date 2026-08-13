# StudyForge repository guide

`apps/pi-teaching-web/` is the only current StudyForge runtime and local student App.
`examples/derivative-m0/` is its public smoke learning set. The current source, tests,
student help, and this guide are authoritative; removed historical design notes remain
available only through Git history.

## Durable domain

The current learning set has an optional Markdown course tree, one Markdown teacher-memory network, two
student-owned asset families, revisioned source material, and independent semantic tags:

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

notes/*.note.yaml
cards/m1b/*.card.yaml
activity/problem-attempts/*.md

materials/<material-id>/
├── manifest.yaml
└── revisions/<revision>/original.*

semantics/assets/<kind>/<asset-id>.tags.yaml
```

`ROADMAP.md` and the course tree are optional. A genuinely blank learning set may contain
only `LEARNING_GUIDE.md` and `memory/INDEX.md`. `LEARNING_GUIDE.md` supplies
learning-set-specific teaching principles. Existing `cards/` and `graph/` remain
supported source assets; legacy loose files under `materials/` remain readable but are not
silently treated as fixed sources. Native Pi Session JSONL stores node, free-learning, and
Meta conversations.

Canonical learning facts and assets remain Markdown/YAML; native Pi JSONL is the sole raw
conversation record. M1 memory is a routed teacher notebook: L0
`memory/INDEX.md`, L1 object/capability/preference judgments, and L2 source Lesson
evidence or source free-learning Session. Do not add a global event-summary pool, derived mastery state, handoff documents,
database, vector store, background consolidation service, or unified context compiler
without new repeated real-course evidence and explicit user approval.

`studyforge.semantic-tags.v1` and `studyforge.material.v1` are the only M1c durable
schemas. Asset content revisions and Material revisions are immutable sources once
superseded. `semantics/indexes/`, tag-neighbor relations, reverse-source links, and the
student learning footprint are disposable projections of canonical files and native
Session facts; they are never independent logs or graphs.

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
- A Note owns ordered Markdown/recall blocks and revisioned student-editable content.
- A problem card owns one canonical stem, answer, private teaching rationale, and student
  note. Attempts and answer reveals append to a separate activity file; they never imply
  correctness or mastery.
- Note and problem-card semantic tags live in an independently revisioned sidecar. Flat
  `core` and `related` terms aid recall and derived relations but never state mastery.
- An asset source pins an exact asset revision or an exact Material revision and locator.
  Old unpinned M1b sources remain visible as legacy facts and are never guessed forward.

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

Free learning uses independent `free:<session-id>` Pi Sessions. It may start with no
context or with explicitly selected Note/problem-card handles or Material locators, allows multiple live
threads, and ends only on the student's explicit action. It creates no Light Lesson,
Classroom Log, Trace, or mandatory Summary. Ending a thread is lifecycle only and does
not force memory consolidation.

Long-term planning starts in an independent root `meta:<session-id>` Pi Session. Meta may
read compact memory and explicitly selected context, but its sole write is
`create_roadmap` after the student sees and explicitly accepts a complete Roadmap-level
proposal. It creates only `ROADMAP.md`; the Roadmap Session owns diagnosis and the first
Plan. Refusing a long-term path creates nothing and does not affect free learning.

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
4. shared subject-neutral teaching principles;
5. the node-role prompt;
6. shared default teacher presence and public-expression translation;
7. an optional selected persona overlay;
8. current node identity/path instructions;
9. the role's Skills.

Shared teacher agency has one semantic owner:
`apps/pi-teaching-web/resources/teaching/teaching-core.md`. Role prompts apply it
only at decisions specific to Roadmap, Plan, or Lesson. Optional files under
`apps/pi-teaching-web/resources/personas/` change expression, rhythm, humour, and
metaphor only; they never override subject truth, role authority, learning-set principles,
or student agency. `STUDY_PERSONA=<id>` selects one overlay for all three student-facing
node Sessions. The internal material Scout receives no persona or user-facing role-play.

Default student-facing expression has one separate semantic owner:
`apps/pi-teaching-web/resources/teaching/teacher-presence.md`. It is loaded after the
node-role prompt for Roadmap, Plan, and Lesson, including when no persona is selected.
It translates internal teaching judgments into concrete classroom language without
changing the judgment or adding another model pass.

Roadmap keeps the native `read`, `grep`, `find`, `ls`, `edit`, and `write` tools. Plan
keeps those tools and additionally has `subagent` for fresh-context copies of one
packaged read-only `study-material-scout`. Runtime allows Plan content edits but blocks
native `edit/write` from changing the bound `PLAN.md` lifecycle status; only the
scope-bound `finish_plan` tool can complete it. Lesson has the native file tools plus the
node-bound `classroom_log_append`, `classroom_update`, and conditional
`lesson_memory_commit`, plus student-approved `save_note` and `save_problem_card` tools.
Its native `edit/write` calls are Runtime-blocked; Tutor cannot
write `capabilities/`, parent nodes, sibling Lessons, or memory Markdown directly. This
is a mechanical boundary, not a prompt convention.

Free learning keeps native read-only file discovery plus `save_note`,
`save_problem_card`, and conditional `free_learning_memory_commit`. Asset tools require
the student's visible, explicit approval. The memory tool appends a meaningful cognitive
change directly from the whole native Session; asset existence, answer reveal, and teacher
explanation are never learning evidence by themselves.

Plan can use `save_prepared_problem_card` only after a prepared Lesson is already
deliverable and the student separately approves the fully shown card. Saving a card is
not implied by approving a Lesson. Meta has read/grep plus only `create_roadmap`.

The Coach derives temporary material slots from the agreed Lesson activities and normally
launches one Scout per slot, with at most three running concurrently. Each Scout uses
canonical feature fields and free text to recall a small shallow candidate set, reads
only metadata and the stem, and reports the feature slice it matched and inspected. The
parent chooses a primary, fully reads it, and owns every mathematical, route-level,
teaching-fit, and persistence decision. Scouts cannot write teaching facts. Roadmap and
Lesson Sessions do not receive `subagent`. Node activation is a direct student UI action
handled by Runtime. Plan and Lesson completion begins with the student's UI action,
continues through the current Teacher Session's semantic closure, and ends only when that
Session calls its scope-bound, argument-free `finish_plan` or `finish_lesson` tool. Runtime
then performs only the mechanical transition. Do not infer confirmation with text matching
or let the UI bypass semantic closure.

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
- Open-ended free learning, student-approved asset saving, and direct object-memory
  updates: `apps/pi-teaching-web/resources/skills/free-learning/SKILL.md`
- Root long-term-path discussion and student-approved Roadmap creation:
  `apps/pi-teaching-web/resources/skills/meta-dialogue/SKILL.md`
- Shared subject-neutral teaching judgment:
  `apps/pi-teaching-web/resources/teaching/teaching-core.md`
- On-demand mathematics judgment for Free Learning and live Lessons:
  `apps/pi-teaching-web/resources/skills/references/subject-methods/mathematics.md`

Skills own teaching judgment and natural language. Runtime owns document parsing,
Session identity, lifecycle transitions, transport, persistence, L0 injection, and
Lesson write boundaries. Skill tests should assert observable structure and ownership,
not full-prose snapshots; real classes remain the behavioral gate.
The Material Scout is disposable working memory for asset search, not a Handoff,
teaching-fact store, planner, or post-Lesson reviewer. The parent Plan Coach keeps final
selection and every persistent write. StudyForge sets no wall-clock deadline for a
Scout fan-out, does not retry a failed fan-out automatically, and does not fall back to
parent-side bulk asset search.

Visual Material fallback is a separate one-shot worker, not a Pi Session or a
Plan-callable subagent. Its sole prompt owner is
`apps/pi-teaching-web/resources/workers/study-material-vision-reader.md`; it receives
only the current task and selected page images, has no tools or student memory, and
returns structured page evidence. Native PDF text remains first. In automatic mode an
authenticated `openai-codex` teacher may route this bounded read to an available
image-capable `gpt-5.6-luna` at low reasoning, otherwise the image-capable teacher is
used; explicit visual-model selection always wins. Do not scan unrelated Providers or
turn this worker into another classroom Agent.

## App surface

Primary views are Home, Learning Assets, and Course only when a Roadmap exists.

- Home, free-learning, Meta, and footprint routes: `/home`, `/learn/:sessionId`,
  `/meta/:sessionId`, `/footprint`.
- Asset routes: `/assets`, `/assets/notes/:id`,
  `/assets/problem-cards/:id`, `/assets/materials/:id`.
- Optional Course routes: `/course`, `/course/plan/:id`,
  `/course/plan/:id/lesson/:id`.
- `/knowledge` is a supported local semantic-relation view, reached from Learning Assets
  rather than primary navigation. It derives a deterministic capped neighborhood from
  existing asset tags and source relations; it is not a canonical graph or write surface.
- API additionally exposes home, free-learning and Meta creation, Material import/read,
  fixed locators, semantic tag/query/relations, the derived footprint, asset editing,
  problem attempts, answer reveal, and problem-card-to-teacher handoff.
- WebSocket `/events` transports raw conversation items, tool activity, run
  state, errors, and invalidations.

Assistant text is rendered unchanged through the shared Markdown/KaTeX path. Generic
tool calls become safe human receipts without raw arguments or results; Material Scout,
Lesson Reviewer, and printable-handout work retain dedicated progress projections. The
normal Lesson view shows `Student View` and Block progress, not `Teacher Control`.

## Repository map

- `apps/pi-teaching-web/src/study/`: strict Markdown, asset, memory, and semantic readers.
- `apps/pi-teaching-web/src/runtime/`: node ownership, resource assembly, Session
  registry, frontmatter edits, and lifecycle.
- `apps/pi-teaching-web/resources/subagents/`: packaged read-only asset Scout used only
  by Plan Sessions.
- `apps/pi-teaching-web/resources/workers/`: packaged one-shot non-Session workers such
  as visual page reading.
- `apps/pi-teaching-web/resources/personas/`: optional expression overlays shared by
  Roadmap, Plan, and Lesson Sessions.
- `apps/pi-teaching-web/src/server/`: minimal HTTP/WebSocket transport.
- `apps/pi-teaching-web/src/client/`: Home/Assets/Free Learning/optional Course App.
- `apps/pi-teaching-web/tests/m0/`: preserved M0 kernel regressions.
- `apps/pi-teaching-web/tests/m1/`: memory, routing, and retired-surface contracts.
- `apps/pi-teaching-web/tests/e2e/m0-cycle.spec.ts`: deterministic browser closure.
- `apps/pi-teaching-web/tests/e2e/m1b-cycle.spec.ts`: deterministic blank-set growth and
  reuse closure.
- `apps/pi-teaching-web/tests/e2e/m1c-cycle.spec.ts`: deterministic Material → free
  learning → asset → Meta → Roadmap → footprint closure.
- `apps/pi-teaching-web/tests/e2e/m1d-ui.spec.ts`: desktop student-interface, asset,
  local-relation, and three-paper course-workspace acceptance.
- `apps/pi-teaching-web/tests/source-first/`: PDF, outline, page-reading, source-tree,
  visual-worker, context-boundary, and source-label contracts.
- `apps/pi-teaching-web/tests/e2e/source-first-book.spec.ts`: deterministic book import,
  outline, reading, source-bound discussion, and asset-growth closure.
- `apps/pi-teaching-web/tests/e2e/desktop-onboarding.spec.ts`: desktop first-run and
  model-setup closure.
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
bun run test:e2e
```
