# M2 Free-Learning Peer First Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one text-only AI classmate, 阿澄, to Free Learning so an explicitly invited Peer can answer as a durable actor and the teacher can continue without confusing Peer output with student evidence.

**Architecture:** A Free Learning-only `ask_peer` tool runs the existing Scout model once against a student-visible public context. Its native Pi `toolResult` is the sole durable Peer utterance; history/live projection turns that result into a first-class `peer` item while the same result remains visible to the teacher Agent Loop. No Peer Session, database, long-term Peer memory, or course-node integration is added.

**Tech Stack:** Bun, TypeScript 7, React 19 server rendering tests, Pi `ModelRuntime.completeSimple`, native Pi Session JSONL, TypeBox tool schemas, existing StudyForge Markdown/KaTeX and paper-theme CSS.

## Global Constraints

- Implement only Free Learning. Roadmap, Plan, Lesson and Meta must not expose `ask_peer`.
- Reuse the configured Scout model and thinking level; do not add a third model setting.
- The successful `ask_peer` `toolResult` owns the Peer text. Do not mirror it as user, assistant, custom message or another Session.
- Runtime owns actor ID, display name, model, time and Session. The teacher submits only `peerId` and `intent`.
- Peer context contains only public student/teacher/Peer messages and student-visible selected assets.
- Never pass `teacherRationale`; never pass an unrevealed standard answer.
- Peer output is teaching stimulus, never student evidence. A later student response retains the Peer-help boundary.
- Keep implementation direct: no database, generic actor framework, Peer memory, role editor, visual avatar pipeline or defensive transaction layer.
- **Visual thesis:** 阿澄 appears like a quiet teal marginal voice inside the same paper letter, not a game chat bubble or dashboard card.
- **Content plan:** stable role label → short pending line → Markdown reply or quiet failure; no extra panel, inspector or status strip.
- **Interaction thesis:** reuse the existing reply entrance, add one restrained pending pulse, and replace the pending row in place when the tool settles.

---

### Task 1: Build the Student-Visible Peer Context

**Files:**
- Create: `apps/pi-teaching-web/src/runtime/peer-context.ts`
- Create: `apps/pi-teaching-web/tests/m2/peer-context.test.ts`

**Interfaces:**
- Consumes: `FreeLearningSessionScope`, native `SessionEntry[]`, `readLearningNote`, `readProblemCard`, `readProblemActivity`, `readMaterialRevision`, and `readMaterialLocator`.
- Produces: `renderPeerPublicContext(root, scope, entries): string`, used by the Peer tool in Task 2.

- [ ] **Step 1: Write failing transcript-boundary tests**

Create `tests/m2/peer-context.test.ts` with native entries containing student text, teacher text, an ordinary tool result and a prior `ask_peer` result:

```ts
test('renders only public student teacher and peer utterances', () => {
  const rendered = renderPeerPublicContext(root, scope([]), entries([
    user('我觉得 Ksp 会随加盐变小'),
    assistant('先区分常数和当前状态。'),
    toolResult('read', 'PRIVATE_MEMORY_BODY', { path: 'memory/private.md' }),
    peerResult('也许该比较离子积？'),
  ]));

  expect(rendered).toContain('学生：我觉得 Ksp 会随加盐变小');
  expect(rendered).toContain('老师：先区分常数和当前状态。');
  expect(rendered).toContain('阿澄（AI 同学）：也许该比较离子积？');
  expect(rendered).not.toContain('PRIVATE_MEMORY_BODY');
  expect(rendered).not.toContain('memory/private.md');
});
```

- [ ] **Step 2: Write failing selected-card answer-boundary tests**

Seed one real card with `standardAnswer: 'HIDDEN_ANSWER'`, `teacherRationale: 'PRIVATE_RATIONALE'`, record a student attempt, and assert:

```ts
const beforeReveal = renderPeerPublicContext(root, scope([
  { kind: 'problem-card', id: 'problem-001' },
]), []);
expect(beforeReveal).toContain('STUDENT_ATTEMPT');
expect(beforeReveal).not.toContain('HIDDEN_ANSWER');
expect(beforeReveal).not.toContain('PRIVATE_RATIONALE');

revealProblemAnswer(root, 'problem-001', 'reveal-001', now);
const afterReveal = renderPeerPublicContext(root, scope([
  { kind: 'problem-card', id: 'problem-001' },
]), []);
expect(afterReveal).toContain('HIDDEN_ANSWER');
expect(afterReveal).not.toContain('PRIVATE_RATIONALE');
```

Also cover one Note and one Material locator as explicitly selected public content.

- [ ] **Step 3: Run RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m2/peer-context.test.ts
```

Expected: FAIL because `runtime/peer-context.ts` and `renderPeerPublicContext` do not exist.

- [ ] **Step 4: Implement the minimal renderer**

Create `src/runtime/peer-context.ts` with one public function and private renderers:

```ts
export function renderPeerPublicContext(
  root: string,
  scope: FreeLearningSessionScope,
  entries: readonly SessionEntry[],
): string {
  const conversation = publicUtterances(entries).map((item) => (
    `${item.speaker}：${item.text}`
  ));
  const assets = scope.selectedAssets.map((reference) => (
    renderStudentVisibleAsset(root, reference)
  ));
  return [
    '# 当前公开对话',
    conversation.join('\n\n') || '（还没有公开发言）',
    ...(assets.length ? ['# 学生带入的内容', ...assets] : []),
  ].join('\n\n');
}
```

`publicUtterances` accepts only native `message.role === 'user'`, assistant text, and successful `ask_peer` tool results whose `details.kind === 'peer-message'`. The card renderer includes `standardAnswer` only when `readProblemActivity(...).answerRevealedForLatestAttempt` is true and never reads `teacherRationale` into the returned string.

- [ ] **Step 5: Run GREEN and commit**

Run:

```bash
bun test tests/m2/peer-context.test.ts
git add apps/pi-teaching-web/src/runtime/peer-context.ts apps/pi-teaching-web/tests/m2/peer-context.test.ts
git commit -m "feat: build student-visible peer context"
```

Expected: the new context tests pass.

---

### Task 2: Generate and Persist One Peer Reply

**Files:**
- Create: `apps/pi-teaching-web/resources/peers/acheng.md`
- Create: `apps/pi-teaching-web/src/runtime/peer-runner.ts`
- Create: `apps/pi-teaching-web/src/runtime/peer-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/free-learning-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/server/start-server.ts`
- Create: `apps/pi-teaching-web/tests/m2/peer-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/m1b/free-learning-session.test.ts`

**Interfaces:**
- Consumes: `renderPeerPublicContext`, the resolved Scout `Model<Api>`, Scout `DesktopThinkingLevel`, and the current free-learning Session manager.
- Produces:

```ts
export type PeerResponder = (input: {
  peerId: 'peer-acheng';
  intent: string;
  publicContext: string;
  signal?: AbortSignal;
}) => Promise<string>;

export const PEER_MESSAGE_DETAILS = {
  kind: 'peer-message', version: 1, actorType: 'peer',
  actorId: 'peer-acheng', displayName: '阿澄',
} as const;
```

- [ ] **Step 1: Write failing tool-surface and schema tests**

Test that `modelToolsForFreeLearning(true, true)` and `createFreeLearningTools(..., responder)` include `ask_peer`, while node/meta tools and a free session without a configured responder do not. Validate the exact schema:

```ts
expect(Check(tool.parameters, {
  peerId: 'peer-acheng',
  intent: '请从同学视角质疑这个判断。',
})).toBeTrue();
for (const extra of [{ sessionId: 'x' }, { displayName: '伪造' }, { model: 'x' }, { at: now }]) {
  expect(Check(tool.parameters, { peerId: 'peer-acheng', intent: '回应', ...extra })).toBeFalse();
}
```

- [ ] **Step 2: Write failing execution tests against a real tool definition**

Inject a deterministic `PeerResponder`, execute the real tool, and assert that it receives public context but no private card fields; assert the returned content has one text body and exact details. Also inject a throwing responder and assert tool execution rejects without fabricating Peer text.

- [ ] **Step 3: Write failing Peer Runner tests**

Inject a narrow completion dependency instead of mocking `ModelRuntime`:

```ts
const complete = async (_context: Context) => assistant([
  { type: 'thinking', thinking: 'PRIVATE_THOUGHT' },
  { type: 'text', text: '先别急着下结论，我们找个反例？' },
]);
const responder = createPeerResponder(complete, 'high', ACHENG_PERSONA);
expect(await responder(input)).toBe('先别急着下结论，我们找个反例？');
```

Verify that the completion context contains the persona as `systemPrompt`, one quoted public-context user message, no tools, the configured reasoning level, and the abort signal. Empty/error/aborted output must reject with a stable internal error.

- [ ] **Step 4: Run RED**

Run:

```bash
bun test tests/m2/peer-tools.test.ts tests/m1b/free-learning-session.test.ts
```

Expected: FAIL because the Peer runner, tool and conditional tool surface do not exist.

- [ ] **Step 5: Add the compact 阿澄 persona**

Create `resources/peers/acheng.md`:

```markdown
# 阿澄

你是公开标注为 AI 同学的阿澄。你和学生一起想，不冒充真人，也不替老师下掌握结论。
通常用一两段自然短话回应：可以追问、联想、质疑或提出一个反例；先说真正想到的内容，
不知道就承认。不要故意装笨、制造错误、布置课程、读取隐藏答案或声称已经保存任何内容。
```

- [ ] **Step 6: Implement the one-shot runner**

`createPeerResponder` calls `ModelRuntime.completeSimple` through an injected completion function:

```ts
const response = await complete({
  systemPrompt: persona,
  messages: [{
    role: 'user',
    content: `${publicContext}\n\n# 这次邀请\n${intent}`,
    timestamp: Date.now(),
  }],
}, {
  ...(thinking === 'off' ? {} : { reasoning: thinking }),
  signal,
});
const text = response.content.flatMap((block) => (
  block.type === 'text' ? [block.text] : []
)).join('').trim();
if (response.stopReason === 'error' || response.stopReason === 'aborted' || !text) {
  throw new Error('PEER_RESPONSE_UNAVAILABLE');
}
return text;
```

- [ ] **Step 7: Implement the Free Learning-only tool**

Define `ask_peer` with a TypeBox literal `peer-acheng`, required non-empty `intent`, sequential execution, and the injected responder. The tool executes:

```ts
const text = await responder({
  peerId: input.peerId,
  intent: input.intent,
  publicContext: renderPeerPublicContext(root, scope, session.getBranch()),
  signal,
});
return {
  content: [{ type: 'text', text }],
  details: PEER_MESSAGE_DETAILS,
};
```

Do not catch the responder error inside the tool; Pi must persist it as a failed tool result and let the teacher continue its loop.

- [ ] **Step 8: Wire the Scout model without adding settings**

Add `scout: DesktopModelSelection` to `PiRuntimeOptions`; `start-server.ts` passes `config.scout`. Resolve teacher and Scout models together. Create one responder from `modelRuntime.completeSimple.bind(modelRuntime)`, the Scout model, `options.scout.thinking`, and the packaged persona. Pass it only into Free Learning custom tools and include `ask_peer` in `modelToolsForFreeLearning(hasMemory, peerEnabled)` only when the responder exists. Non-desktop factory calls keep Peer disabled rather than guessing a model.

- [ ] **Step 9: Run GREEN and commit**

Run:

```bash
bun test tests/m2/peer-tools.test.ts tests/m1b/free-learning-session.test.ts tests/m0/native-session.test.ts tests/desktop/desktop-api.test.ts
git add apps/pi-teaching-web/resources/peers/acheng.md \
  apps/pi-teaching-web/src/runtime/peer-runner.ts \
  apps/pi-teaching-web/src/runtime/peer-tools.ts \
  apps/pi-teaching-web/src/runtime/free-learning-tools.ts \
  apps/pi-teaching-web/src/runtime/session-scope.ts \
  apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/src/server/start-server.ts \
  apps/pi-teaching-web/tests/m2/peer-tools.test.ts \
  apps/pi-teaching-web/tests/m1b/free-learning-session.test.ts
git commit -m "feat: add free-learning peer tool"
```

Expected: focused runtime tests pass.

---

### Task 3: Project and Render Peer as a First-Class Actor

**Files:**
- Create: `apps/pi-teaching-web/src/projection/peer-message.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/projection/conversation.ts`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles/course.css`
- Create: `apps/pi-teaching-web/tests/m2/peer-projection.test.tsx`

**Interfaces:**
- Consumes: native `ask_peer` tool call/result events and persisted Session entries.
- Produces:

```ts
export type PeerConversationItem = {
  id: string;
  kind: 'peer';
  actorId: string;
  displayName: string;
  status: 'running' | 'done' | 'error';
  text: string | null;
  at: string;
};
```

- [ ] **Step 1: Write failing history and live projection tests**

Assert that an `ask_peer` assistant tool call creates one running Peer item and its tool result replaces the same ID with one done Peer item. Test live `tool_execution_start`/`end`, persisted reload, stable actor details, quiet failure, and that the raw text appears exactly once.

- [ ] **Step 2: Write a failing UI rendering test**

Render `ChatPanel` with running, done and failed Peer items. Assert visible “阿澄”, “AI 同学”, “阿澄正在想……”, Markdown reply, and “阿澄暂时没接上”; assert it never renders “老师查看了相关内容”, raw tool JSON or “老师” as the Peer role.

- [ ] **Step 3: Run RED**

Run:

```bash
bun test tests/m2/peer-projection.test.tsx
```

Expected: FAIL because the `peer` contract and projection do not exist.

- [ ] **Step 4: Implement dedicated Peer projection**

Create `projection/peer-message.ts` with `peerMessageStart` and `peerMessageEnd`. Start accepts only the known `peerId`; end trusts a success only when `details.kind === 'peer-message'`, actor metadata is valid, and exactly one non-empty text body exists. On failure it reuses the started actor and returns `status: 'error', text: null`. Unknown/malformed success results fall back to a generic private tool receipt rather than inventing an actor.

Update `projectConversationEntries` and `projectLiveSessionEvent` to route only `ask_peer` through these helpers. Continue using the native tool call ID so live and history items reconcile in place.

- [ ] **Step 5: Render the restrained paper-theme Peer row**

In `ChatPanel`, handle `item.kind === 'peer'` before generic messages:

```tsx
<article className={`message peer ${item.status}`}>
  <span className="message-role">
    {item.displayName}<small>AI 同学</small>
  </span>
  <div>
    {item.status === 'running'
      ? <p className="peer-pending">阿澄正在想……</p>
      : item.status === 'error'
        ? <p className="peer-unavailable">阿澄暂时没接上</p>
        : <MarkdownView>{item.text ?? ''}</MarkdownView>}
  </div>
</article>
```

Use the existing paper, spacing and `reply-in`; add a thin teal rule/wash, a two-line role label, and one subtle pending dot animation. Do not add a card, chat bubble, avatar image, gradient panel or new accent family.

- [ ] **Step 6: Run GREEN and commit**

Run:

```bash
bun test tests/m2/peer-projection.test.tsx tests/m0/material-search-projection.test.ts tests/m0/course-ui.test.tsx tests/m1d/entry-and-dialogue-ui.test.tsx
git add apps/pi-teaching-web/src/projection/peer-message.ts \
  apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/projection/conversation.ts \
  apps/pi-teaching-web/src/client/components/ChatPanel.tsx \
  apps/pi-teaching-web/src/client/styles/course.css \
  apps/pi-teaching-web/tests/m2/peer-projection.test.tsx
git commit -m "feat: render peer as a public actor"
```

Expected: Peer and existing projection/UI tests pass.

---

### Task 4: Calibrate the Free Learning Skill with the Smallest Necessary Guidance

**Files:**
- Modify only if the no-guidance control fails: `apps/pi-teaching-web/resources/skills/free-learning/SKILL.md`
- Create: `apps/pi-teaching-web/tests/m2/peer-skill.test.ts`

**Interfaces:**
- Consumes: the now-available `ask_peer` tool description and existing Free Learning bright line.
- Produces: first-hit behavior for explicit invitation, teacher suggestion/acceptance, and evidence attribution.

- [ ] **Step 1: Write the behavioral cases before editing the Skill**

Freeze three cases:

1. “阿澄你怎么看这个解释？” → exactly one `ask_peer` call.
2. Ordinary question with no invitation → no `ask_peer` call.
3. Teacher suggests asking 阿澄 → no call until the student explicitly accepts.

The memory boundary case is: after Peer reply but before a new student response, no `free_learning_memory_commit`; after a student responds, any memory language must preserve “在阿澄提示/质疑后”。

- [ ] **Step 2: Run a no-guidance control**

Use fresh Free Learning Sessions with the real teacher model and the new tool, while the Skill remains unchanged. Run at least five fresh-context samples across the three cases and manually inspect every tool call and public reply.

If all cases already obey the contract, do not edit `SKILL.md`; the tool description is sufficient and additional prompt weight is rejected. If any case fails, record the exact failure and continue to Step 3.

- [ ] **Step 3: Add one positive route only when the control failed**

Append the smallest shape-based section to `free-learning/SKILL.md`:

```markdown
## AI 同学

学生明确邀请阿澄，或已经明确接受教师刚提出的邀请时，调用一次 `ask_peer`，让阿澄公开
回应后再由教师继续主持。普通提问、只提到名字或尚未接受建议时，由教师直接回应。

阿澄的发言是教学帮助，不是学生表现；只有学生之后真实表达、比较或使用了什么，才按实际
帮助程度判断是否更新对象记忆。
```

Do not add a prohibition table, extra confirmation vocabulary, regex examples or a separate Peer Skill.

- [ ] **Step 4: Add a focused structural regression test**

If Step 3 edits the Skill, `tests/m2/peer-skill.test.ts` reads it and asserts the positive order, the two observable gates, and the evidence boundary. If no edit was needed, the test instead asserts the complete behavior is carried by the `ask_peer` tool description and omits redundant Skill wording.

- [ ] **Step 5: Re-run the same real-model samples and commit**

Run:

```bash
bun test tests/m2/peer-skill.test.ts tests/m1/memory-skill-tree.test.ts
git add apps/pi-teaching-web/resources/skills/free-learning/SKILL.md apps/pi-teaching-web/tests/m2/peer-skill.test.ts
git commit -m "feat: route invited peer collaboration"
```

If the Skill was not changed, stage only the focused regression test and use commit message `test: lock peer invitation routing`.

Expected: five post-guidance samples converge on the approved behavior without unrelated Free Learning regressions.

---

### Task 5: Verify the Complete Sol/Terra Loop

**Files:**
- Modify only if integration exposes a proven defect: files already owned by Tasks 1–4.
- No permanent validation harness unless the existing HTTP path cannot provide reproducible evidence.

**Interfaces:**
- Consumes: packaged desktop model config, a blank learning set, a selected-card learning set, HTTP/WebSocket Session APIs and native Session JSONL.
- Produces: a verified text-only Peer adoption loop ready for the separate embodiment slice.

- [ ] **Step 1: Run focused integration tests**

```bash
cd apps/pi-teaching-web
bun test tests/m2 tests/m1b/free-learning-session.test.ts tests/m1b/free-learning-memory.test.ts tests/m1d/entry-and-dialogue-ui.test.tsx
```

Expected: all focused tests pass with zero failures.

- [ ] **Step 2: Run real Sol/Terra scenarios through the server API**

Use the configured Sol teacher at `high` and Scout/Terra at `high`. In separate native Free Learning Sessions verify:

- ordinary chemistry question: no Peer;
- “阿澄你怎么看”：one Peer reply followed by teacher continuation;
- teacher suggests Peer and student has not accepted: no Peer;
- selected unrevealed card: Peer reply contains neither standard answer nor teacher rationale;
- deliberate Peer disagreement: teacher attributes and handles it as 阿澄’s statement;
- injected Peer failure: the teacher Session remains usable.

Record native entry ordering and timings from accepted user message to Peer result and teacher completion. Do not expose CoT or credentials in the report.

- [ ] **Step 3: Visually inspect the Free Learning page**

Open the real page at desktop width. Confirm the paper letter remains the primary workspace, “阿澄 · AI 同学” is distinguishable from “你 / 老师”, pending replacement is stable, Markdown/KaTeX still render, and there is no new side panel/card mosaic.

- [ ] **Step 4: Run the full fresh verification gate**

```bash
bun run check
git diff --check
git status --short
```

Expected: typecheck passes, all non-E2E Bun tests pass, Vite production build succeeds, diff check is clean, and only intended Peer files are modified.

- [ ] **Step 5: Commit any integration-only correction and review the spec checklist**

If Step 2 or 3 required a correction, first add a failing regression test, implement the minimum fix, rerun the focused test, then commit only that correction:

```bash
git add apps/pi-teaching-web/src/runtime/peer-context.ts \
  apps/pi-teaching-web/src/runtime/peer-runner.ts \
  apps/pi-teaching-web/src/runtime/peer-tools.ts \
  apps/pi-teaching-web/src/projection/peer-message.ts \
  apps/pi-teaching-web/src/projection/conversation.ts \
  apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/client/components/ChatPanel.tsx \
  apps/pi-teaching-web/src/client/styles/course.css \
  apps/pi-teaching-web/tests/m2
git commit -m "fix: preserve peer actor boundary"
```

Finally compare every section of `docs/superpowers/specs/2026-08-10-m2-free-learning-peer-first-loop-design.md` against the implementation. Any unimplemented requirement remains an explicit gap; it is not converted into a completion claim.
