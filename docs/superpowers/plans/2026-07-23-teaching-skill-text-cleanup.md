# Teaching Skill Text Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` and execute this plan sequentially. Do not dispatch subagents for the prose cleanup.

**Goal:** Remove duplicated, stale, impossible, and over-prescriptive teaching instructions while preserving the established Roadmap → Plan → Lesson learning loop, source-grounded Trace semantics, student control, and no-spoiler teaching behavior.

**Architecture:** The Pi runtime receives one small executable prerequisite: an Evidence Scout can perform Plan-scale card/Trace retrieval in an isolated child session and return a compact `card_index`. Everything else is a Markdown cleanup. Each runtime keeps one authority for each policy: reveal level, evidence attribution, alternative-route handling, classroom template, and Agent responsibility.

**Tech Stack:** Markdown Skills and Agent prompts, Pi/TypeScript workflow runtime, Bun tests for executable runtime behavior only.

## Global Constraints

- Execute from a clean branch based on `origin/main` (`c8f7e87`; teaching implementation parent `98bee4c`).
- Bring `docs/superpowers/specs/2026-07-23-subagent-evidence-recall-design.md` from commit `d4e6640` into the execution branch before implementing Task 1.
- Do not change card YAML, Trace schema, BKT projection, Roadmap/Plan/Lesson Markdown formats, or public MCP tool contracts.
- Do not add tests for Skill prose, Agent prose, headings, fixed phrases, forbidden words, or Markdown substring presence.
- Delete existing tests whose only purpose is to lock Skill or Agent wording.
- Tests are allowed only for executable TypeScript, machine-read schemas/frontmatter, tool registration, persistence, and runtime behavior.
- Preserve the student's authority to pause, request help, reject memory proposals, and close a Lesson or Plan.
- Preserve honest active Trace, `supersedes`, actual support dependence, student-confirmed method evidence, and source-backed card authenticity.
- Do not introduce a new permanent Agent, database, rule engine, retry loop, compatibility layer, or defensive fallback subsystem.

---

## Target Authority Map

| Concern | Pi authority | Claude plugin authority |
|---|---|---|
| Role/session ownership and tool-turn presentation | `resources/agents/coach.md`, `resources/agents/tutor.md` | `agents/study-coach.md`, `agents/lesson-designer.md` |
| Tutor evidence, method mapping and correction | `tutor-lesson/SKILL.md` | new `run-lesson/references/evidence-protocol.md` |
| Reveal levels and no-spoiler behavior | concise section in `tutor-lesson/SKILL.md` | `prepare-next-lesson/references/reveal-policy.md` |
| Genuine alternative route | concise section in `tutor-lesson/SKILL.md` | concise definition in `run-lesson/SKILL.md`; no persistence claim until a plugin tool exists |
| Classroom composition and default card counts | `coach-study/SKILL.md` | `prepare-next-lesson/references/classroom-templates.md` |
| Plan-scale evidence retrieval | Evidence Scout workflow | Claude `Agent`/dynamic retrieval returning compact sources; no parent evidence matrix |

## Files Added

- `apps/pi-teaching-web/resources/subagents/tools/study-readonly-tools.ts`
- `plugins/highschool-study/skills/run-lesson/references/evidence-protocol.md`

## Files Deleted

- `apps/pi-teaching-web/tests/runtime/deep-workflow-skill.test.ts`

## Files Modified

- `AGENTS.md`
- `docs/zh-CN/完整说明书.md`
- `docs/superpowers/specs/2026-07-23-subagent-evidence-recall-design.md`
- `apps/pi-teaching-web/src/runtime/study-tools.ts`
- `apps/pi-teaching-web/src/workflows/contracts.ts`
- `apps/pi-teaching-web/src/workflows/runtime.ts`
- `apps/pi-teaching-web/resources/subagents/study-scout.md`
- `apps/pi-teaching-web/resources/agents/coach.md`
- `apps/pi-teaching-web/resources/agents/tutor.md`
- `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- `apps/pi-teaching-web/resources/skills/deep-workflow/SKILL.md`
- `apps/pi-teaching-web/tests/runtime/subagent-path.test.ts`
- `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
- `apps/pi-teaching-web/tests/workflows/runtime.test.ts`
- `plugins/highschool-study/agents/study-coach.md`
- `plugins/highschool-study/agents/lesson-designer.md`
- `plugins/highschool-study/skills/run-lesson/SKILL.md`
- `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
- `plugins/highschool-study/skills/prepare-next-lesson/references/reveal-policy.md`
- `plugins/highschool-study/skills/close-lesson-reflection/SKILL.md`
- `plugins/highschool-study/skills/consolidate-plan-memory/SKILL.md`
- `plugins/highschool-study/skills/correct-learning-record/SKILL.md`
- `plugins/highschool-study/skills/enter-learning-set/SKILL.md`
- `plugins/highschool-study/skills/inspect-progress/SKILL.md`
- `plugins/highschool-study/skills/recall-study-memory/SKILL.md`
- `plugins/highschool-study/skills/study/SKILL.md`
- `plugins/highschool-study/skills/enter-learning-set/references/personas/calm-senpai.md`
- `plugins/highschool-study/skills/enter-learning-set/references/personas/energetic-classmate.md`
- `plugins/highschool-study/skills/enter-learning-set/references/personas/neutral-tutor.md`
- `plugins/highschool-study/tests/contract/agent-and-skills.test.ts`

## Files Intentionally Left Alone

- `plugins/highschool-study/skills/start-or-revise-roadmap/SKILL.md`
- `plugins/highschool-study/skills/prepare-next-lesson/references/classroom-templates.md`
- all card, graph, learning-set, projection and frontend files not listed above

---

### Task 1: Complete the Evidence Scout retrieval prerequisite

**Files:**
- Add: `apps/pi-teaching-web/resources/subagents/tools/study-readonly-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/study-tools.ts`
- Modify: `apps/pi-teaching-web/src/workflows/contracts.ts`
- Modify: `apps/pi-teaching-web/src/workflows/runtime.ts`
- Modify: `apps/pi-teaching-web/resources/subagents/study-scout.md`
- Modify: `apps/pi-teaching-web/tests/runtime/subagent-path.test.ts`
- Modify: `apps/pi-teaching-web/tests/workflows/runtime.test.ts`

**Produces:**

```ts
export type EvidenceCardIndexEntry = {
  cardPath: string;
  title: string | null;
  goal: string | null;
  methods: {
    primary: string | null;
    secondary: string[];
  };
  reason: string;
  traceRefs: string[];
};

export type WorkflowTaskResult = {
  card_index?: EvidenceCardIndexEntry[];
  findings: string[];
  evidence_refs: string[];
  recommended_action: string;
  risks: string[];
};
```

- [ ] **Step 1: Extract the three read-only domain tools**

Refactor `study-tools.ts` so `card_search`, `trace_search`, and `source_resolve` are produced by an exported `createReadOnlyStudyTools(root)` function. `createStudyTools(root, now, context)` returns those three tools plus the existing session-bound `trace_append`. Do not change their names, parameters, result shape, or domain implementation.

- [ ] **Step 2: Register the tools only in Evidence Scout child sessions**

Create `resources/subagents/tools/study-readonly-tools.ts`. Its default Pi extension registers the result of `createReadOnlyStudyTools(process.cwd())`; the child process is launched with the learning-set root as its working directory.

Update `study-scout.md` frontmatter to:

```yaml
tools: read, grep, find, ls, card_search, trace_search, source_resolve
subagentOnlyExtensions: ./tools/study-readonly-tools.ts
```

Do not grant `trace_append`, `write`, `edit`, `bash`, `subagent`, `classroom_update`, or `deep_workflow_propose`.

- [ ] **Step 3: Extend the compact workflow result**

Add the optional `card_index` type above. Update `parseTaskResult()` to accept omission, or validate every present entry without repairing or inferring fields. Preserve compatibility for non-evidence workflows that return only the existing four fields.

Update `promptFor()` so an Evidence Scout may return `card_index`, while ordinary workflow tasks may omit it. Do not put full card YAML, solutions, or child transcripts into the parent result.

- [ ] **Step 4: Keep tests on executable behavior, not prompt text**

In `subagent-path.test.ts`, remove assertions that inspect `study-scout.md` prose or exact frontmatter strings. Keep the environment-path behavior check.

Add runtime tests that:

- parse and preserve a valid `card_index`;
- reject a malformed entry;
- still accept a result without `card_index`;
- persist and restore the compact result;
- expose only `card_search`, `trace_search`, and `source_resolve` from `createReadOnlyStudyTools`.

Do not add a test that searches Skill or Agent Markdown for these names.

- [ ] **Step 5: Verify the executable prerequisite**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/workflows/runtime.test.ts tests/runtime/subagent-path.test.ts
bun run typecheck
```

Expected: targeted runtime tests pass and TypeScript reports no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/pi-teaching-web/src/runtime/study-tools.ts \
  apps/pi-teaching-web/src/workflows/contracts.ts \
  apps/pi-teaching-web/src/workflows/runtime.ts \
  apps/pi-teaching-web/resources/subagents \
  apps/pi-teaching-web/tests/runtime/subagent-path.test.ts \
  apps/pi-teaching-web/tests/workflows/runtime.test.ts
git commit -m "feat: isolate plan evidence recall"
```

---

### Task 2: Reduce Pi Tutor to teaching decisions

**Files:**
- Modify: `apps/pi-teaching-web/resources/agents/tutor.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`

- [ ] **Step 1: Keep the Tutor Agent prompt at the role boundary**

Retain only:

- one Lesson per Tutor Session;
- load `tutor-lesson`;
- Student View only;
- session-bound writes with no `lessonPath` or `cardStepId`;
- tool-only turns and one post-result student message;
- no Roadmap, Plan, or profile edits.

Delete duplicated attribution ladders, method-status instructions, alternative transactions, fixed labels, and teaching-response rules. Those belong to the Skill or real tool schema.

- [ ] **Step 2: Rewrite Tutor Skill around five short sections**

The replacement Skill must express these semantics without fixed phrases or parameter tutorials:

1. **Classroom flow:** read the current Lesson, present only the active Student View, honor pause/close first, and advance Blocks through the classroom tools.
2. **Reveal:** `zero` gives no unsolicited cue; an explicit help request receives the requested amount of information; Level 1 points to a relevant place or condition, Level 2 may name an operation or method class, Level 3 may give one key intermediate expression, and a full solution requires an explicit request. Do not require one sentence or ban verbs.
3. **Evidence:** freeze the student's own mathematical claims before judging; correctness, actual help dependence, and method mapping are separate; a Tutor-origin decisive item makes support `tutor`; ambiguous influence is asked naturally; revisions supersede the active attempt.
4. **Methods and objections:** card methods are candidates only; exact student-confirmed mapping contributes method evidence; otherwise keep it unmapped. Rejecting a proposed node does not create a correction Trace unless an active Trace actually contains false evidence. Accepted assessment objections do supersede the mistaken Trace before summaries.
5. **Routes and alternatives:** verify the student's complete chain before rejecting it; correct non-reference work is affirmed without automatically showing the reference solution. A genuine alternative changes the complete core route of at least one whole question/part. In Pi, persist it after the source Trace through the real `card_alternative_append` tool. Do not hard-code `question=整题`, dataset-specific graph nodes, retry counts, or re-append loops.

Keep Lesson closure, but rely on the real `lesson_close` schema instead of restating all parameters.

- [ ] **Step 3: Remove prose contract tests**

From `session-factory.test.ts`, delete tests and assertions that read `tutor.md`, `coach.md`, or any `SKILL.md` and search for teaching phrases. Keep executable tests for `roleToolNames`, `deepModeToolNames`, session lifecycle, and tool availability.

No replacement prompt-string tests are created.

- [ ] **Step 4: Editorially review**

Read both final Markdown files completely. Confirm that there is no exact attribution question, Level-1 sentence template, action-verb blacklist, dataset-specific node, parameter blacklist, or duplicate tool-turn protocol in the Skill.

- [ ] **Step 5: Commit**

```bash
git add apps/pi-teaching-web/resources/agents/tutor.md \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  apps/pi-teaching-web/tests/runtime/session-factory.test.ts
git commit -m "refactor: simplify pi tutor guidance"
```

---

### Task 3: Move Pi Coach retrieval behind Evidence Scout

**Files:**
- Modify: `apps/pi-teaching-web/resources/agents/coach.md`
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/deep-workflow/SKILL.md`

- [ ] **Step 1: Simplify Coach Agent prompt**

Retain Plan ownership, source authenticity, Lesson preparation authority, `plan_update` persistence, private evidence, tool-only turns, and no classroom writes. Delete the evidence-matrix recipe and any teaching policy duplicated from `coach-study`.

- [ ] **Step 2: Rewrite Coach Skill**

Use the following flow:

1. Read Roadmap, current Plan, confirmed profiles, source-linked summaries, and planner attention only for preparation.
2. Use direct lookup for one known card or the current Lesson. For multi-card, cross-Lesson, or Plan-wide evidence questions, run one Quick Workflow Evidence Scout. Pass the evidence question and Plan/Lesson scope, not prefetched card/Trace payloads.
3. Consume `card_index`, `findings`, `evidence_refs`, `recommended_action`, and `risks`. Refine one returned card directly only when it could change the teaching decision. Do not rerun the same broad parent search.
4. Apply the literal Plan capability standard and active Trace; card methods remain reference structure and Trace methods remain student evidence.
5. Agree on lesson direction, search authentic unused cards, and write flexible no-spoiler Blocks. Card-count ranges live only in the classroom template, not as a Coach rule.
6. After a final decision, call `plan_update` once, reread the Plan, and report from the reread state.

Delete `trace_search(limit: 100)`, the ten-column matrix, fixed “new-structure transfer check” copy, exact field tutorials already present in tool schemas, and duplicated tool-turn prose.

- [ ] **Step 3: Rewrite Deep Workflow Skill**

State:

- deep-mode toggle remains the global workflow switch;
- one Evidence Scout is allowed for heavy Plan-scale retrieval even without two independent analytical lenses;
- multiple tasks require genuinely independent questions that could change the next action;
- the child discovers its own real sources and returns compact results;
- the parent remains the only decision-maker and writer;
- deep proposals still require student confirmation.

Delete parent prefetch, role catalogs, `12,000 Token / 45 seconds` prose, and transcript/security wording already guaranteed by runtime projection.

- [ ] **Step 4: Editorially review and commit**

Confirm Coach no longer instructs the parent to construct a Plan-wide evidence matrix, and Deep Workflow no longer requires two agents for ordinary evidence recall.

```bash
git add apps/pi-teaching-web/resources/agents/coach.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/deep-workflow/SKILL.md
git commit -m "refactor: delegate pi evidence recall"
```

---

### Task 4: Establish one Claude-plugin evidence authority

**Files:**
- Add: `plugins/highschool-study/skills/run-lesson/references/evidence-protocol.md`
- Modify: `plugins/highschool-study/skills/run-lesson/SKILL.md`
- Modify: `plugins/highschool-study/skills/prepare-next-lesson/references/reveal-policy.md`
- Modify: `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
- Modify: `plugins/highschool-study/skills/close-lesson-reflection/SKILL.md`
- Modify: `plugins/highschool-study/skills/inspect-progress/SKILL.md`
- Modify: `plugins/highschool-study/skills/recall-study-memory/SKILL.md`

- [ ] **Step 1: Write the concise evidence reference**

`evidence-protocol.md` contains only:

- active Trace is the evidence source;
- freeze the student's claims before assessment;
- correctness, support and actual method are separate;
- support records decisive help actually used;
- card-declared methods are reference candidates, while active Trace methods are student evidence;
- a revised attempt supersedes the active attempt;
- accepted assessment objections supersede false evidence;
- same-card aided history prevents claiming unseen transfer;
- missing or conflicting evidence remains unresolved.

Do not include tool parameter placement, fixed student questions, dataset examples, retry rules, or Plan matrices.

- [ ] **Step 2: Make reveal policy the only reveal authority**

Keep Student View, `zero`, `ladder`, `worked-example`, no-spoiler preparation, and explicit full-solution consent. Remove Trace writes, support attribution, retries, the fixed Level-1 sentence, the one-sentence limit, and the action-verb blacklist.

- [ ] **Step 3: Rewrite `run-lesson` as orchestration**

It should:

- recall teaching context;
- read `reveal-policy.md` and `evidence-protocol.md`;
- resume/activate ActivityBlocks and maintain Task projection;
- present only Student View;
- respond according to student help intent;
- record Trace and corrections according to the evidence reference;
- verify non-reference routes before rejecting them;
- define a genuine alternative as a complete, materially different route for one whole question/part;
- never claim it persisted an alternative because this plugin has no alternative writer;
- avoid automatically dumping the standard solution;
- route pause/close to reflection.

Delete the duplicated A+C ladder, fixed reveal wording, hard-coded graph nodes, tool-schema tutorial, retry instructions, impossible alternative-writer transaction, and tool-turn boilerplate already owned by the Agent.

- [ ] **Step 4: Clean planning, recall, closure and progress**

`prepare-next-lesson`:

- use a retrieval Agent for cross-card/Plan evidence and receive compact paths/reasons;
- keep authentic card selection, video verification, flexible Blocks, no-spoiler outline, and required Lesson closing headings;
- remove parent matrices, two-search gates, fixed student copy, duplicate card counts, and raw JSON instructions.

`close-lesson-reflection`:

- read only current Lesson evidence and optional reflection;
- offer continue/adjust/pause/close only when the student has not already chosen;
- honor explicit pause/close immediately;
- persist Lesson state, but leave Plan-wide audit to Coach routing.

`inspect-progress`:

- use active Trace methods as student method evidence;
- treat card methods only as reference metadata;
- answer the student's requested scope rather than always dumping every dimension.

`recall-study-memory`:

- keep the Roadmap/Plan/Lesson summary hierarchy, confirmed profiles, planner attention for preparation only, card/Trace bidirectional lookup, and source drill-down;
- use retrieval delegation for cross-card/Plan searches;
- remove two-independent-search and raw JSON requirements.

- [ ] **Step 5: Editorially review and commit**

```bash
git add plugins/highschool-study/skills/run-lesson \
  plugins/highschool-study/skills/prepare-next-lesson \
  plugins/highschool-study/skills/close-lesson-reflection/SKILL.md \
  plugins/highschool-study/skills/inspect-progress/SKILL.md \
  plugins/highschool-study/skills/recall-study-memory/SKILL.md
git commit -m "refactor: centralize teaching evidence guidance"
```

---

### Task 5: Remove remaining routing, memory and persona bloat

**Files:**
- Modify: `plugins/highschool-study/agents/study-coach.md`
- Modify: `plugins/highschool-study/agents/lesson-designer.md`
- Modify: `plugins/highschool-study/skills/consolidate-plan-memory/SKILL.md`
- Modify: `plugins/highschool-study/skills/correct-learning-record/SKILL.md`
- Modify: `plugins/highschool-study/skills/enter-learning-set/SKILL.md`
- Modify: `plugins/highschool-study/skills/study/SKILL.md`
- Modify: three bundled persona files

- [ ] **Step 1: Keep Agent prompts at role and permission boundaries**

`study-coach.md` keeps the single student-facing entry, routing through Skills, source authenticity, session-only workflow artifacts, persona presentation boundary, and one concise tool-turn rule.

`lesson-designer.md` keeps preparation-only status, authentic cards/materials, Student View versus Teacher Control, verified external video requirements, and no learner-record writes. Replace “at least two independent searches” with retrieval delegation only when direct context is insufficient or Plan-scale evidence would pollute the parent context.

- [ ] **Step 2: Simplify Plan memory consolidation**

Default to Plan/Lesson summaries plus source references; open full Lesson records only when a candidate memory requires them. Keep the proposed add/revise/delete table and explicit student confirmation.

Replace the profile field blacklist with:

> Profiles contain only confirmed, durable, currently valid preferences with direct sources and narrow scope.

When the student rejects a proposed memory inference, remove or rewrite that candidate. Do not append a cardless classroom Trace solely to preserve a rejected memory proposal.

Keep final Plan persistence and reread, without restating every transaction field already owned by the Plan-writing workflow.

- [ ] **Step 3: Simplify correction, entry and routing**

`correct-learning-record`: retain superseding Trace, source honesty, and projection rebuild; delete speculative lists of compatibility databases, background jobs, and alternate stores.

`enter-learning-set`: run only at session entry, missing context, explicit overview request, or persona change. Remove per-turn Grep over all Lesson Trace headings. Compress deterministic persona resolution and keep one global rule that persona changes presentation only.

`study`: invoke entry only when the session lacks learning-set context. Route paused Lessons to their saved point; leave the detailed teaching behavior to `run-lesson`.

- [ ] **Step 4: Deduplicate personas**

Remove the repeated “Presentation only” boundary from the three bundled persona files because `enter-learning-set` owns it. Keep each persona's actual voice. Collapse repeated safety prose to one short line only where it materially distinguishes the persona.

- [ ] **Step 5: Editorially review and commit**

```bash
git add plugins/highschool-study/agents \
  plugins/highschool-study/skills/consolidate-plan-memory/SKILL.md \
  plugins/highschool-study/skills/correct-learning-record/SKILL.md \
  plugins/highschool-study/skills/enter-learning-set \
  plugins/highschool-study/skills/study/SKILL.md
git commit -m "refactor: simplify study routing and memory guidance"
```

---

### Task 6: Delete tests that lock prose

**Files:**
- Modify: `plugins/highschool-study/tests/contract/agent-and-skills.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/subagent-path.test.ts`
- Delete: `apps/pi-teaching-web/tests/runtime/deep-workflow-skill.test.ts`

- [ ] **Step 1: Remove Skill and Agent body assertions**

Delete assertions for:

- fixed hint sentences and forbidden verbs;
- exact paragraph order;
- dataset-specific method-node examples;
- evidence matrices and `trace_search(limit: 100)`;
- alternative-writer prose;
- tool narration phrases;
- persona wording;
- presence or absence of natural-language teaching sentences.

- [ ] **Step 2: Keep only machine behavior**

In `agent-and-skills.test.ts`, retain only checks that parse machine-read frontmatter when they enforce an actual permission boundary not covered by plugin validation. Remove the `read()`/`expectInOrder()` prose-contract surface if no remaining executable check needs it.

In `session-factory.test.ts`, retain constructor compatibility, role tool arrays, deep-mode tool activation, and session lifecycle behavior.

In `subagent-path.test.ts`, retain environment path composition only.

- [ ] **Step 3: Do not replace deleted assertions**

No snapshot, golden prompt, forbidden-word, required-heading, substring, or model-evaluation test replaces them. Future teaching failures should first be reproduced in a real lesson and fixed in the single relevant authority.

- [ ] **Step 4: Run the existing executable suite**

This run verifies that deleting prose tests did not damage code behavior; it does not evaluate Skill text.

```bash
cd plugins/highschool-study
bun test
bun run typecheck

cd ../../apps/pi-teaching-web
bun test --path-ignore-patterns='tests/e2e/**'
bun run typecheck
```

Expected: all remaining executable tests and both typechecks pass.

- [ ] **Step 5: Commit**

```bash
git add plugins/highschool-study/tests/contract/agent-and-skills.test.ts \
  apps/pi-teaching-web/tests/runtime/session-factory.test.ts \
  apps/pi-teaching-web/tests/runtime/subagent-path.test.ts
git commit -m "test: stop locking teaching prose"
```

---

### Task 7: Final editorial verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/zh-CN/完整说明书.md`
- Review: all Markdown files changed in Tasks 2–5.

- [ ] **Step 1: Update current repository guidance**

In `AGENTS.md`:

- permit one read-only Evidence Scout for Plan-scale context isolation without requiring two analytical views;
- retain the two-independent-view requirement for genuinely multi-view workflows;
- require paired Pi/plugin teaching-rule edits, but explicitly prohibit prose contract tests and require tests only for executable behavior.

In `docs/zh-CN/完整说明书.md`:

- document isolated Plan-scale Evidence Scout recall and compact `card_index` handoff;
- keep whole-card `question=整题` normalization as Pi tool behavior, while keeping that parameter tutorial out of Tutor Skills;
- replace rigid “correct then say only correct and stop” wording with “confirm correctness, follow student intent, and do not automatically dump the reference solution”;
- describe Plan memory consolidation as summary-first with source drill-down instead of unconditional full-record loading.

- [ ] **Step 2: Search for known stale instructions**

Run:

```bash
rg -n \
  '刚才的提示是否对你最终使用的关键步骤起了作用|一级提示：只看你刚才写出的|含参数分类讨论.*requires|局部逼近与找点.*requires|trace_search.*limit.*100|criterion \\| lesson/block|question.*整题|12,000 Token|45 seconds|at least two independent searches' \
  apps/pi-teaching-web/resources \
  plugins/highschool-study/agents \
  plugins/highschool-study/skills
```

Expected: no match, except a statement in an intentionally retained historical design document outside these directories.

- [ ] **Step 3: Check impossible plugin tools**

Run:

```bash
rg -n 'card_alternative_append|alternative writer' plugins/highschool-study
```

Expected: no Skill or Agent instruction claims the Claude plugin can call such a tool.

- [ ] **Step 4: Measure, do not enforce, text reduction**

Run:

```bash
wc -w \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/deep-workflow/SKILL.md \
  plugins/highschool-study/skills/run-lesson/SKILL.md
```

Review target: Tutor and `run-lesson` are roughly half their previous size; Coach and Deep Workflow contain no copied tool schema or evidence matrix. These are editorial observations, not test thresholds.

- [ ] **Step 5: Read every changed Markdown file completely**

Check:

- every policy has one authority per runtime;
- references point to real files;
- no kept core rule was lost;
- no instruction demands a nonexistent tool;
- no Skill repeats tool parameter schema;
- no fixed student sentence or word blacklist remains;
- student control, source truth, active Trace and confirmed-memory boundaries remain explicit.

- [ ] **Step 6: Validate packaging**

Run:

```bash
cd plugins/highschool-study
bun run validate:plugin

cd ../../apps/pi-teaching-web
bun run build
```

Expected: Claude plugin validation and Pi frontend build succeed.

- [ ] **Step 7: Commit any final editorial corrections**

```bash
git add AGENTS.md docs/zh-CN/完整说明书.md \
  apps/pi-teaching-web/resources plugins/highschool-study
git commit -m "docs: finish teaching skill cleanup"
```

Skip this commit if Task 7 produces no correction.

---

## Completion Criteria

- Evidence Scout performs Plan-scale card/Trace retrieval in its child session and returns compact, source-linked `card_index` results.
- Parent Coach/Tutor no longer preloads complete Plan-scale card and Trace payloads before delegation.
- Pi Tutor and Claude `run-lesson` no longer contain fixed prompt sentences, verb blacklists, dataset-specific method examples, tool parameter tutorials, or duplicated transaction prose.
- Claude `run-lesson` no longer claims an unavailable alternative-persistence tool.
- `inspect-progress` uses active Trace methods as student-method evidence.
- explicit pause/close is honored without a redundant choice prompt.
- rejected long-term memory proposals do not become classroom Trace.
- one reveal authority and one evidence authority exist per runtime.
- no automated test asserts teaching prose or prompt wording.
- executable runtime tests, typechecks, plugin validation, and Pi build pass.
