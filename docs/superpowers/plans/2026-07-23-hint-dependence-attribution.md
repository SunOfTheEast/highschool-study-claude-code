# Hint Dependence Attribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Tutor Trace `support` represent actual dependence on Tutor-provided decisive content, with one student attribution question only when directional influence is ambiguous.

**Architecture:** Keep the current Trace schema and runtime execution unchanged. Put the complete A+C attribution ladder in the Pi and public Tutor Skills, remove the contradictory “any hint means tutor support” copies from Agent/tool prompt metadata, and verify two isolated real-model branches: unused hint and adopted decisive hint. Keep the student-confirmation fallback in the contract, but do not force it with an ambiguous synthetic prompt.

**Tech Stack:** Markdown Agent/Skill contracts, TypeScript TypeBox prompt metadata, Bun tests, Pi native Session JSONL, Playwright-visible local UI, Markdown Trace storage.

## Global Constraints

- Canonical design: `docs/superpowers/specs/2026-07-23-hint-dependence-attribution-design.md`.
- `support` means actual dependence, not mere hint exposure.
- Use A first: decisive content first supplied by Tutor and later used means `support:tutor`; no adopted Tutor contribution means `support:none`.
- Use C only when a directional cue's influence cannot be determined from the mathematical content.
- The exact neutral question is `刚才的提示是否对你最终使用的关键步骤起了作用？`.
- Do not add fields, enums, tools, Agents, subagents, runtime validators, mutation guards or mathematical rules.
- Do not change `trace_append.execute`, Trace persistence, BKT aggregation, alternative storage or Session ownership.
- Skill is the complete source of attribution behavior; Agent and tool parameter metadata must remain short and non-contradictory.
- All real-model writes occur in fresh `/tmp/studyforge-hint-attribution-*` copies, never in repository `examples/derivative-demo/learning-set/**`.
- Never print credential files, API keys, private reasoning or full raw model thinking.

---

### Task 1: Replace the Pi Tutor's exposure rule with the A+C attribution ladder

**Files:**

- Modify: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- Modify: `apps/pi-teaching-web/resources/agents/tutor.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/src/runtime/study-tools.ts`

**Interfaces:**

- Consumes: existing `trace_append` fields `assessment`, `support`, `note` and `supersedes`.
- Produces: one canonical A+C Skill contract; a neutral `support` parameter description; unchanged TypeBox schema shape and unchanged execute behavior.

- [ ] **Step 1: Replace the old Pi contract assertions with failing A+C assertions**

In `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`, replace the assertions that require every numbered hint to remain `support:tutor` with:

```ts
expect(tutorSkill).toContain('Treat `support` as actual dependence, not hint exposure');
expect(tutorSkill).toContain(
  'If the final solution uses decisive content first supplied by the Tutor, write `support: tutor`',
);
expect(tutorSkill).toContain(
  'If the Tutor only repeats, locates or confirms content the student already produced, and the decisive content is student-produced, write `support: none`',
);
expect(tutorSkill).toContain(
  '刚才的提示是否对你最终使用的关键步骤起了作用？',
);
expect(tutorSkill).toContain(
  'Do not append the final correct Trace until the student answers this attribution question',
);
for (const source of [tutorAgent, tutorSkill]) {
  expect(source).not.toContain(
    'If the Tutor has sent any numbered hint since that active attempt began, `support` MUST be `tutor`',
  );
}
```

Keep the existing evidence-freeze, supersedes, tool-only and hint-ladder assertions.

In `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`, replace the old `support.description` assertions with:

```ts
expect(traceProperties.support?.description).toContain(
  'actual dependence on help used in this completed attempt',
);
expect(traceProperties.support?.description).toContain(
  'not whether a hint merely appeared in the Session',
);
expect(traceProperties.support?.description).not.toContain(
  'any Tutor hint already given',
);
```

Do not alter the existing assertions for property names, assessment evidence or supersedes.

- [ ] **Step 2: Run the Pi contract tests and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-factory.test.ts tests/runtime/study-tools.test.ts
```

Expected: FAIL because the Skills still contain the exposure rule and the tool description still says any Tutor hint requires `tutor`.

- [ ] **Step 3: Replace the Pi Skill provenance checklist with the exact A+C ladder**

In `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`, replace the current pre-`trace_append` provenance checklist and the unconditional hint-support sentence with this single canonical block immediately below `# Tutor Lesson`:

```markdown
Before every final `trace_append`, attribute help with this A+C ladder:

1. Treat `support` as actual dependence, not hint exposure. Extract the decisive method, operation, comparison object, transformation, intermediate expression and conclusion used in the student's final solution.
2. Compare those items with Tutor messages sent after the active Trace for the same card and Block. If the final solution uses decisive content first supplied by the Tutor, write `support: tutor`.
3. If the Tutor only repeats, locates or confirms content the student already produced, and the decisive content is student-produced, write `support: none`.
4. If the Tutor supplied only a directional cue and its influence cannot be determined from content, ask exactly: `刚才的提示是否对你最终使用的关键步骤起了作用？` Do not append the final correct Trace until the student answers this attribution question. A yes answer means `support: tutor`; a no answer means `support: none`.
5. Record one concise attribution reason in `note`. Student attribution resolves support only; it is not new mathematical evidence.
6. If an active Trace already exists for this card and Block, the final write remains a revision and MUST pass its exact event ID as `supersedes`.
```

In the numbered teaching procedure, retain the current evidence-freeze rules but delete these obsolete meanings wherever they appear:

```text
Tutor-provided work can change a later completed attempt to support:tutor merely because a hint occurred.
Record support:tutor after any Tutor hint even when the student finishes the rest independently.
```

Keep the rule that Tutor-provided decisive work cannot be represented as unsupported student evidence.

- [ ] **Step 4: Remove the contradictory Agent copy**

In `apps/pi-teaching-web/resources/agents/tutor.md`, delete the standalone three-item `Before every trace_append` checklist. Do not add the A+C ladder to the Agent. Keep the Agent's short instructions to load `tutor-lesson`, freeze student evidence and supersede a prior same-attempt Trace.

Expected ownership after this edit:

```text
Tutor Agent: load the Skill and respect tool-turn boundaries.
Tutor Skill: own the complete attribution decision.
```

- [ ] **Step 5: Make the tool parameter description neutral without changing its schema**

In `apps/pi-teaching-web/src/runtime/study-tools.ts`, replace only the `support` union description with:

```ts
description: 'Record actual dependence on help used in this completed attempt, not whether a hint merely appeared in the Session. Resolve ambiguous directional influence with the student before this tool call.',
```

Do not change the literals, optionality, object shape or `execute` block.

- [ ] **Step 6: Run the Pi target tests and verify GREEN**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-factory.test.ts tests/runtime/study-tools.test.ts
```

Expected: 19 tests pass, 0 fail. The exact count may increase only by tests added in Step 1; no existing test may be removed.

- [ ] **Step 7: Verify the TypeBox schema and execute path did not change**

Run:

```bash
git diff -- apps/pi-teaching-web/src/runtime/study-tools.ts
```

Expected: only the `support` description string changes; the literals `none`, `tutor`, `external` and the `execute` mapping remain byte-for-byte unchanged.

- [ ] **Step 8: Commit the Pi attribution contract**

```bash
git add \
  apps/pi-teaching-web/tests/runtime/session-factory.test.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts \
  apps/pi-teaching-web/resources/agents/tutor.md \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  apps/pi-teaching-web/src/runtime/study-tools.ts
git commit -m "fix: attribute tutor support to used hints"
```

---

### Task 2: Keep the public plugin Tutor Skill semantically identical

**Files:**

- Modify: `plugins/highschool-study/tests/contract/agent-and-skills.test.ts`
- Modify: `plugins/highschool-study/skills/run-lesson/SKILL.md`

**Interfaces:**

- Consumes: the exact A+C wording established in Task 1.
- Produces: public Claude Code plugin behavior with the same `none`, `tutor` and ambiguous-student-confirmation branches.

- [ ] **Step 1: Write the failing public Skill contract assertions**

In `plugins/highschool-study/tests/contract/agent-and-skills.test.ts`, replace the unconditional-hint assertions with:

```ts
expect(run).toContain('Treat `support` as actual dependence, not hint exposure');
expect(run).toContain(
  'If the final solution uses decisive content first supplied by the Tutor, write `support: tutor`',
);
expect(run).toContain(
  'If the Tutor only repeats, locates or confirms content the student already produced, and the decisive content is student-produced, write `support: none`',
);
expect(run).toContain('刚才的提示是否对你最终使用的关键步骤起了作用？');
expect(run).toContain(
  'Do not append the final correct Trace until the student answers this attribution question',
);
expect(run).not.toContain(
  'If the Tutor has sent any numbered hint since that active attempt began, `support` MUST be `tutor`',
);
```

Keep the current assessment, method, supersedes, alternative and tool-turn assertions.

- [ ] **Step 2: Run the public contract test and verify RED**

Run:

```bash
cd plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts
```

Expected: FAIL on the new A+C strings and/or the obsolete unconditional hint string.

- [ ] **Step 3: Apply the same canonical A+C ladder to the public Skill**

In `plugins/highschool-study/skills/run-lesson/SKILL.md`, replace the current pre-`trace_append` checklist with the exact six-item Markdown block from Task 1 Step 3. Remove the later sentence that unconditionally assigns `support: tutor` after any Tutor hint.

Do not change allowed tools, Task projection, hint ladder, assessment, method confirmation, alternative persistence or closure rules.

- [ ] **Step 4: Run the public contract test and verify GREEN**

Run:

```bash
cd plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts
```

Expected: 13 tests pass, 0 fail. The exact count may increase only by tests added in Step 1.

- [ ] **Step 5: Compare both Skill attribution blocks**

Run:

```bash
rg -n -A 12 'Before every final `trace_append`, attribute help' \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  plugins/highschool-study/skills/run-lesson/SKILL.md
```

Expected: both files contain the same six decisions and the same Chinese attribution question.

- [ ] **Step 6: Commit public Skill parity**

```bash
git add \
  plugins/highschool-study/tests/contract/agent-and-skills.test.ts \
  plugins/highschool-study/skills/run-lesson/SKILL.md
git commit -m "fix: align plugin hint attribution"
```

---

### Task 3: Run full regression and two real-model attribution branches

**Files:**

- Modify: `docs/audits/2026-07-22-teaching-runtime-closure-acceptance.md`
- Do not modify: `examples/derivative-demo/learning-set/**`

**Interfaces:**

- Consumes: Task 1 and Task 2's A+C Skill contract and unchanged Trace schema.
- Produces: two isolated native Pi Session JSONLs, Trace anchors for each attribution branch, and an audit report using actual-dependence semantics.

- [ ] **Step 1: Run the full automated regression**

Run Pi and plugin checks:

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e

cd ../../plugins/highschool-study
bun run release:check
```

Expected:

```text
Pi: 86 or more tests, 0 fail; typecheck and Vite build exit 0.
Playwright: 8 tests, 0 fail.
Plugin: 59 or more tests, 0 fail; strict plugin validation exit 0.
```

- [ ] **Step 2: Create two isolated runtimes without printing credentials**

From the repository root:

```bash
RUNTIME_NONE="$(mktemp -d /tmp/studyforge-hint-attribution-none-20260723-XXXXXX)"
RUNTIME_TUTOR="$(mktemp -d /tmp/studyforge-hint-attribution-tutor-20260723-XXXXXX)"

for root in "$RUNTIME_NONE" "$RUNTIME_TUTOR"; do
  rsync -a --exclude .git ./ "$root/"
  mkdir -p "$root/pi-agent"
  cp /tmp/studyforge-runtime-closure-finalaccept-20260722-epxahM/pi-agent/settings.json "$root/pi-agent/settings.json"
  cp /tmp/studyforge-runtime-closure-finalaccept-20260722-epxahM/pi-agent/auth.json "$root/pi-agent/auth.json"
done
```

Start dedicated servers on ports 65009 and 65010 with each root's `PI_CODING_AGENT_DIR`. Expected model is Xiaomi `mimo-v2.5-pro-ultraspeed`. Never print the copied JSON files.

- [ ] **Step 3: Run the unused-hint branch through the visible UI**

Open the prepared `lesson-003` route on port 65009. Start the Lesson, enter the first problem and send the established incomplete proof:

```text
由 ln a 有意义得 a>0。固定 x，令 F_x(a)=x²+x ln a-ae^x ln x，则 ∂F_x/∂a=x/a-e^x ln x>0，所以 F_x 关于 a 递增。令 x→1⁻ 得必要条件 a≥e^{-1}，我判断选 D；但我暂时还没有写出 a=e^{-1} 时的充分性证明。
```

After the incomplete Trace, send:

```text
请给我一级提示。
```

Then send `明白了。` and verify no correct Trace appears. Finally send:

```text
我继续完成充分性。取 a=e^{-1}，则 F_x(e^{-1})=x²-x-e^{x-1}ln x。由 ln x<x-1 得 -ln x>1-x，同时取指数得 x<e^{x-1}。因此 -e^{x-1}ln x>e^{x-1}(1-x)>x(1-x)，所以 F_x(e^{-1})>x²-x+x(1-x)=0。再由 F_x(a) 关于 a 递增，所有 a≥e^{-1} 都成立，所以选 D。
```

Required result:

```text
assessment: correct
support: none
supersedes: event-001
Tutor asks no attribution question because the Level 1 hint only repeated student-produced content.
Trace note states that the decisive inequality was student-produced.
```

- [ ] **Step 4: Run the adopted-decisive-hint branch through the visible UI**

Repeat the same initial incomplete proof on port 65010. Request:

```text
请给我三级提示，只给一个关键中间式。
```

Record the exact Tutor-provided intermediate expression. The test is valid only if the hint introduces a decisive inequality or expression not already produced by the student. Then submit a complete proof that explicitly uses that exact contribution.

Required result:

```text
assessment: correct
support: tutor
supersedes: event-001
Tutor asks no attribution question because the decisive-content match is explicit.
Trace note names the Tutor-provided item that the final proof adopted.
```

If the Level 3 response fails to introduce decisive content, preserve the runtime as an invalid fixture and restart this branch in a fresh isolated copy; do not reinterpret an invalid hint as a passing test.

- [ ] **Step 5: Audit native Session and Markdown facts**

For each runtime, locate its sole Tutor JSONL without printing thinking content:

```bash
find "$RUNTIME_NONE/pi-agent/sessions" -type f -name '*.jsonl' -print
find "$RUNTIME_TUTOR/pi-agent/sessions" -type f -name '*.jsonl' -print
```

Extract only tool names and arguments:

```bash
jq -c 'select(.type=="message" and .message.role=="assistant") |
  .message.content[]? | select(.type=="toolCall") | {name, arguments}' SESSION.jsonl
```

Inspect each isolated `lessons/lesson-003.md` Trace section. Required: active Trace values match Steps 3–4 and no repository learning-set file changed.

- [ ] **Step 6: Update the acceptance report**

Append a `2026-07-23 Hint Dependence Attribution Recheck` section to `docs/audits/2026-07-22-teaching-runtime-closure-acceptance.md` containing:

- implementation commits;
- sanitized runtime roots and Session paths;
- each initial and superseding Trace anchor;
- the exact decisive-content origin or student attribution evidence;
- automatic test counts;
- PASS/FAIL for the unused-hint and adopted-decisive-hint branches.

Reclassify the prior `hint-final2` sample: its `support:none` is consistent with the actual-dependence definition because the hint repeated existing student content. Record the former third synthetic branch as invalid: its prompt did not define “direction”, and the Tutor only repeated a proof obligation already named by the student. Change the report's overall state to PASS only if both valid branches pass.

- [ ] **Step 7: Stop only the two dedicated servers and verify isolation**

After stopping the dedicated processes, run:

```bash
git status --short
git diff --check
git diff -- examples/derivative-demo/learning-set
```

Expected: only this design, plan and audit report are modified; repository learning-set diff is empty.

- [ ] **Step 8: Commit the audited result**

```bash
git add \
  docs/superpowers/specs/2026-07-23-hint-dependence-attribution-design.md \
  docs/superpowers/plans/2026-07-23-hint-dependence-attribution.md \
  docs/audits/2026-07-22-teaching-runtime-closure-acceptance.md
git commit -m "docs: retire ambiguous hint fixture"
```

## Completion Gate

- Both Tutor Skills use the same A+C decision ladder.
- No active Agent, Skill or tool-description text says that hint exposure alone requires `support:tutor`.
- Trace schema and runtime execution remain unchanged.
- Unused hint produces `correct + none + supersedes` without an attribution question.
- Adopted decisive hint produces `correct + tutor + supersedes` without an attribution question.
- Student-confirmation fallback remains in the Skill contract, but the discarded ambiguous synthetic prompt is not a completion gate.
- Full Pi, plugin and Playwright checks pass.
- Repository learning-set files remain untouched and the implementation worktree is clean after the audit commit.
