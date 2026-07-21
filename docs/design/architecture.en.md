# Markdown-First Highschool Study Plugin Design

Status: formal design approved; includes bidirectional card/Trace search, Plan-gated long-term-memory consolidation, learning-set orientation, and selectable presentation personas
Date: 2026-07-21

Implementation plan: [Learning-set orientation and selectable personas](../superpowers/plans/2026-07-21-learning-set-orientation-personas.en.md)

## Decision

Highschool Study is a local Claude Code plugin, not a product backend. A learning set is a human-readable directory whose Markdown files are the durable learning state. Claude Code owns conversation, Agent, Skill, Task List, directory recall, and native Workflow execution. A small MCP server supplies authentic card search, Trace search and append, and source resolution. It owns neither a database, a universal context compiler, nor a second copy of the learning state.

The Roadmap, Plan, Lesson, flexible ActivityBlock, three-level memory, card graph, method aggregation, and student-owned lesson closure concepts remain. The implementation is a clean rewrite rather than a refactor of the SQLite plugin. It preserves the agreed learning model but carries forward no product-grade storage or governance code.

## Rewrite strategy

The existing plugin at `highschool-study/` is frozen as a reference implementation. The new plugin is built from an empty sibling directory:

```text
highschool-study-markdown/
```

The new plugin manifest may keep the user-facing plugin name `highschool-study`, but the two plugin directories are never loaded together. Development and validation target only the new directory.

No TypeScript service, migration, SQL trigger, database test, runtime-authority layer, or compatibility adapter is moved into the new implementation. Subject-pack assets and short prompt passages may be copied only when they match this design and remain understandable on their own.

The old directory is neither incrementally stripped nor deleted during the rewrite. After the new plugin passes its acceptance checks, the user can run it directly from the new directory; replacing or archiving the old directory is a separate optional action.

The new plugin package starts with only this structure:

```text
highschool-study-markdown/
├── .claude-plugin/plugin.json
├── .mcp.json
├── agents/
│   ├── study-coach.md
│   └── lesson-designer.md
├── skills/
├── server/
│   └── four-tool Markdown MCP
├── learning-set-template/
├── subject-packs/
├── tests/
└── README.md
```

The four-tool MCP may be implemented in fresh, small TypeScript modules. The restriction is against porting the old service architecture, not against using TypeScript.

## Learning-set layout

```text
learning-set/
├── CLAUDE.md
├── CLAUDE.local.md          # optional, local-only, gitignored
├── .claude/
│   └── personas/            # optional learning-set additions and overrides
├── ROADMAP.md
├── plans/
│   ├── fixed-value.md
│   └── max-value.md
├── lessons/
│   ├── lesson-001.md
│   └── lesson-002.md
├── memory/
│   ├── student-profile.md
│   ├── teaching-profile.md
│   └── planner-attention.md
├── cards/
├── graph/
└── materials/
```

The learning-set root is the only mutable study-state boundary. Plugin code, Skills, Agents, tests, and MCP implementation remain in the plugin package and are not copied into each learning set. `CLAUDE.local.md` contains only a machine-local presentation preference for this learning set; it is not learning evidence, long-term memory, or shared state.

## File ownership

### `ROADMAP.md`

Owns the active long-term goal and the Plan graph:

- a short student-facing Learning Set Overview: what it teaches, who it is for, the approximate Plan scope, and what the student should be able to do at completion;
- Roadmap goal and scope;
- observable capability standard and its tests;
- ordered Plan references;
- dependencies, parallelism, and learner-approved reordering;
- current status and a short change log.

Roadmap changes are discussed with the student before the file is edited. No proposal hash, nonce, DecisionEvent table, or revision service is required.

### `plans/<plan-id>.md`

Owns one Plan:

- goal and observable capability standard;
- dependency and parallel-group references;
- lesson index;
- prior-Lesson summaries relevant to the Plan;
- unresolved questions and suggested next step;
- source links for every memory-derived claim.

Later Plans may read summaries from earlier relevant Plans. A summary is navigation, not independent evidence; its links must lead back to a Lesson step, trace entry, card, or material.

### `lessons/<lesson-id>.md`

Owns both the prepared Lesson and its classroom record:

- Plan binding and optional Claude session ID;
- lesson goal and capability check;
- local aliases that map cards or materials to real relative paths;
- ordered ActivityBlocks with optional blocks and simple branching;
- append-only classroom Trace entries;
- evaluations, student suggestions, closure choice, and lesson summary;
- stable anchors that other Markdown files can cite.

The Claude Code Task List is generated from ActivityBlocks for display only. Task completion never overwrites the Lesson file or implies attainment or closure.

### `memory/*.md`

`student-profile.md` contains only current, confirmed learner-side preferences or constraints, such as whether the student wants to attempt a problem before seeing an example. `teaching-profile.md` contains only current, confirmed standing requirements for the Claude tutor's pedagogical behavior, interaction method, and stable demeanor, such as whether to ask about the student's reasoning before explaining an error. It does not contain a presentation character name, self-reference, or verbal tic such as "calm senpai"; those belong to presentation-persona files. One long-term teaching preference has exactly one owner and is never paraphrased into both profile files.

These profiles are not per-Lesson event logs. They change only after `consolidate-plan-memory` reads every classroom record in a completed Plan, proposes an add/revise/delete delta, and the student confirms that delta. The profiles contain only the current effective list; original evidence and history remain in Lessons and Git.

`planner-attention.md` is a disposable preparation cache generated from Plans, Lessons, Trace, and card-method aggregation. It is not long-term memory and does not require item-by-item student confirmation.

Every long-term preference, including a preference stated explicitly by the student, ends with one or more relative Markdown source links that drill down to an original Lesson block, Trace entry, card, or material. If a link no longer resolves, the item is ignored until repaired; it is not treated as evidence.

### `cards/`, `graph/`, and `materials/`

Cards retain the readable StudyForge teaching structure: goal, primary and secondary methods, subroutes, stable card steps, and source material. The graph retains stable, understandable goal/method/structure names without arbitrary prerequisite relationships. Materials contain videos, PDFs, images, or text resources addressed by relative path.

Existing YAML authoring assets may remain YAML. Markdown is mandatory for learning state and memory, not for rewriting every source asset solely for format uniformity.

### `CLAUDE.md`, `CLAUDE.local.md`, and persona files

`learning-set/CLAUDE.md` contains only stable, shared Claude Code instructions for the learning set:

- identify the directory as a Highschool Study learning set entered through `highschool-study:study`;
- name the learning set's default persona ID;
- state that a persona changes presentation only and never overrides teaching facts or capability standards;
- forbid invention of personas, cards, Trace, or sources.

`learning-set/CLAUDE.local.md` contains only the student's persistent persona selection for the current learning set and is gitignored. "Use this persona for this lesson" affects only the current Lesson Session and writes no file. "Use this persona for this learning set from now on" updates the local file.

Built-in personas live under `skills/enter-learning-set/references/personas/`. A learning set may add a persona, or override a built-in persona with a same-named file, under `.claude/personas/`. A persona file is ordinary Markdown that describes only its name, forms of address, voice, encouragement style, and optional fictional framing. It defines no teaching conclusion, card-selection policy, or assessment rule.

Claude Code treats `CLAUDE.md` and `CLAUDE.local.md` as session context rather than enforced configuration, and `@` imports expand into the startup context. The design therefore does not import every persona from `CLAUDE.md`; a Skill resolves the current choice and reads exactly one persona file. See the [Claude Code memory documentation](https://code.claude.com/docs/en/memory).

## Markdown conventions

Each state file uses small YAML frontmatter for machine routing and Markdown for content. IDs are human-readable and stable within one learning set.

```markdown
---
id: lesson-001
plan: max-value
status: closed
session: claude-session-id-or-null
---

## Block step-03 — Independent practice

...

## Trace event-007

...
```

Cross-file references use ordinary relative Markdown links to stable anchors, for example:

```markdown
- 无提示时能够识别冻结量，但仍遗漏定义域。
  Sources: [lesson-001 event-007](../lessons/lesson-001.md#trace-event-007),
  [freeze-variable step](../cards/conics/freeze-variable-01.yaml#step=identify-freeze)
```

For Markdown targets, the fragment is a heading anchor. For structured card assets such as YAML, `source_resolve` treats `#step=<stable-step-id>` as a semantic fragment and verifies that the step exists in that file.

The model may use a short alias such as `Q-FREEZE-01` inside one Lesson, but the Lesson alias section maps it to a real relative file path. Aliases never become global hidden state.

## Claude Code roles

- `study-coach` remains the single student-facing entry and routes planning, preparation, teaching, progress inspection, and correction.
- `lesson-designer` remains a preparation-specific configuration that the Coach may invoke internally; the student does not switch Agents.
- Teaching workflows remain Skills. They contain instructions, not learner facts.
- `enter-learning-set` injects the learning-set overview and current persona every time `study` is entered; it does not create another Agent.
- `recall-study-memory` performs structural, summary, and memory recall with Claude Code's native `Read`, `Glob`, `Grep`, and, only when useful, `Agent`; it does not call a fixed context-compilation endpoint.
- `consolidate-plan-memory` runs after a Plan is completed, proposes a long-term preference delta, asks the student to confirm it, and edits the two profile files.
- Native Dynamic Workflow remains optional. It runs only when preparation lacks material information worth parallel lookup. Raw branch JSON stays in Claude Code; the main Agent writes only an adopted, source-linked conclusion into the relevant Lesson Markdown.
- The Task List displays the current Lesson blocks and is not a persistence layer.

### Learning-set entry and persona resolution

Before `study` chooses a Roadmap, Plan, or Lesson route, it invokes `enter-learning-set`:

1. Read the Learning Set Overview from `ROADMAP.md`. Keep it as background on every entry, but actively present it only when the learning set contains no classroom Trace or when the student asks for it.
2. Resolve the persona in this order: current-session temporary choice, current-learning-set choice in `CLAUDE.local.md`, learning-set default in `CLAUDE.md`, plugin default.
3. Enumerate real local and built-in persona files and match an exact ID. A same-named learning-set file wins; never construct a path directly from student text.
4. Read exactly the selected persona and pass it to `study-coach`. "Disable personas" selects the built-in neutral tutor.
5. Keep preparation neutral. Persona instructions affect only student-visible output and never enter `lesson-designer`, `planner-attention.md`, Trace, summaries, long-term profiles, or method aggregation.

The first release ships only a few templates, such as neutral tutor, calm senpai, and energetic classmate. Adding a persona requires no MCP change, additional Agent, or persona database.

## Recall strategy

The plugin does not use one `study_context_get` call to precompile every kind of context. Each fact is recalled through the mechanism that owns it:

1. **Structural recall:** use `Read`, `Glob`, and `Grep` to locate `ROADMAP.md`, the active Plan, the active Lesson, and their indexes.
2. **Hierarchical-summary recall:** within one Plan, recall earlier Lesson Summaries; for later Plans, recall relevant earlier Plan Summaries. A summary is a navigation lead whose source links can be expanded on demand.
3. **Long-term-preference recall:** `student-profile.md` and `teaching-profile.md` are short because they are consolidated at Plan boundaries, so preparation and teaching read both files in full rather than similarity-filtering them.
4. **Preparation-attention recall:** only preparation reads the rebuildable `planner-attention.md`.
5. **Card recall:** call `card_search`; every card candidate includes all active Trace history bound to that card.
6. **Evidence recall:** call `trace_search` to filter by Plan, Lesson, card, or text and to reverse-resolve a Trace to its real card.
7. **Source expansion:** call `source_resolve` to validate and open an exact file or anchor.

`recall-study-memory` completes structural and summary recall directly. It starts native Agent/Dynamic Workflow branches only when the Planner judges the direct evidence insufficient and there are genuinely independent searches worth parallelizing. Raw branch JSON remains in the Claude Code session and never becomes a second memory store.

## Minimal MCP surface

The replacement MCP server exposes four tools:

1. `card_search`
   - searches actual files under `cards/`, with optional graph metadata;
   - returns real relative paths, card aliases, method roles, and real card steps;
   - includes the complete, time-ordered active `traceHistory` for every card candidate, or `[]` when the card is unseen;
   - controls context by limiting card candidates, never by truncating one card's Trace history;
   - returns an empty result when no suitable card exists.

2. `trace_search`
   - searches active, non-superseded Trace entries across Lesson files;
   - filters by Plan, Lesson, `cardPath`, and text query;
   - retains `cardPath` and optional `cardStepId` so every card-bound hit can reverse-resolve its card;
   - returns card bodies once in a deduplicated `cardsByPath` map when several Trace hits reference the same card;
   - also returns classroom Trace entries that have no card binding.

3. `trace_append`
   - appends one stable Trace section to the current Lesson file;
   - resolves a short card alias through the current Lesson and persists the canonical learning-set-relative `cardPath` plus optional `cardStepId`;
   - records the referenced block, card/material path, assessment, support level, and source anchors when present;
   - never rewrites prior Trace entries.

4. `source_resolve`
   - resolves a relative Markdown/card/material link within the learning-set root;
   - returns the exact target file and anchor or an invalid result;
   - never searches outside the learning set.

Roadmap, Plan, Lesson preparation, summaries, and profile updates use Claude Code's normal Markdown file editing. The MCP is a convenience and truth fence, not a business service layer.

## Bidirectional card/Trace relation

The relationship is stored once and read in both directions:

```text
Trace -- cardPath / cardStepId --> Card
Card  -- request-local reverse index by cardPath --> Trace[]
```

Card files contain no Trace backlinks. `trace_append` writes the canonical `cardPath`; `trace_search` follows it forward to the card; `card_search` joins candidate cards to Trace entries by that same path.

Each relevant MCP request parses active Trace entries once and builds `Map<cardPath, TraceRecord[]>`. `card_search` must not rescan every Lesson separately for every card candidate. `trace_search` reads the deduplicated set of cards referenced by its matched Trace entries. The local plugin has no database or persistent reverse index. A process-memory cache invalidated by Lesson file modification times is considered only if measurements later show a real need.

A superseded Trace remains in the Lesson file but is absent from `traceHistory`, `trace_search`, method aggregation, and long-term-memory consolidation.

## Plan-gated long-term-memory consolidation

Long-term memory means student-confirmed preferences that remain useful across Lessons. It does not contain mastery claims, one answer's assessment, or temporary preparation advice.

During a Plan, classroom facts remain in Lesson Trace entries. Later Lessons in the same Plan use prior Lesson Summaries and targeted Trace search for continuity. After the Plan meets its capability standard and the student confirms completion, `consolidate-plan-memory` runs once:

1. read every Lesson, active Trace entry, classroom block, student suggestion, and Lesson Summary in that Plan;
2. read the current `student-profile.md` and `teaching-profile.md`;
3. let the LLM perform semantic aggregation without fixed scores or rule thresholds;
4. propose source-linked add, revise, and delete operations, including supporting evidence, conflicting evidence, and scope conditions;
5. show the candidate list and let the student keep, rewrite, or remove items in natural language;
6. merge the delta into the two Markdown profiles only after explicit confirmation.

Learner-side preferences belong only to `student-profile.md`; requirements for the tutor's pedagogical behavior, interaction method, and stable demeanor belong only to `teaching-profile.md`. Presentation personas enter neither long-term profile. Borderline items choose one owner and are never duplicated. Profiles keep only the current effective list, not candidates, rejected items, or retired versions. A student objection or correction during confirmation is recorded in the final Plan-reflection Lesson block/Trace so future consolidation can see it as original evidence.

The consolidation is a delta merge rather than a rewrite from all historical Plans. Later preparation and teaching read both compact profiles in full, expanding a source only when a preference needs verification.

## Card-authenticity fence

Card authenticity has two controls only:

1. `card_search` returns only files that really exist under `cards/` and exposes their real steps, paths, and bound Trace history.
2. Preparation and teaching prompts state: use only returned cards; if no suitable card is found, stop looking and do not invent a card, path, step, score, or alias.

A Lesson may still use dialogue, a demonstration, or a real material without a card. It must not make a card-backed evaluation claim when no card was found.

## Learning loop

1. The student and Coach create or revise `ROADMAP.md` and Plan files through normal conversation.
2. `recall-study-memory` reads the selected Plan, prior summaries, and both full profiles; preparation additionally reads `planner-attention.md`.
3. The Designer uses `card_search` to retrieve real cards with complete Trace history and, when needed, `trace_search` for evidence across cards.
4. The Designer writes the next Lesson Markdown as flexible ActivityBlocks.
5. Teaching projects those blocks into Claude Code Tasks and appends classroom Trace entries through `trace_append`.
6. At Lesson pause or close, the student retains control; the Lesson records the exact choice, summary, and suggestions.
7. Preparation derives simple method aggregation and rebuilds Planner attention from card roles plus active Trace. Primary-method evidence contributes more than secondary-method evidence.
8. At Plan completion, the consolidation Skill proposes a preference delta and updates the profiles only after student confirmation.
9. Later Plans read the consolidated profiles in full, closing the cross-session loop.

## Correction and history

A correction is appended to the owning Lesson as a new anchored Trace section with `Supersedes: [event-id](#trace-event-id)` and the corrected statement. Every search, projection, and consolidation ignores superseded entries and memory items that cite only invalid sources. The plugin then regenerates affected summaries and `planner-attention.md`. If a correction undermines a confirmed preference, the next Plan consolidation must propose revision or deletion to the student rather than silently rewriting long-term memory.

Git may provide file history and rollback, but the plugin does not require automatic commits. There is no SQL correction graph, stale-propagation table, or schema migration path.

## Architecture not carried forward

The clean rewrite does not copy or emulate:

- SQLite, migrations, schema identity, and database compatibility code;
- RuntimeCapability, WriterLease, operation replay, and multi-writer concurrency machinery;
- proposal hashes, nonce/expiry records, DecisionRequest, and DecisionEvent persistence;
- SQL-backed ContextView, MethodMastery, PlannerAttention, profile, teaching-method, and resident-memory tables;
- Workflow finding-adoption persistence and DerivationRun protocol;
- duplicated validation across Zod, TypeScript services, and SQL triggers;
- product-level multi-user, multi-process, backup, restore, and authority claims.

No compatibility reader or converter is included. The frozen SQLite plugin and its data may be retained for reference, but the new plugin does not read them.

## Error handling

The plugin fails simply and visibly:

- missing card: return no result and do not invent one;
- unresolved Lesson alias or card step: reject that Trace append and identify the invalid alias/step;
- missing source link: exclude the dependent memory claim and show the broken link;
- malformed frontmatter: report the file and stop before overwriting it;
- duplicate stable ID in the same directory: report the conflict;
- missing current Roadmap, Plan, or Lesson: route the Coach to create or select one;
- unknown persona: tell the student and fall back to the learning-set default or the plugin's neutral persona;
- missing Learning Set Overview: synthesize one short sentence from the Roadmap title, Goal, Plan Graph, and capability standard without blocking the lesson.

There are no leases, retries, distributed transactions, or in-place schema upgrades.

## Acceptance criteria

- A clean learning set is understandable without running the plugin.
- The Coach can create and resume Roadmap, Plan, and Lesson Markdown files.
- A prepared Lesson can combine video, explanation, practice, interaction, and assessment blocks in any supported order.
- The public MCP surface is exactly `card_search`, `trace_search`, `trace_append`, and `source_resolve`; there is no `study_context_get`.
- `card_search` never returns a nonexistent file, a no-match result produces no fabricated reference, and every candidate carries complete active `traceHistory` or `[]`.
- `trace_search` reverse-resolves deduplicated cards and also returns cardless classroom Trace entries.
- Every card-bound Trace can be followed to its Lesson block, real card, and optional card step; card files contain no backlinks.
- Every long-term preference, including an explicit student declaration, can be followed to a real source anchor.
- Prior Lesson Summaries affect later Lessons in the same Plan, and relevant earlier Plan Summaries enter later-Plan recall.
- A completed Plan changes the two profiles only through a student-confirmed delta; student edits and deletions are respected.
- Preparation and teaching read both compact profiles in full, while only preparation reads `planner-attention.md`.
- Student closure remains independent from capability attainment.
- Method aggregation is reproducible from Trace and card primary/secondary roles.
- Native Dynamic Workflow is optional and does not create a second persistence protocol.
- The new plugin is installable and runnable directly from `highschool-study-markdown/` without loading the old plugin.
- The new plugin starts without SQLite, migrations, or a database data directory.
- Every `study` entry reads the Learning Set Overview; an empty-Trace learning set presents it, while a learning set with Trace does not repeat it unprompted.
- Persona resolution follows the fixed precedence of session choice, local learning-set choice, learning-set default, and plugin default.
- A temporary switch edits no file; a persistent switch updates only gitignored `CLAUDE.local.md` and remains active in the next Lesson Session.
- A learning set can add or override a persona, and each entry loads exactly one final persona file.
- Switching or disabling personas changes no capability judgment, card selection, Trace fact, test standard, or preparation result.

## Non-goals

- product-grade multi-user or teacher administration;
- strong identity, authorization, audit, or concurrent-writer guarantees;
- calibrated BKT or learning-effect claims;
- arbitrary knowledge-graph relations;
- automated background or offline teaching services;
- a generic vector database, persistent Trace reverse index, or background memory-consolidation service;
- migration from the discarded pre-release database architecture;
- a persona marketplace, persona database, one Agent per persona, or loading all personas permanently into context.
