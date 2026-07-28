# Coach Inquiry and Longitudinal Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make first-cycle planning, cross-Plan planning, and every Lesson preparation begin with a natural, evidence-aware Coach inquiry that produces an actionable and revisable teaching judgment, then validate that behavior across one six-Lesson Plan and three Lessons of a second Plan.

**Architecture:** Keep the existing Markdown-first facts, two teaching roles, Session ownership, tool surfaces, and runtime assembly unchanged. Add the inquiry method only to the six existing Pi and Claude plugin Skills that own Roadmap planning, next-cycle planning, and Lesson preparation. Update current behavior documentation, run deterministic package checks, then freeze one commit and exercise the normal Pi Web flow against a copied derivative learning set with one fixed DeepSeek model.

**Tech Stack:** Markdown Skills and documentation, Claude Code plugin validation, Bun, TypeScript checks, Pi teaching web, DeepSeek through the existing local Pi provider configuration, local browser acceptance.

## Global Constraints

- Authoritative design:
  `docs/superpowers/specs/2026-07-28-coach-inquiry-and-longitudinal-validation-design.md`.
- Do not add an Agent, MCP/Pi tool, questionnaire schema, persistent field,
  rule engine, runtime branch, or frontend control.
- Do not change `examples/derivative-demo/learning-set/**` during real-model
  acceptance. All model writes go to a fresh `/tmp` copy.
- Do not add tests for Skill prose, exact phrases, headings, keywords, or
  question counts. Verify prose by review and real-model behavior.
- Keep Pi and Claude plugin teaching semantics aligned, but retain their native
  tool, Session, and filesystem language.
- Ask one question per Coach turn. Each consultation normally contains several
  useful questions, but no fixed count or fixed questionnaire.
- A student may explicitly stop the inquiry. “你来安排” ends the current line
  of questioning, not automatically every other useful inquiry angle.
- Do not expose or persist the fictional student's hidden profile.
- Freeze prompts before the formal longitudinal run. Do not patch Skills in the
  middle of that run.
- Preserve unrelated untracked files:
  `.superpowers/` and
  `docs/superpowers/plans/2026-07-22-three-lesson-teaching-quality-optimization.md`.
- Never print, copy, commit, or quote provider credentials or raw Pi Session
  JSONL.

---

### Task 1: Add the inquiry method to all six semantic owners

**Files:**

- Modify:
  `apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md`
- Modify:
  `apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md`
- Modify:
  `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify:
  `plugins/highschool-study/skills/start-or-revise-roadmap/SKILL.md`
- Modify:
  `plugins/highschool-study/skills/plan-next-cycle/SKILL.md`
- Modify:
  `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`

- [x] **Step 1: Read the Skill-writing constraints and re-open all six owners**

Read `superpowers:writing-skills` completely before editing. Re-open all six
files and confirm that:

- Roadmap owners create the first cycle;
- next-cycle owners compare accumulated history;
- Plan Coach / prepare-next-lesson own ordinary Lesson preparation;
- Tutor Skills are out of scope.

- [x] **Step 2: Add first-cycle inquiry to Pi Roadmap Study**

In
`apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md`, place a compact
`## Inquire before proposing` section after context reading and before scope or
publishing. It must express this behavior without becoming a questionnaire:

```text
Before proposing a first or revised direction, conduct a short multi-turn
consultation. Ask one question per turn and normally ask several useful
questions. Files can preserve history, but they cannot replace the student's
current account, intent, constraints, or interpretation.

Generate the next question from the student's latest answer. Find the broadest
ambiguous phrase whose possible meanings would change the teaching action.
Clarify its type, situation, stuck step, recent concrete example, or attempted
approach before asking about causes or offering a diagnosis. Do not put an
unverified Coach hypothesis inside the question, repeat settled facts, or batch
several questions into a form.

Continue until goal, starting pattern, desired change, practical constraints,
and a direct success test are clear enough to act on. The student may stop the
inquiry; then proceed with explicit uncertainty. Before proposing, summarize
what the student said and the working judgment, and invite correction.
```

Add a short insight rule near Plan publication:

```text
A useful working judgment distinguishes explanations that would produce
different Plans, cites the student words or sources that support it, changes a
real Plan choice, and names later evidence that would support or overturn it.
Do not use a stable personality label or a generic “practice more” restatement.
```

Keep existing goal, capability standard, direct test, registration, and scope
rules intact.

- [x] **Step 3: Add cross-Plan re-inquiry to Pi Plan Next Cycle**

In
`apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md`, add an inquiry
section after evidence reconstruction and before choosing a leverage point.
Require the Roadmap Coach to:

1. use history to decide what does not need to be asked again;
2. still ask the student about their current interpretation, priority,
   constraints, and desired next change;
3. derive each next question from the latest ambiguous student phrase;
4. clarify type/context/step/example/attempt before causal diagnosis;
5. ask one question at a time and normally several questions;
6. summarize the combined history and current account, then invite correction;
7. produce a four-part working judgment: distinction, source, changed action,
   and support/overturn signal.

Keep Evidence Scout optional and read-only. Do not make “evidence is sufficient”
a reason to skip current-student inquiry.

- [x] **Step 4: Insert Lesson-preparation inquiry into the Pi Coach sequence**

In
`apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`, preserve the
existing post-Lesson `plan_update` and reread order, then make the preparation
sequence explicit:

```text
finish and persist Plan review
  → read current evidence
  → conduct a short multi-turn preparation consultation
  → form an actionable, revisable Lesson judgment
  → explain a no-spoiler Lesson intent
  → student confirms or adjusts
  → derive task functions and retrieve authentic cards
  → lesson_prepare
```

The preparation inquiry must:

- ask one question per turn and normally several useful questions;
- start from the student's latest broad phrase;
- clarify type, situation, stuck step, recent example, or attempted route
  before diagnosing cause;
- seek current experience, intent, energy/time, difficulty, or support
  preference only when the answer may alter this Lesson;
- stop when the student explicitly asks to stop, while preserving uncertainty;
- avoid repeating a fixed per-Lesson questionnaire.

The resulting Lesson judgment must distinguish plausible explanations, cite
student words or active evidence, alter the cognitive change/template/task
function/pace/support/test, and state what later response would overturn it.
Move task-function derivation and broad card retrieval after the student's
no-spoiler approval.

- [x] **Step 5: Add the same teaching semantics to the Claude plugin owners**

Update the three plugin Skills with the same behavior:

- `start-or-revise-roadmap`: first-cycle multi-turn inquiry, latest-phrase
  question generation, neutral clarification before diagnosis, summary and
  correction before the proposed diff, and the four-part insight standard.
- `plan-next-cycle`: current-student re-inquiry after compact historical
  reconstruction, without replacing native `source_resolve` or delegated
  retrieval language.
- `prepare-next-lesson`: Plan review first, then inquiry and a no-spoiler
  proposed Lesson intent, then student adjustment/confirmation, task functions,
  authentic card search, and file writing.

Do not copy Pi-only names such as `lesson_prepare`, Session owner errors, or
runtime receipts into the plugin Skills. Do not add plugin-only MCP signatures
to Pi Skills.

- [x] **Step 6: Review the six-file semantic matrix**

Run:

```bash
git diff -- \
  apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  plugins/highschool-study/skills/start-or-revise-roadmap/SKILL.md \
  plugins/highschool-study/skills/plan-next-cycle/SKILL.md \
  plugins/highschool-study/skills/prepare-next-lesson/SKILL.md
```

Review manually for this matrix:

| Decision | Pi owner | Plugin owner | Required order |
| --- | --- | --- | --- |
| First cycle | `roadmap-study` | `start-or-revise-roadmap` | inquire → summarize/correct → propose → confirm → persist |
| Next cycle | `plan-next-cycle` | `plan-next-cycle` | history → current inquiry → judgment → confirm → persist |
| Next Lesson | `coach-study` | `prepare-next-lesson` | review → inquiry → no-spoiler intent → confirm → retrieve/prepare |

Reject the edit if it introduces fixed question counts, bundled questions,
diagnosis-first leading prompts, personality labels, or a generic “strengthen
the weak point” judgment.

- [x] **Step 7: Check formatting**

Run:

```bash
git diff --check
```

Expected: exit code 0 with no output.

- [x] **Step 8: Commit the six semantic owners together**

```bash
git add \
  apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  plugins/highschool-study/skills/start-or-revise-roadmap/SKILL.md \
  plugins/highschool-study/skills/plan-next-cycle/SKILL.md \
  plugins/highschool-study/skills/prepare-next-lesson/SKILL.md
git commit -m "feat: add Coach inquiry before learning decisions"
```

---

### Task 2: Document the visible behavior without duplicating the protocol

**Files:**

- Modify: `apps/pi-teaching-web/README.md`
- Modify: `plugins/highschool-study/README.md`
- Modify: `docs/zh-CN/完整说明书.md`

- [x] **Step 1: Update the Pi frontend guide**

In `apps/pi-teaching-web/README.md`, add a concise subsection near “长期学情研判”
that explains:

- first Roadmap planning, cross-Plan planning, and each Lesson preparation begin
  with a short, one-question-at-a-time consultation;
- the next question follows the student's latest ambiguous phrase instead of a
  fixed form;
- the Coach clarifies the type/context/stuck step/recent example before
  diagnosing;
- it summarizes its understanding and offers a no-spoiler intent for correction
  before persisting or preparing;
- existing history reduces repeated questions but never replaces the student's
  current account.

Point to the three Pi Skills for operational details instead of copying their
full protocol.

- [x] **Step 2: Update the Claude plugin guide**

In `plugins/highschool-study/README.md`, add the same student-visible behavior
near the teaching frame:

- `study-coach` asks several short, adaptive questions one at a time before
  first-cycle planning, next-cycle planning, and Lesson preparation;
- questions start by clarifying the student's actual object and recent
  experience;
- a useful judgment must change a Plan or Lesson decision and remain
  revisable by later evidence.

Do not imply a form, score, automatic diagnosis, or new tool.

- [x] **Step 3: Update the current Chinese feature reference**

In `docs/zh-CN/完整说明书.md`, add one authoritative subsection,
`### Coach 问诊与教学判断`, in the section that explains Roadmap/Plan/Lesson
behavior. Cover:

1. the three trigger points;
2. one-question-at-a-time adaptive dialogue;
3. latest-phrase neutral clarification before hypothesis;
4. several useful questions without a fixed count;
5. student stop/adjust authority;
6. the four insight properties: distinction, source, changed action,
   support/overturn signal;
7. the exact preparation order from review through `lesson_prepare`.

Keep implementation details in the Skills and existing runtime/tool sections.

- [x] **Step 4: Review for protocol duplication and over-enumeration**

Run:

```bash
git diff -- \
  apps/pi-teaching-web/README.md \
  plugins/highschool-study/README.md \
  docs/zh-CN/完整说明书.md
git diff --check
```

The README additions should describe behavior, not reproduce every Skill rule.
The full manual may be more explicit, but it must still avoid a fixed question
list.

- [x] **Step 5: Commit documentation**

```bash
git add \
  apps/pi-teaching-web/README.md \
  plugins/highschool-study/README.md \
  docs/zh-CN/完整说明书.md
git commit -m "docs: explain adaptive Coach inquiry"
```

---

### Task 3: Run deterministic package verification

**Files:**

- Verify only; no new prose tests.

- [x] **Step 1: Verify the Claude plugin**

```bash
cd plugins/highschool-study
bun install --frozen-lockfile
bun run release:check
```

Expected:

- type checking passes;
- all existing tests pass;
- strict Claude plugin validation passes;
- the public MCP tool count remains exactly four.

- [x] **Step 2: Verify the Pi app**

```bash
cd apps/pi-teaching-web
bun install --frozen-lockfile
bun run check
```

Expected:

- TypeScript check passes;
- all non-E2E tests pass;
- production build succeeds.

Browser E2E is not required for the Skill-only implementation because no
route, projection, component, Session owner, or runtime behavior changed. The
formal real-model browser run below covers the affected conversational
behavior.

- [x] **Step 3: Confirm the public demo and unrelated files are untouched**

From the repository root:

```bash
git diff --exit-code HEAD -- examples/derivative-demo/learning-set
git status --short
```

Expected:

- no diff under the public demo learning set;
- only the two known unrelated untracked paths remain, plus no uncommitted
  implementation files.

---

### Task 4: Freeze and launch an isolated real-model acceptance workspace

**Files:**

- Do not modify: `examples/derivative-demo/learning-set/**`
- Runtime-only copy:
  `/tmp/studyforge-coach-inquiry-20260728-*/learning-set`

- [ ] **Step 1: Record the frozen implementation commit**

From the repository root:

```bash
git rev-parse HEAD
git status --short
```

Record the commit in the eventual audit. Do not begin if any implementation
file is uncommitted. The two known unrelated untracked paths do not enter the
run.

- [ ] **Step 2: Create the clean copy**

```bash
ACCEPT_ROOT="$(mktemp -d /tmp/studyforge-coach-inquiry-20260728-XXXXXX)"
cp -R examples/derivative-demo/learning-set "$ACCEPT_ROOT/learning-set"
find "$ACCEPT_ROOT/learning-set/plans" -type f ! -name '.gitkeep'
find "$ACCEPT_ROOT/learning-set/lessons" -type f ! -name '.gitkeep'
```

Expected: the last two commands print no Plan or Lesson files.

Record hashes before model traffic:

```bash
find examples/derivative-demo/learning-set -type f -print0 \
  | sort -z \
  | xargs -0 shasum -a 256 \
  | shasum -a 256
```

- [ ] **Step 3: Confirm the fixed model without exposing credentials**

Use the existing local Pi provider configuration. Record only:

```text
provider: deepseek
model: deepseek-v4-pro
thinking: one fixed level for all Coach and Tutor Sessions
message projection: safe
deep mode: off unless a Coach independently needs Evidence Scout
```

If the currently configured DeepSeek model name differs, choose one available
DeepSeek model once, record it, and keep it unchanged for the whole run. Never
print or copy the credential value.

- [ ] **Step 4: Start the frozen app on an unused port**

```bash
cd apps/pi-teaching-web
STUDY_LEARNING_SET="$ACCEPT_ROOT/learning-set" \
STUDY_WEB_PORT=65328 \
bun run start
```

Expected terminal output:

```text
StudyForge Pi Web: http://127.0.0.1:65328
```

If `65328` is occupied, select one other unused port, record it once, and use
that port for the complete run.

- [ ] **Step 5: Open the normal student interface**

Open:

```text
http://127.0.0.1:65328/
```

Use Student View only. Keep Teacher Control, raw-stream, private card answers,
hidden Plan 2 candidates, and raw Session JSONL outside the fictional
student's information.

---

### Task 5: Run Plan 1 as six complete Lesson cycles

**Files:**

- Runtime facts only:
  `$ACCEPT_ROOT/learning-set/ROADMAP.md`
  `$ACCEPT_ROOT/learning-set/plans/*.md`
  `$ACCEPT_ROOT/learning-set/lessons/*.md`
  `$ACCEPT_ROOT/learning-set/memory/*.md`

- [ ] **Step 1: Start the fictional student from one sentence**

In the Roadmap Coach, send only:

```text
我导数基础还可以，但综合题经常找不到入口，想系统提高一下。
```

Role-play 周亦航 consistently:

- high-performing grade 12 student;
- fluent basic derivative calculation;
- uncertain method selection and goal analysis;
- sometimes checks domain or parameters late;
- may over-transfer the most recent method;
- dislikes premature method disclosure;
- naturally hesitates, self-corrects, objects, tires, and asks to continue
  thinking.

Do not inject those hidden properties into any Agent or file. Reveal the wish
for an approximately six-Lesson first cycle only if the Coach naturally asks
about schedule.

- [ ] **Step 2: Audit the first Roadmap inquiry before confirming**

Continue naturally until the Coach proposes a first Plan. Record only compact
student-safe evidence that shows:

- questions were separate turns;
- the first questions clarified what “综合题” and “找不到入口” meant;
- a recent example or attempted route was requested before causal diagnosis;
- the Coach did not lead with “方法选择不稳定”;
- the Coach summarized its understanding and allowed correction;
- the Plan judgment distinguished plausible causes and altered the proposed
  cycle;
- goal, observable standard, direct test, and practical cycle were confirmed.

Reject or correct any misreading naturally. Confirm only a proposal that the
student would genuinely accept.

- [ ] **Step 3: Verify Plan 1 persistence**

After confirmation, verify through normal UI plus read-only filesystem
inspection:

```bash
find "$ACCEPT_ROOT/learning-set/plans" -type f ! -name '.gitkeep' -maxdepth 1
rg -n "^## (Goal|Observable Capability Standard|Test|Planning Basis|Lesson Index|Current Position|Next Lesson Candidate|Plan Summary)$" \
  "$ACCEPT_ROOT/learning-set/plans"
```

Expected: one registered active Plan with each required section exactly once,
a non-empty Planning Basis, and no pre-created Lesson.

- [ ] **Step 4: Run Lesson cycles 1–6**

For each Lesson, use this complete loop:

```text
Plan Coach reviews and persists the prior state
  → Plan Coach asks a multi-turn preparation inquiry
  → Coach states a no-spoiler Lesson intent
  → 周亦航 confirms or adjusts
  → Coach prepares a source-grounded Lesson
  → Tutor teaches in a separate Lesson Session
  → 周亦航 responds only from Student View and learned content
  → Tutor writes truthful Trace and closes only after student confirmation
  → return to the original Plan Coach for review
```

Do not pre-script exact Lesson topics or a forced success/failure sequence.
Allow the Coach to choose diagnostic, concept, deliberate practice,
remediation, assessment, or review according to accumulated evidence.

For each cycle record:

- inquiry question chain;
- the student's new current information;
- the Coach's working judgment;
- the exact Plan/Lesson action it changed;
- no-spoiler approval or student adjustment;
- authentic card paths used;
- whether help was requested and actually depended upon;
- active Trace outcome and actual route;
- next evidence that supported or overturned the judgment.

The student may ask to keep thinking, refuse a premature hint, challenge a
misreading, or end early when naturally appropriate. Do not manufacture
mistakes solely to satisfy the hidden profile.

- [ ] **Step 5: Handle runtime and model failures without corrupting the run**

Apply these rules throughout:

- DeepSeek transient failure: retry the same Session; do not switch model.
- A first tool argument error safely rejected and then recovered by the
  runtime: record once and continue; treat repetition as an observation.
- Fact-write, Session owner, route restoration, or persistence failure: stop
  the run; do not hand-edit the fact.
- Poor teaching judgment: record and continue when possible; do not patch the
  frozen Skill mid-run.
- A blocking runtime defect that must be fixed terminates the frozen run.
  Restart the affected cycle from a documented clean point after a verified
  fix; do not splice discontinuous traffic into one passing run.

- [ ] **Step 6: Audit Plan 1 completion honestly**

After Lesson 6, make the Plan Coach audit every original capability-standard
and Test item against active Trace.周亦航 confirms completion only if the
student genuinely agrees and all required evidence exists.

If the standard is not met:

- keep Plan 1 active or replanned;
- record `SIX_LESSONS_NOT_COMPLETE`;
- do not create Plan 2;
- proceed directly to the audit report with the failed longitudinal outcome.

If the standard is met:

- confirm completion;
- verify the Plan write and Roadmap status;
- complete the existing item-by-item long-term memory review;
- accept, rewrite, or reject each candidate as 周亦航 would;
- verify only accepted/rewritten preferences enter confirmed profiles.

---

### Task 6: Create Plan 2 and run three cross-cycle Lessons

**Files:**

- Runtime facts only under `$ACCEPT_ROOT/learning-set/**`

- [ ] **Step 1: Return to the original Roadmap Coach Session**

Navigate back to `/roadmap` and verify that the original Roadmap conversation
is restored without copying the Plan Coach or Tutor transcript.

- [ ] **Step 2: Run a genuine cross-Plan inquiry**

The evaluator privately keeps these possible directions:

1. method choice still unstable → cross-method decision and unfamiliar
   transfer;
2. method choice stable but proof closure weak → parameter boundaries and
   necessity/sufficiency;
3. both stable → multi-method comprehensive work and timed expression.

Do not reveal this list to the Roadmap Coach. Let it read compact Plan 1
history and ask 周亦航 about current interpretation, priority, constraints,
and desired next change. Verify that it:

- does not repeat stable background questions;
- still asks several current, one-at-a-time questions;
- follows ambiguous words down to type/context/example/attempt;
- summarizes history plus the student's present account;
- proposes a source-linked, actionable, revisable Plan 2;
- may choose a better fourth direction when evidence supports it.

Confirm only after correcting any material misunderstanding.

- [ ] **Step 3: Verify Plan 2 and its independent Plan Coach Session**

Verify:

- Plan 2 is registered under the same Roadmap;
- Plan 2 has the strict eight-section contract;
- its Planning Basis cites Plan 1 sources and current student statements;
- entering it creates/restores a different Plan Coach Session;
- no old transcript is copied into the new Session.

- [ ] **Step 4: Run three full Plan 2 Lesson cycles**

Repeat the normal preparation-inquiry, no-spoiler approval, Tutor Lesson,
Trace/close, and Plan review loop three times.

For each preparation verify:

- Plan 1 history changes an actual task, pace, support, test, or task function;
- the Coach does more than repeat the old summary;
- current student replies can revise the inherited judgment;
- new Plan 2 evidence can support or overturn Plan 1's interpretation;
- confirmed preferences guide presentation without becoming ability labels.

Plan 2 need not complete after three Lessons.

---

### Task 7: Write and verify the acceptance report

**Files:**

- Create:
  `docs/audits/2026-07-28-coach-inquiry-longitudinal-acceptance.md`

- [ ] **Step 1: Write the compact audit**

Include:

- frozen commit, branch, provider, model, thinking level, safe projection,
  port, and isolated learning-set root;
- source-demo hash before and after;
- Plan 1 Roadmap inquiry and six-Lesson table;
- Plan 1 completion and memory-review result;
- cross-Plan inquiry and hidden-candidate comparison;
- Plan 2 three-Lesson table when Plan 1 legitimately completed;
- source handles for decisive student statements, Plan sections, Lesson
  summaries, and active Trace;
- runtime/tool recoveries separated from teaching-quality observations;
- defects, root-cause category, and the smallest recommended follow-up.

Do not include credentials, hidden system prompts, raw Pi Session JSONL,
Teacher Control, private child output, or full transcripts.

- [ ] **Step 2: Grade against the design**

Use the four result dimensions:

```text
INQUIRY
INSIGHT
LONGITUDINAL_PERSONALIZATION
FACT_AND_PRODUCT_INTEGRITY
```

Each dimension is `PASS`, `PARTIAL`, or `FAIL`, with evidence. The overall
result may not be `PASS` if:

- Plan 1 is falsely completed;
- a formal consultation is skipped without student termination;
- history is merely repeated but never changes an action;
- facts are hand-edited to repair the run;
- Student View leaks Teacher Control or answers;
- the model changes mid-run.

- [ ] **Step 3: Verify repository and source-demo integrity**

From repository root:

```bash
git diff --check
git diff --exit-code HEAD -- examples/derivative-demo/learning-set
find examples/derivative-demo/learning-set -type f -print0 \
  | sort -z \
  | xargs -0 shasum -a 256 \
  | shasum -a 256
git status --short
```

The final hash must match the pre-run hash.

- [ ] **Step 4: Commit the audit**

```bash
git add docs/audits/2026-07-28-coach-inquiry-longitudinal-acceptance.md
git commit -m "test: record Coach inquiry longitudinal acceptance"
```

---

### Task 8: Final verification and handoff

**Files:**

- Verify all files changed by this plan.

- [ ] **Step 1: Re-run deterministic checks on final HEAD**

```bash
cd plugins/highschool-study
bun run release:check

cd ../../apps/pi-teaching-web
bun run check
```

- [ ] **Step 2: Review the final commit range**

From repository root:

```bash
git log --oneline --decorate -8
git diff --stat fef44a7..HEAD
git status --short
```

Expected:

- the design commit remains intact;
- one implementation commit covers all six semantic owners;
- one documentation commit explains current behavior;
- one acceptance commit records the frozen real-model result;
- the only unrelated untracked paths are the two pre-existing paths named in
  Global Constraints.

- [ ] **Step 3: Report the outcome**

Report:

- what changed in student-visible terms;
- deterministic check counts/results;
- the frozen DeepSeek longitudinal result;
- any remaining real issue, separated from harmless model variation;
- clickable links to the design, plan, six semantic owners, current manual,
  and acceptance audit.
