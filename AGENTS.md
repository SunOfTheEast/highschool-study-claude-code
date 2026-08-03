# StudyForge M0 repository guide

`apps/pi-teaching-web/` is the current StudyForge M0 runtime and local student App.
`examples/derivative-m0/` is its public smoke learning set. The old Claude Code plugin
and historical documents remain for comparison; they are not M0 dependencies or
current runtime contracts.

## Durable domain

M0 has one Markdown control tree:

```text
ROADMAP.md
└── plans/<plan-id>.md
    └── lessons/<lesson-id>.md
        └── Block Classroom Logs
```

`LEARNING_GUIDE.md` supplies learning-set-specific teaching principles. `cards/`,
`graph/`, and `materials/` are static source assets. Pi Session JSONL stores each
node's raw conversation and native tool history.

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

Every Roadmap, Plan, and Lesson has one node-owned native Pi Session. Ownership is
`nodeKind + nodeId + nodePath + parentId + parentPath`; display labels do not identify
a Session. Parent and sibling transcripts are never copied into a new node Session.

A long Plan Session uses Pi's native compaction only at a semantic boundary: the
settled turn successfully edited or wrote `lessons/*.md`, and active context usage is
at least 200,000 tokens. The compaction summary is a working Session index, not a
teaching fact or Handoff. Markdown remains authoritative, the parent rereads original
documents when detail matters, and the append-only Pi JSONL keeps the raw history.
Roadmap and Lesson Sessions do not use this StudyForge threshold.

The model receives only:

1. shared mathematics teaching principles;
2. the node-role prompt;
3. `LEARNING_GUIDE.md`;
4. current node identity/path instructions;
5. the role's Skills.

Every node has the native `read`, `grep`, `find`, `ls`, `edit`, and `write` tools. A
Plan Session additionally has `subagent` for three concurrent fresh-context copies of
one packaged read-only `study-material-scout`: graph-first, card-text-first, and
teaching-fit-first. The parent waits for all lanes, merges their compact indexes,
chooses the material set required by the agreed Lesson Blocks, and reads only those
selected full assets. A one-problem Lesson may need one card; a multi-problem Lesson
may need several. Scouts use only `read`, `grep`, `find`, and `ls`; they cannot write
teaching facts. Roadmap and Lesson Sessions do not receive `subagent`. Node activation
and completion are student UI actions handled by Runtime code. Do not replace these
actions with prompt conventions or model tool calls.

## Teaching behavior owners

- Roadmap introduction and long-term diagnosis:
  `apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md`
- Plan inquiry, direct child reading, and Lesson preparation:
  `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Cross-cycle direct-document review:
  `apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md`
- Live Block teaching and logging:
  `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Shared mathematics judgment:
  `apps/pi-teaching-web/resources/teaching/math-teaching-core.md`

Skills own teaching judgment and natural language. Runtime owns document parsing,
Session identity, lifecycle transitions, transport, and persistence. Do not add exact-
wording tests for Skill prose; validate assembled resources plus real class behavior.
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
- API: health, course snapshot, static knowledge snapshot, node history/message, and
  four student lifecycle actions.
- WebSocket `/events` transports raw conversation items, native tool activity, run
  state, errors, and invalidations.

Assistant text is rendered unchanged. Tool calls are separate collapsed activity
items. The normal Lesson view shows `Student View` and Block progress, not
`Teacher Control`.

## Repository map

- `apps/pi-teaching-web/src/study/`: strict M0 Markdown and static knowledge readers.
- `apps/pi-teaching-web/src/runtime/`: node ownership, resource assembly, Session
  registry, frontmatter edits, and lifecycle.
- `apps/pi-teaching-web/resources/subagents/`: packaged read-only asset Scout used only
  by Plan Sessions.
- `apps/pi-teaching-web/src/server/`: minimal HTTP/WebSocket transport.
- `apps/pi-teaching-web/src/client/`: Course/Knowledge App.
- `apps/pi-teaching-web/tests/m0/`: current executable contract.
- `apps/pi-teaching-web/tests/e2e/m0-cycle.spec.ts`: deterministic browser closure.
- `examples/derivative-m0/`: clean public learning set.

## Change discipline

- Prefer deletion to compatibility shims when an old surface has no M0 consumer.
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
