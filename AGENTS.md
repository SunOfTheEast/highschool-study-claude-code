# StudyForge repository guide

StudyForge is one Markdown-first learning domain with two runtimes:

- `plugins/highschool-study/` is the distributable Claude Code plugin.
- `apps/pi-teaching-web/` is the local Pi runtime and student web app.
- `examples/derivative-demo/` is the public derivative learning set.

The current user-facing reference is `docs/zh-CN/完整说明书.md`. Historical
designs, plans and audits explain why the system changed; they are not current
runtime contracts.

## Durable facts

The learning set is a control tree:

```text
ROADMAP.md
└── Plan Tree
    └── plans/<plan-id>.md
        └── Lesson Tree
            └── lessons/<lesson-id>.md
```

Its durable facts are:

1. `ROADMAP.md` owns long-term milestones and the Plan Tree.
2. Each Plan owns its goal, observable standard, test, current position,
   summary, Lesson Tree and sealed Handoff.
3. Each Lesson owns its frozen Activation Snapshot, classroom Blocks, aliases,
   summary and sealed Handoff.
4. `traces/*.md` is one global append-only classroom-event pool. Every Trace
   freezes its Plan, Lesson, Block, card/material, time, judgment, support and
   optional method binding. A correction appends a new Trace with
   `supersedes`; it never edits the old file.
5. `memory/student-profile.md` and `memory/teaching-profile.md` contain only
   student-confirmed long-term preferences. `memory/planner-attention.md`,
   ability nodes, summaries, home continuation and UI panels are projections.
6. Pi Session JSONL owns raw conversation and tool history plus Session-local
   custom entries. It can be cited as evidence, but it is not a second learning
   database.

Cards and method vocabulary remain under `cards/` and `graph/`. Do not add a
database, vector store, background index, rule engine or unified context API
unless the user explicitly changes the architecture.

## Node lifecycle and authority

A tree entry starts as a Candidate. A Candidate has a local handle and planning
metadata, but no child file and no Session. The Runtime materializes it into a
`prepared` child, allocating the child ID/path, binding `parent_id` and
`parent_path`, and rendering a complete child document.

Only an explicit student action activates a prepared Plan or Lesson. Activation
atomically:

- validates the child and its dependencies;
- seals `Activation Snapshot / Activated at`;
- writes the owner-matched Session ID;
- changes status to active;
- creates or restores exactly one owned Session.

Plan terminal states are `completed` and `abandoned`; Lesson terminal states are
`closed` and `abandoned`. Terminal nodes are read-only replay. Plans may run in
parallel, but one Plan may have at most one active or paused Lesson. One Lesson
may have at most one active Block.

Parent writers may add, revise, remove or reorder only Candidate entries. A
materialized tree entry is structural history and cannot be rewritten by the
parent. A prepared child may be re-prepared in place through its dedicated
prepare tool. Once a child is active, paused or terminal, replacement creates a
new sibling and preserves the old node.

## Session ownership, context and tools

Every Pi Session has exactly one `studyforge.session-owner.v2` custom entry:

```text
nodeKind + nodeId + nodePath + parentId + parentPath
```

A frontmatter Session ID is reusable only when all five values match. Missing,
malformed, duplicate or mismatched owner metadata creates a fresh Session.
Display names never determine identity.

Node prompts are assembled in this order:

1. shared teaching core;
2. Roadmap, Plan or Lesson role prompt;
3. dynamic Context Frame;
4. node-scoped Skills;
5. presentation-only persona.

The Context Frame has four page classes:

- **Resident**: teaching core, role, learning-set principles, selected confirmed
  preferences and Runtime capabilities;
- **Frozen**: the Activation Snapshot inherited from the parent;
- **Local**: the current node file and current Session;
- **Index**: child Handoffs, Claims and scoped search entry points.

Plan and Lesson Sessions do not receive copied parent or sibling transcripts.
They may resolve only sources named in their frozen context, their own scope,
their child Handoffs or a successful scoped search. File access is limited to
the current node, `LEARNING_GUIDE.md`, public cards/graph/materials, and
Roadmap-only confirmed profiles. Native learning-set-wide file read/write
tools are not exposed.

Pi model-callable tools are scope-specific:

- Roadmap: `roadmap_update`, `plan_prepare`, search/resolve and optional deep
  workflow;
- Plan: `lesson_prepare`, `plan_update`, `memory_review_propose`,
  search/resolve and optional deep workflow;
- Lesson: `trace_append`, `classroom_update`, `lesson_close`,
  `card_alternative_append`, search/resolve and optional deep workflow.

Plan/Lesson activation and confirmed-memory application are Runtime-only
actions. Model arguments never choose owner paths, parent identity, Session
identity or Runtime-allocated node IDs.

The Claude Code plugin continues to expose exactly four public MCP tools:

- `card_search`
- `trace_search`
- `trace_append`
- `source_resolve`

An empty search result is an authenticity fence. Never invent a card, path,
source, Session ID or Trace to fill a gap.

## Trace, Handoff and memory

One independently judged student response is one problem Block and one active
Trace revision chain. A problem Block binds one authentic Lesson alias.
Multi-part cards use separate Blocks when the parts receive separate responses
or judgments.

`trace_append` is fact-first. Pi derives Plan, Lesson, path and card identity
from the current Session and Block. The public MCP accepts explicit paths
because it has no Pi Session owner. A superseding Trace must target the current
active Trace for the same Plan/Lesson/Block/card binding.

`classroom_update` owns legal Block transitions and pending-Block routing.
`lesson_close` is student-controlled and does not require a Reflection Block or
a model-authored Claim. It preserves the real stop point, writes the summary,
seals a claims Handoff when valid, and otherwise seals a source-only Handoff.

Handoffs are the compressed evidence tree:

```text
Roadmap checkpoint Claim
  → Plan Handoff Claim
    → Lesson Handoff Claim
      → Trace / Block / Card / Session
```

Claims never replace their sources. Evidence resolution reports active,
superseded, invalidated, missing or forbidden state. Superseding a Trace does
not cascade rewrites through summaries or Handoffs; dependent Claims become
invalidated when read, and a later normal review may create a new decision.

Long-term memory is proposed only from a completed Plan Handoff. The student
accepts, rewrites or rejects every item. The Runtime validates the submitted
review, atomically applies accepted items to both profile files, records a
receipt in the same Plan Session, and then the Coach rereads the profiles.
There is no model-callable memory-apply tool.

## Student projection

The student UI is a projection, never a fact owner:

- the course tree shows Roadmap → Plans → Lessons and Candidate/prepared/active/
  terminal state;
- Candidates have no chat action; prepared nodes expose the student start
  action; only materialized nodes with real Sessions appear in Session history;
- prepared Lesson title, Teacher Control, private notes, answers, methods and
  unrevealed Blocks remain private;
- safe message projection replaces tool chatter with structured events while
  raw Pi JSONL remains available for local diagnosis;
- Home, routes, replay, Context pages, content search, evidence lens and ability
  views are rebuilt from current facts;
- refresh restores the selected valid route without silently activating or
  switching nodes;
- a completed Plan may show other Plans, but switching remains a student click.

## Teaching authority

Do not duplicate a full teaching protocol here. Semantic owners are:

- Pi Roadmap behavior: `apps/pi-teaching-web/resources/skills/roadmap-study/`.
- Pi Plan inquiry, preparation and decisions:
  `apps/pi-teaching-web/resources/skills/coach-study/`.
- Pi Lesson teaching and closure:
  `apps/pi-teaching-web/resources/skills/tutor-lesson/`.
- Shared mathematics principles:
  `apps/pi-teaching-web/resources/teaching/math-teaching-core.md`.
- Claude plugin learning workflows: `plugins/highschool-study/skills/`.
- Tool fields and timing: the corresponding TypeBox or Zod definition.
- Identity, permissions, state transitions and persistence: Runtime code and
  executable tests.

Skills express teaching judgment. Runtime code owns identity, authenticity,
atomicity, permissions and facts. Do not use prompt prose to compensate for a
Runtime ownership defect, and do not add brittle tests for Skill wording.

## Repository map

- `plugins/highschool-study/server/src/`: card, Trace, source, method and
  projection domain logic.
- `apps/pi-teaching-web/src/runtime/`: tree mutation, activation, Session
  ownership, Context compilation, access policy and scoped tools.
- `apps/pi-teaching-web/src/study/`: node readers, Handoffs, evidence,
  projections, routes and replay.
- `apps/pi-teaching-web/src/memory-review/`: proposal, confirmation and trusted
  profile application.
- `apps/pi-teaching-web/src/client/`: student-safe workspace.
- `docs/zh-CN/学习节点树与证据继承.md`: developer protocol.
- `docs/zh-CN/完整说明书.md`: current functional reference.

## Change discipline

- Prefer the smallest change that preserves the Markdown-first tree.
- Do not add compatibility paths for pre-tree learning sets.
- Do not add new persistent fields, tools, Agents or defensive infrastructure
  without a demonstrated requirement.
- Before changing a schema, inspect every reader, writer, projection, fixture
  and source resolver.
- Run mutation-heavy or real-model acceptance on a copied learning set.
- Never commit credentials, provider tokens, local Session files, private
  transcripts, `CLAUDE.local.md` or generated test output.
- Preserve unrelated user changes.

## Verification

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

Plugin release checks must keep the public MCP count at four. Browser routing,
activation, replay, evidence and student-projection changes require Playwright
E2E in addition to unit tests and a production build.
