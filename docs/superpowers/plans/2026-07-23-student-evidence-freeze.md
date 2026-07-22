# Student Evidence Freeze Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 防止 Tutor 把自己补出的推导冒充学生证据，并用现有 `assessment`、`support` 与 `supersedes` 正确处理“学生尚缺决定性证明”的课堂路径。

**Architecture:** 不改持久 schema 或工具字段集合。Tutor Skill 在评价前冻结学生已产出的数学步骤，`trace_append.assessment` 的 schema description 在调用边界重复该事实规则；现有 superseding Trace 负责学生后续独立补完或在 Tutor 支持后补完。实现完成后用导数学习集的原失败输入做隔离真实模型复验，验收过程中不再修改产品代码。

**Tech Stack:** TypeScript 7、TypeBox 1.3.6、Bun 1.3.14、Pi coding agent 0.81.0、Markdown Skills、Bun Test、Playwright、MiMo V2.5 Pro UltraSpeed。

## Global Constraints

- 设计依据：`docs/superpowers/specs/2026-07-23-student-evidence-freeze-design.md`。
- 不新增 Trace 字段、rubric ID、证据片段 ID、持久对象或公共 MCP 参数。
- 不新增裁判 Agent、默认 verifier subagent、运行时数学规则或学生输出门。
- `correct` 只允许使用本次工具调用前学生自己已经给出的全部决定性步骤。
- Tutor 首次提供的推导、隐含结论或参考解内容不能升级同一次学生 attempt。
- 正确但缺决定性证明使用 `incomplete`；学生链条本身有实质错误才使用 `partially_correct`。
- Tutor 提示或补充后学生再完成，最终 Trace 使用 `support: tutor`；仅表示理解不能生成新的 correct 学生证据。
- 方法节点确认和另解落盘只在证据冻结后的 active Trace 为 `correct` 时触发。
- 每个实现任务先观察失败测试，再做最小修改；真实模型验收阶段不修产品代码。

---

### Task 1: 在 Tutor Prompt 与工具调用边界冻结学生证据

**Files:**

- Modify: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts:161-249`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts:103-176`
- Modify: `plugins/highschool-study/tests/contract/agent-and-skills.test.ts:348-428`
- Modify: `apps/pi-teaching-web/resources/agents/tutor.md:7`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md:8-18`
- Modify: `apps/pi-teaching-web/src/runtime/study-tools.ts:79-84`
- Modify: `plugins/highschool-study/skills/run-lesson/SKILL.md:12-18`

**Interfaces:**

- Consumes: existing `trace_append` fields `assessment`, `support`, `note`, `supersedes` and method-confirmation fields.
- Produces: unchanged TypeBox field set; only `assessment.description` and Agent/Skill behavior contracts change.

- [ ] **Step 1: Add failing Pi prompt contract assertions**

Add to `defines the Tutor correction, hint ladder and tool-turn protocol literally`:

```ts
for (const source of [tutorAgent, tutorSkill]) {
  expect(source).toContain(
    "Before judging, freeze the evidence to mathematical claims the student explicitly supplied before this tool call",
  );
  expect(source).toContain(
    'Never use a derivation, implication or conclusion first supplied by the Tutor to upgrade that same attempt',
  );
}
expect(tutorSkill).toContain(
  'If a decisive proof obligation is still missing, record `assessment: incomplete`',
);
expect(tutorSkill).toContain(
  'Validate what is established, name the missing obligation without solving it',
);
expect(tutorSkill).toContain(
  'Method confirmation and alternative persistence begin only after the evidence-frozen active Trace is correct',
);
```

- [ ] **Step 2: Add a failing TypeBox description assertion**

In `keeps runtime authority out of Tutor tool schemas`, inspect the existing `assessment` property without changing the expected property keys:

```ts
const traceProperties = (trace.parameters as {
  properties: Record<string, { description?: string }>;
}).properties;
expect(traceProperties.assessment?.description).toContain(
  "the student's own work before this tool call",
);
expect(traceProperties.assessment?.description).toContain(
  'Tutor-generated completions never count as student evidence',
);
```

- [ ] **Step 3: Add failing public plugin Skill assertions**

Add to `defines Tutor corrections, hint levels and tool turns literally`:

```ts
expect(run).toContain(
  "Before judging, freeze the evidence to mathematical claims the student explicitly supplied before this tool call",
);
expect(run).toContain(
  'Never use a derivation, implication or conclusion first supplied by the Tutor to upgrade that same attempt',
);
expect(run).toContain(
  'If a decisive proof obligation is still missing, keep the attempt incomplete',
);
expect(run).toContain(
  'Tutor-provided work can change later support to tutor, but cannot become unsupported student evidence',
);
```

- [ ] **Step 4: Run targeted tests and observe the intended failures**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-factory.test.ts tests/runtime/study-tools.test.ts

cd ../../plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts
```

Expected: prompt assertions fail because the evidence-freeze text is absent; the TypeBox assertion fails because `assessment.description` is undefined. Existing tests must not fail for unrelated reasons.

- [ ] **Step 5: Add the minimal Tutor Agent rule**

Insert once near the start of the Tutor Agent's single behavior paragraph:

```text
Before judging, freeze the evidence to mathematical claims the student explicitly supplied before this tool call. Never use a derivation, implication or conclusion first supplied by the Tutor to upgrade that same attempt.
```

Do not copy the complete protocol into the Agent; `tutor-lesson` remains its canonical owner.

- [ ] **Step 6: Add the canonical Tutor Skill protocol**

At the beginning of the existing Trace rule, before method mapping, add:

```text
Before judging, freeze the evidence to mathematical claims the student explicitly supplied before this tool call. Never use a derivation, implication or conclusion first supplied by the Tutor to upgrade that same attempt. If a decisive proof obligation is still missing, record `assessment: incomplete`; use `partially_correct` only when the student's own chain contains a substantive error. Validate what is established, name the missing obligation without solving it, then wait or ask whether the student wants a hint. Tutor-provided work can change a later completed attempt to `support: tutor`, but it cannot become unsupported student evidence. Method confirmation and alternative persistence begin only after the evidence-frozen active Trace is correct.
```

Keep the existing zero/ladder consent rules and superseding Trace flow unchanged.

- [ ] **Step 7: Add the call-site assessment description without changing schema shape**

Change only the options object of the existing assessment union:

```ts
assessment: Type.Union([
  Type.Literal('correct'),
  Type.Literal('partially_correct'),
  Type.Literal('incorrect'),
  Type.Literal('incomplete'),
], {
  description: "correct requires every decisive implication to be present in the student's own work before this tool call. Tutor-generated completions never count as student evidence.",
}),
```

Do not add runtime rejection logic: the runtime cannot determine mathematical completeness.

- [ ] **Step 8: Synchronize the public plugin Skill**

Add the same fact boundary to `run-lesson` using its existing terminology:

```text
Before judging, freeze the evidence to mathematical claims the student explicitly supplied before this tool call. Never use a derivation, implication or conclusion first supplied by the Tutor to upgrade that same attempt. If a decisive proof obligation is still missing, keep the attempt incomplete; reserve partially_correct for a substantive error in the student's own chain. Validate what is established, name the missing obligation without solving it, and wait for continued work or an explicit hint request. Tutor-provided work can change later support to tutor, but cannot become unsupported student evidence.
```

- [ ] **Step 9: Run targeted tests and confirm green**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-factory.test.ts tests/runtime/study-tools.test.ts

cd ../../plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts
```

Expected: Pi targeted tests and all 13 plugin contract tests pass with 0 failures.

- [ ] **Step 10: Commit the implementation**

```bash
git add \
  apps/pi-teaching-web/tests/runtime/session-factory.test.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts \
  plugins/highschool-study/tests/contract/agent-and-skills.test.ts \
  apps/pi-teaching-web/resources/agents/tutor.md \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  apps/pi-teaching-web/src/runtime/study-tools.ts \
  plugins/highschool-study/skills/run-lesson/SKILL.md
git commit -m "fix: freeze student evidence before tutor assessment"
```

---

### Task 2: 全量回归并复验真实课堂证据边界

**Files:**

- Modify: `docs/audits/2026-07-22-teaching-runtime-closure-acceptance.md`
- Do not modify during acceptance: product source, repository `examples/derivative-demo/learning-set/**`

**Interfaces:**

- Consumes: Task 1's Agent/Skill contract and unchanged `trace_append` schema.
- Produces: isolated Pi Session JSONL, active/superseded Trace anchors, optional alternative sidecar, and an audit addendum with PASS/FAIL evidence.

- [ ] **Step 1: Run full automated regression**

Run Pi and plugin checks from their package directories:

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e

cd ../../plugins/highschool-study
bun run release:check
```

Expected: Pi typecheck/tests/build exit 0, Playwright 8 tests pass, plugin typecheck/tests/bundle/strict validation exit 0.

- [ ] **Step 2: Create a dedicated real-model runtime**

From the repository root:

```bash
RUNTIME_ROOT="$(mktemp -d /tmp/studyforge-evidence-freeze-20260723-XXXXXX)"
rsync -a --exclude .git ./ "$RUNTIME_ROOT/"
mkdir -p "$RUNTIME_ROOT/pi-agent"
cp /tmp/studyforge-runtime-closure-finalaccept-20260722-epxahM/pi-agent/settings.json "$RUNTIME_ROOT/pi-agent/settings.json"
cp /tmp/studyforge-runtime-closure-finalaccept-20260722-epxahM/pi-agent/auth.json "$RUNTIME_ROOT/pi-agent/auth.json"
cd "$RUNTIME_ROOT/apps/pi-teaching-web"
PI_CODING_AGENT_DIR="$RUNTIME_ROOT/pi-agent" bun run start -- \
  --learning-set ../../examples/derivative-demo/learning-set \
  --port 65009
```

Expected: local server starts on port 65009 with Xiaomi `mimo-v2.5-pro-ultraspeed`. Never print either copied credential file.

- [ ] **Step 3: Reproduce the exact missing-sufficiency turn through the visible UI**

Open `http://localhost:65009/plan/domain-integrity/lesson/lesson-003`, click the prepared-Lesson start action, wait for the hidden kickoff to finish, and send exactly:

```text
由 ln a 有意义得 a>0。固定 x，令 F_x(a)=x²+x ln a-ae^x ln x，则 ∂F_x/∂a=x/a-e^x ln x>0，所以 F_x 关于 a 递增。令 x→1⁻ 得必要条件 a≥e^{-1}，我判断选 D；但我暂时还没有写出 a=e^{-1} 时的充分性证明。
```

Before sending any second student message, audit the native Session and Lesson copy. Required result:

```text
trace_append: assessment=incomplete, support=none, methodStatus=unmapped
card_alternative_append calls: 0
method proposal: absent
next Block activation: absent
Tutor response: confirms necessity, names missing sufficiency, offers wait or requested hint, does not solve it
```

If any item fails, preserve the runtime, record FAIL, stop model traffic, and do not patch product code during this acceptance.

- [ ] **Step 4: Complete the proof independently and verify supersession plus alternative order**

If Step 3 passes, send:

```text
我继续完成充分性。取 a=e^{-1}，则 F_x(e^{-1})=x²-x-e^{x-1}ln x。由 ln x<x-1 得 -ln x>1-x，同时取指数得 x<e^{x-1}。因此 -e^{x-1}ln x>e^{x-1}(1-x)>x(1-x)，所以 F_x(e^{-1})>x²-x+x(1-x)=0。再由 F_x(a) 关于 a 递增，所有 a≥e^{-1} 都成立，所以选 D。
```

Required result:

1. New Trace supersedes the incomplete event and uses `assessment: correct`, `support: none`.
2. `card_alternative_append` follows the correct Trace before any student-facing acknowledgement.
3. The alternative uses `question: 整题` and indexes the new active Trace.
4. Method-node confirmation is asked only after the alternative write.

- [ ] **Step 5: Run a separate hint-supported branch**

From the implementation worktree root, create and launch a second isolated copy:

```bash
RUNTIME_HINT_ROOT="$(mktemp -d /tmp/studyforge-evidence-freeze-hint-20260723-XXXXXX)"
rsync -a --exclude .git ./ "$RUNTIME_HINT_ROOT/"
mkdir -p "$RUNTIME_HINT_ROOT/pi-agent"
cp /tmp/studyforge-runtime-closure-finalaccept-20260722-epxahM/pi-agent/settings.json "$RUNTIME_HINT_ROOT/pi-agent/settings.json"
cp /tmp/studyforge-runtime-closure-finalaccept-20260722-epxahM/pi-agent/auth.json "$RUNTIME_HINT_ROOT/pi-agent/auth.json"
cd "$RUNTIME_HINT_ROOT/apps/pi-teaching-web"
PI_CODING_AGENT_DIR="$RUNTIME_HINT_ROOT/pi-agent" bun run start -- \
  --learning-set ../../examples/derivative-demo/learning-set \
  --port 65010
```

Open `http://localhost:65010/plan/domain-integrity/lesson/lesson-003`, start the prepared Lesson and send the exact Step 3 missing-sufficiency input. After the incomplete Trace and non-solving response, send:

```text
请给我一级提示。
```

After the one-level hint, send `明白了。` and verify that acknowledgement alone creates no correct Trace. Then send the exact independent proof text from Step 4. Required final active Trace:

```text
assessment: correct
support: tutor
supersedes: the initial incomplete event
```

Acknowledgement without a new student derivation must not create a correct Trace.

- [ ] **Step 6: Update the audit without copying secrets or private reasoning**

Append a `2026-07-23 Evidence Freeze Recheck` section to `docs/audits/2026-07-22-teaching-runtime-closure-acceptance.md` containing:

- source implementation commit;
- both runtime roots and sanitized Session JSONL paths;
- initial incomplete Trace, independent-completion superseding Trace and hint-supported Trace anchors;
- alternative path and source Trace when present;
- automatic test counts;
- PASS/FAIL for evidence freeze, support provenance, corrected-to-correct alternative trigger and method-order boundary.

Do not change the report's overall status to PASS unless every required real-model item succeeds.

- [ ] **Step 7: Stop both servers and verify repository isolation**

Stop only the two dedicated server processes, then run:

```bash
git status --short
git diff --check
git diff -- examples/derivative-demo/learning-set
```

Expected: only the audit report is modified; repository learning-set diff is empty.

- [ ] **Step 8: Commit the audit result**

```bash
git add docs/audits/2026-07-22-teaching-runtime-closure-acceptance.md
git commit -m "docs: recheck student evidence provenance"
```

## Completion Gate

- Task 1 targeted red/green cycle is recorded.
- Pi full check, plugin release check and Playwright all exit 0.
- First real-model turn records incomplete and does not teach, map or persist an alternative.
- Independent completion supersedes to `correct + support:none` and runs Trace→alternative→reply in order.
- Hint-supported completion supersedes to `correct + support:tutor`.
- The audit report contains sanitized source paths and preserves FAIL for any unmet item.
- Repository learning-set files remain untouched and the implementation branch is clean after both commits.
