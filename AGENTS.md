# StudyForge M0 repository guide

`apps/studyforge/` is the current StudyForge M0 runtime and local student App.
`examples/math-starter-m0/` is the public cardless starter and the default demo.
`examples/derivative-m0/` is the private beta evaluation corpus. It is not licensed for
public redistribution and must be removed or replaced before a clean public export.
The old Claude Code plugin and historical documents remain for comparison; they are
not M0 dependencies or current runtime contracts.

## Agent-assisted setup contract

Work from the repository root. Install only dependencies declared by the repository;
do not install unrelated global packages or alter global Pi configuration without the
user's approval.

```bash
bun install --frozen-lockfile
bun run doctor
bun run start:demo
```

The default selects `examples/math-starter-m0/`. The private beta corpus is never an
implicit default; selecting it requires this explicit command:

```bash
STUDY_LEARNING_SET=examples/derivative-m0/learning-set bun run start:demo
```

Interpret the seven Doctor checks literally:

- `platform`: macOS and Linux are validated; another platform is a warning.
- `bun`: Bun 1.3.0 or newer is required.
- `app`: `apps/studyforge/package.json` must exist.
- `learning-set`: the required Markdown and every static asset that is present passed
  strict parsing; missing or empty optional slices are valid.
- `write`: the selected Learning Set can persist local course state.
- `model`: Pi reports at least one already configured model provider.
- `port`: the selected loopback port is valid and free.

If `model` fails, guide the user through Pi's own OAuth or API-key setup. Never read,
print, copy, or infer credential values or authentication-file paths. After starting,
verify `http://127.0.0.1:65000/api/health`; do not expose the service beyond loopback.

## Durable domain

The minimum Learning Set is a writable root containing exactly the two required
Markdown entry points; Plan directories may appear later after student agreement:

```text
LEARNING_GUIDE.md
ROADMAP.md
└── plans/<plan-id>/
    ├── PLAN.md
    └── lessons/<lesson-id>.md
        └── Block Classroom Logs
```

`LEARNING_GUIDE.md` supplies learning-set-specific teaching principles. `graph/`,
`cards/`, and `materials/` are independent optional static-asset slices: missing or
empty returns an empty slice, while present-invalid content must fail strict parsing.
Static assets can accelerate browsing and preparation but do not define the course
model. Pi Session JSONL stores each node's raw conversation and native tool history.

There is no second teaching-fact store. Do not add a memory pool, classroom-event
objects, derived mastery state, handoff documents, background index, vector store, or
unified context service without new repeated real-course evidence and explicit user
approval.

## Document contracts

- Roadmap is always `active` and owns long-term goal, observable capability standard,
  direct test, Plan Tree, and current position.
- Plan states are `prepared → active → completed`. A Plan owns its stage goal,
  observable standard, test, Lesson Tree, current position, and next arrangement.
- Lesson states are `prepared → active → closed`. A Lesson owns one goal and one or
  more Blocks.
- A Block owns `Node State`, public `Student View`, private `Teacher Control`, and an
  append-only-in-spirit `Classroom Log`.
- Child status comes only from child frontmatter. Parent prose is not a status cache.
- Legacy Lesson sections are rejected by the parser rather than adapted.

Parents read child Markdown directly when history matters. Roadmap may arrange future
prepared Plans. Plan may create or edit only prepared Lessons. Lesson writes its own
Block state and classroom log. Earlier active or terminal child documents remain
historical facts.

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

1. the canonical document contract;
2. `LEARNING_GUIDE.md`;
3. shared mathematics teaching principles;
4. the node-role prompt;
5. an optional selected persona overlay;
6. current node identity/path instructions;
7. the role's Skills.

Shared teacher agency has one semantic owner:
`apps/studyforge/resources/teaching/math-teaching-core.md`. Role prompts apply it
only at decisions specific to Roadmap, Plan, or Lesson. Optional files under
`apps/studyforge/resources/personas/` change expression, rhythm, humour, and
metaphor only; they never override mathematics, role authority, learning-set principles,
or student agency. `STUDY_PERSONA=<id>` selects one overlay for all three student-facing
node Sessions. The internal Material Scout and Lesson Reviewer receive no persona or
user-facing role-play.

Roadmap keeps the native `read`, `grep`, `find`, `ls`, `edit`, and `write` tools. Plan
keeps those tools and additionally has `subagent` for fresh-context copies of one
packaged read-only `study-material-scout`. Lesson has native `read`, `grep`, `find`,
and `ls`, plus the node-bound `classroom_log_append` and `classroom_update`; it does
not receive native `edit/write`. The Coach derives temporary material slots from the
agreed Lesson activities and normally launches one Scout per slot, with at most three
running concurrently. Each Scout uses canonical feature fields and free text to recall
a small shallow candidate set, reads only metadata and the stem, and reports the feature
slice it matched and inspected. The parent chooses a primary, fully reads it, and owns
every mathematical, route-level, teaching-fit, and persistence decision. A one-problem
Lesson may need one card; a multi-problem Lesson may need several. Scouts use only
`read`, `grep`, `find`, and `ls`; they cannot write teaching facts. Roadmap and Lesson
Sessions do not receive `subagent`. Node activation
and completion are student UI actions handled by Runtime code. Do not replace these
actions with prompt conventions or model tool calls.

## Teaching behavior owners

- Roadmap introduction, long-horizon diagnosis, and student-approved Plan design:
  `apps/studyforge/resources/skills/roadmap-dialogue/SKILL.md`
- Materializing a student-approved Plan:
  `apps/studyforge/resources/skills/prepare-approved-plan/SKILL.md`
- Plan-stage interpretation, direct child reading, post-Lesson review, and
  student-approved next-Lesson design:
  `apps/studyforge/resources/skills/plan-dialogue/SKILL.md`
- Materializing a student-approved Lesson:
  `apps/studyforge/resources/skills/prepare-approved-lesson/SKILL.md`
- Shared Plan-cycle archetype references:
  `apps/studyforge/resources/skills/references/plan-cycles/`
- Live Block teaching and logging:
  `apps/studyforge/resources/skills/tutor-lesson/SKILL.md`
- Shared mathematics judgment:
  `apps/studyforge/resources/teaching/math-teaching-core.md`

Skills own teaching judgment and natural language. Runtime owns document parsing,
Session identity, lifecycle transitions, transport, and persistence. Do not add exact-
wording tests for Skill prose; validate assembled resources plus real class behavior.
The Material Scout is disposable working memory for asset search, not a Handoff,
teaching-fact store, planner, or post-Lesson reviewer. The parent Plan Coach keeps final
selection and every persistent write. StudyForge sets no wall-clock deadline for a
Scout fan-out, does not retry a failed fan-out automatically, and does not fall back to
parent-side bulk asset search. The Lesson Reviewer is a separate bounded risk check for
prepared material; it does not choose the lesson or write teaching facts.

## App surface

The only primary views are Course and Knowledge.

Course, Session, and Lesson behavior does not depend on Knowledge contents. With all
three optional slices missing or empty, Knowledge renders its stable empty state.

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

- `apps/studyforge/src/study/`: strict M0 Markdown and static knowledge readers.
- `apps/studyforge/src/runtime/`: node ownership, resource assembly, Session
  registry, frontmatter edits, and lifecycle.
- `apps/studyforge/resources/subagents/`: packaged read-only asset Scout used only
  by Plan Sessions.
- `apps/studyforge/resources/personas/`: optional expression overlays shared by
  Roadmap, Plan, and Lesson Sessions.
- `apps/studyforge/src/server/`: minimal HTTP/WebSocket transport.
- `apps/studyforge/src/client/`: Course/Knowledge App.
- `apps/studyforge/tests/m0/`: current executable contract.
- `apps/studyforge/tests/e2e/m0-cycle.spec.ts`: deterministic browser closure.
- `examples/math-starter-m0/`: public cardless default Learning Set.
- `examples/derivative-m0/`: private beta evaluation corpus; not a public example.

## Change discipline

- Prefer deletion to compatibility shims when an old surface has no M0 consumer.
- Preserve unrelated user changes and never commit credentials or local Session files.
- Test mutations on copied learning sets.
- Add a new persistent mechanism only after the direct-document design fails repeatedly
  in real Lessons and the original Block records identify the limitation.
- Keep UI lifecycle student-owned and keep dialogue visually dominant.

## Verification

```bash
bun install --frozen-lockfile
bun run check
bun run test:e2e
```
