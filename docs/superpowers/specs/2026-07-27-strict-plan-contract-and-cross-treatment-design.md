# Strict Plan Contract and Cross-Treatment Design

**Date:** 2026-07-27  
**Status:** approved direction, implementation pending

## Context

The first longitudinal-personalization acceptance showed a real planning effect:
both history-swap pairs changed direction with the supplied learner history. It still
failed the preregistered gate because one generated Plan omitted `Planning Basis` and
`Lesson Index`, while `plan_register` accepted it and Coach declared success after
rereading it.

The failure came from one boundary mistake: backward-compatible reading converted a
missing section to an empty string, and Plan registration reused that permissive
projection. The system therefore could not distinguish an old Plan from an incomplete
new Plan.

This design removes old-Plan compatibility. A Plan that does not satisfy the current
contract is invalid everywhere. After the strict contract passes deterministic and
real-model validation, the history-swap gate is rerun and, if it passes, the
matched-versus-mismatched cross-treatment Lessons continue.

## Decision

Use one canonical Plan validator in the shared Markdown domain consumed by both the
Claude plugin and Pi application.

Do not:

- add a schema version or migration layer;
- repair an invalid Plan automatically;
- preserve an empty-string fallback for old files;
- validate pedagogical truth with a rule engine;
- add semantic checks for whether a cited teaching judgment is correct.

The contract validates document shape and machine-owned invariants. Skills and later
acceptance still judge teaching quality and source meaning.

## Canonical Plan Contract

### Frontmatter

Every file directly under `plans/` must contain:

| Field | Rule |
| --- | --- |
| `id` | non-empty string equal to the filename stem |
| `kind` | exactly `plan` |
| `status` | exactly `ready`, `active`, or `completed` |

`coach_session` remains an optional Pi runtime extension. When present, it is either
`null` or a string; it is not required by the cross-runtime Markdown contract.

### Title

The body must contain one non-empty level-one title. The validator does not require a
Chinese or English `Plan:` prefix.

### Required sections

Each of these exact level-two headings must occur once and have a non-empty body:

1. `Goal`
2. `Observable Capability Standard`
3. `Test`
4. `Planning Basis`
5. `Lesson Index`
6. `Current Position`
7. `Next Lesson Candidate`
8. `Plan Summary`

Placeholder prose such as “尚未创建 Lesson” or “尚无课堂结果” is valid because it
states the current fact. An empty section is not valid. Extra Plan-specific sections
remain allowed, and required sections do not need a fixed order.

The section scanner ignores headings inside fenced code blocks. Duplicate required
headings are invalid rather than silently selecting the first one.

### Stable failures

The shared reader reports a stable error containing the Plan path and offending field:

```text
INVALID_PLAN_KIND: plans/example.md
INVALID_PLAN_STATUS: plans/example.md
INVALID_PLAN_COACH_SESSION: plans/example.md
PLAN_TITLE_REQUIRED: plans/example.md
PLAN_TITLE_DUPLICATE: plans/example.md
PLAN_SECTION_REQUIRED: plans/example.md#planning-basis
PLAN_SECTION_DUPLICATE: plans/example.md#planning-basis
```

Missing and whitespace-only section bodies both use `PLAN_SECTION_REQUIRED`.

## Read and Write Boundaries

### Shared reads

`readMarkdownFile` performs the canonical validation whenever the canonical relative
path is `plans/<id>.md`. Consequently:

- Claude source lookup cannot quietly consume an old Plan;
- Pi `readLearningSet` and `readPlanWorkspace` fail fast on an invalid linked Plan;
- `PlanSummary.planningBasis` is always a real non-empty value;
- the Plan page can treat “为什么这样安排” as part of every valid Plan rather than an
  optional legacy panel.

The application does not hide an invalid Plan and continue with the remaining ones.
The learning set is invalid until its Plan files are manually corrected.

### Registration

`plan_register` keeps its existing one-field model contract: the model supplies only
`planId`. The runtime:

1. resolves `plans/<planId>.md`;
2. runs the canonical strict Plan validator;
3. performs any existing Coach Session ownership cleanup;
4. rereads the strict Plan;
5. only then adds or updates its Roadmap Plan Graph entry;
6. rereads both Plan and Roadmap and returns the canonical receipt.

If validation fails, Roadmap and Plan remain byte-for-byte unchanged. Registration
must never return `ok: true` with an empty `planningBasis`.

Session cleanup must not create a partial transaction. If a foreign `coach_session`
needs clearing, validation occurs before that write, and the final strict reread must
succeed before Roadmap registration.

### Existing repository fixtures

All checked-in Plan fixtures are migrated to the current contract. This is not a
runtime migration mechanism; it is repository maintenance. Test-only `prepared`
statuses are changed to the appropriate current status, normally `active`.

Documentation that says old Plans need no migration is removed. The manual states that
users must bring every Plan to the current eight-section contract before opening the
learning set with the new version.

## Source Priority for the Rerun

The prior acceptance also exposed two input-quality conflicts. They must not be carried
into cross-treatment:

1. History B placed Lesson 005 and Lesson 006 exactly seven days apart while its Plan
   Summary said delayed retention had not been tested.
2. A hand-authored prototype `HEATMAP.md` was cited beside the current six-attempt
   Planner Attention projection.

The rerun uses internally consistent histories:

- Lesson 005 and Lesson 006 remain distinct near-transfer attempts but are less than
  seven days apart;
- the one-week delayed Roadmap check therefore remains genuinely untested;
- all four roots use the same corrected timestamps;
- active Trace is authoritative for attempt outcome, support, method and time;
- current Planner Attention is a derived preparation signal;
- Plan and Lesson summaries are source-linked compact indexes;
- a hand-authored or explicitly prototype HEATMAP is not current learner evidence.

The two `plan-next-cycle` Skills receive a concise source-priority statement. This is a
prose change and receives structural inspection, not brittle sentence-level tests.

## Deterministic Verification

Implementation follows red-green-refactor.

### Reader tests

- reject a linked Plan missing each required section;
- reject an empty required section;
- reject a duplicate required section;
- reject a duplicate title, non-Plan kind, unsupported status, and malformed optional
  `coach_session`;
- accept extra sections and any order of the eight required sections;
- return a non-empty `planningBasis` for every valid `PlanSummary`.

### Registration tests

- reproduce the failed `blue-2` shape: Goal, standard and Test exist, but
  `Planning Basis` and `Lesson Index` do not;
- assert `plan_register` fails with the first exact contract error;
- assert Roadmap and Plan bytes do not change;
- assert a corrected Plan registers idempotently and returns non-empty
  `planningBasis`;
- assert a foreign Coach Session is cleared only for an otherwise valid Plan.

### UI and fixture tests

- update Plan component and snapshot fixtures to contain real rationale;
- render “为什么这样安排” for every valid Plan;
- migrate plugin and Pi Plan fixtures;
- retain exactly four public MCP tools.

## Real-Model Planning Gate

After deterministic verification, create a fresh acceptance root from the new candidate
commit. Do not reuse or patch the four previous Sessions or generated Plans.

Run the same four histories and swap:

```text
red-1  = History A
blue-1 = History B
red-2  = History B
blue-2 = History A
```

Use the same provider, model, thinking level, persona, deep-mode policy and student
prompts. An incomplete generated Plan must be rejected by `plan_register`; Coach may
repair it in the same turn, but the final persisted Plan must pass the strict reader.

Stage one passes only when both pairs:

- materially follow the swapped longitudinal history;
- preserve the prior intervention response;
- distinguish evidence from hypothesis;
- contain all eight Plan sections;
- register and reread successfully;
- resolve every decisive source without contradiction.

If this gate fails, record the failure and stop again.

## Cross-Treatment Lessons

When stage one passes, use the predeclared pair-one Plans, not whichever pair produced
more attractive prose:

```text
A-matched      = History A + Plan A
A-mismatched   = History A + Plan B
B-matched      = History B + Plan B
B-mismatched   = History B + Plan A
```

For each of the four conditions:

1. prepare Lesson 1 under identical provider/model/thinking/persona settings;
2. simulate the stable learner disposition assigned to History A or B;
3. close the Lesson only after student confirmation;
4. return to the same Coach Session for a source-linked review;
5. prepare and run Lesson 2 with an independent check of the Plan's stated cognitive
   change.

The student simulation uses only Student View and behaves naturally:

- History A calculates fluently after a method is started but initially fails to map a
  familiar structure onto a new shell;
- History B recognizes broad structure but initially omits condition or boundary checks
  unless the teaching sequence makes the check habitual.

No product, Skill, prompt, candidate Plan or controlled history changes are allowed
after treatment roots are created.

## Outcome Judgment

Create blinded matched/mismatched packets for each learner type and score:

- time to reach the recurring bottleneck;
- fit with the recorded failed and successful interventions;
- amount and decisiveness of Tutor support;
- independent performance in Lesson 2;
- correctness of Coach retention or revision of the diagnosis;
- all ownership, source, Trace and closure invariants.

Final labels remain:

- `PERSONALIZATION_CONFIRMED`: matched is better for both learner types without a
  factual or runtime regression;
- `PLANNING_ONLY`: planning follows history, but outcomes are tied or mixed;
- `NO_EFFECT`: planning does not reliably follow history or the strict gate fails.

The acceptance report records all real-model failures. It does not patch the product
during the experiment or upgrade the result because personalized prose sounds better.

## Scope

In scope:

- one shared strict Plan validator;
- strict read and registration behavior;
- current repository fixture and documentation migration;
- concise source-priority wording in both `plan-next-cycle` Skills;
- fresh history-swap rerun;
- four-condition, two-Lesson cross-treatment if the planning gate passes;
- full plugin, Pi and browser regression.

Out of scope:

- automatic migration of user Plan files;
- schema-version negotiation;
- semantic grading of Planning Basis prose;
- new MCP tools;
- database or LangGraph orchestration;
- defensive recovery unrelated to the observed Plan-contract failure.
