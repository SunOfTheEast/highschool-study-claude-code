# StudyForge Release Surface Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the eight student-visible release defects found in the real macOS DMG and remove every Runtime regex that interprets natural-language approval.

**Architecture:** Keep semantic decisions in teaching Skills and mechanical authority in Runtime. Project native agent activity through one student-facing presentation boundary, keep Markdown safety narrow, and improve settings through progressive disclosure without changing the provider catalog.

**Tech Stack:** Bun, TypeScript, React 19, React Markdown, Pi native Sessions, Playwright, Tauri 2.

## Global Constraints

- Do not add a confirmation token, progress protocol, timer-based fake stage, database, or persistent schema.
- Runtime may validate Session scope, paths, revisions, sources, document structure, and transaction integrity; it may not parse dialogue to infer approval.
- Preserve the existing dedicated Material Scout, Lesson Reviewer, and handout projections.
- Keep every Pi Provider and model available; only change ordering and disclosure.
- Preserve unrelated dirty worktree files and do not include them in commits.

---

### Task 1: Remove Runtime semantic approval gates

**Files:**
- Modify: `apps/pi-teaching-web/src/runtime/meta-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/learning-asset-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/free-learning-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/plan-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`
- Test: `apps/pi-teaching-web/tests/m1c/meta-session.test.ts`
- Test: `apps/pi-teaching-web/tests/m1b/free-learning-tools.test.ts`
- Test: `apps/pi-teaching-web/tests/m1c/session-asset-tools.test.ts`
- Test: `apps/pi-teaching-web/tests/m1c/prepared-card-persistence.test.ts`

**Interfaces:**
- Produces: `createMetaTools(root: string)` with no transcript dependency.
- Preserves: `LearningAssetToolSession.getSessionId()` for provenance and `getBranch()` only for memory-tool recovery elsewhere.

- [ ] **Step 1: Replace approval-regex tests with ownership tests**

Add focused cases proving tool execution does not depend on dialogue text:

```ts
test('leaves Roadmap approval semantics to Meta and enforces only mechanical creation', async () => {
  const root = copyFixture();
  const tool = createMetaTools(root)[0]!;
  await tool.execute('create-roadmap', roadmapInput(), undefined, undefined, {} as never);
  expect(readRoadmap(root).title).toBe('化学反应原理学习路线');
});
```

For `save_note`, `save_problem_card`, and `save_prepared_problem_card`, use an empty or
explicitly refusing transcript and assert the mechanically valid tool call persists the asset.
Retain existing stale revision, unknown source, duplicate Roadmap, and non-prepared Lesson failures.
Together with `create_roadmap`, these are the four audited semantic gates.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1c/meta-session.test.ts tests/m1b/free-learning-tools.test.ts \
  tests/m1c/session-asset-tools.test.ts tests/m1c/prepared-card-persistence.test.ts
```

Expected: failures contain `ROADMAP_CREATE_NOT_CONFIRMED` or `ASSET_SAVE_NOT_CONFIRMED`.

- [ ] **Step 3: Delete every transcript-based approval parser**

In `meta-tools.ts`, remove `SessionEntry`, dialogue extraction, proposal/affirmation regexes, the Session argument, and the confirmation check:

```ts
export function createMetaTools(root: string) {
  // ROADMAP_ALREADY_EXISTS, schema validation and atomic commit remain unchanged.
}
```

In `learning-asset-tools.ts`, delete `contentText`, `dialogueMessages`, `saveWords`, `proposesSave`, `refusesSave`, `startsWithAffirmation`, `latestStudentApprovedAssetSave`, and both `ASSET_SAVE_NOT_CONFIRMED` checks. Remove its re-export from `free-learning-tools.ts` and the prepared-card check/import from `plan-tools.ts`. Update Meta callers to `createMetaTools(root)`.

- [ ] **Step 4: Verify Runtime contains no semantic confirmation gate**

Run:

```bash
rg -n "NOT_CONFIRMED|latestStudentApprovedAssetSave|startsWithAffirmation|proposesSave|refusesSave" \
  apps/pi-teaching-web/src/runtime
bun test tests/m1c/meta-session.test.ts tests/m1b/free-learning-tools.test.ts \
  tests/m1c/session-asset-tools.test.ts tests/m1c/prepared-card-persistence.test.ts
```

Expected: `rg` returns no matches; focused tests pass.

- [ ] **Step 5: Commit the semantic-boundary change**

```bash
git add apps/pi-teaching-web/src/runtime/meta-tools.ts \
  apps/pi-teaching-web/src/runtime/learning-asset-tools.ts \
  apps/pi-teaching-web/src/runtime/free-learning-tools.ts \
  apps/pi-teaching-web/src/runtime/plan-tools.ts \
  apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/tests/e2e/fixture-server.ts \
  apps/pi-teaching-web/tests/m1c/meta-session.test.ts \
  apps/pi-teaching-web/tests/m1b/free-learning-tools.test.ts \
  apps/pi-teaching-web/tests/m1c/session-asset-tools.test.ts \
  apps/pi-teaching-web/tests/m1c/prepared-card-persistence.test.ts
git commit -m "fix: keep approval semantics out of runtime"
```

### Task 2: Make conversation activity truthful and private

**Files:**
- Create: `apps/pi-teaching-web/src/client/conversation-presentation.ts`
- Create: `apps/pi-teaching-web/src/client/public-errors.ts`
- Modify: `apps/pi-teaching-web/src/projection/conversation.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/state.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/ProblemCardPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/desktop/DesktopRoot.tsx`
- Modify: `apps/pi-teaching-web/src/client/desktop/DiagnosticPage.tsx`
- Test: `apps/pi-teaching-web/tests/m0/material-search-projection.test.ts`
- Test: `apps/pi-teaching-web/tests/m1d/entry-and-dialogue-ui.test.tsx`
- Test: `apps/pi-teaching-web/tests/m1d/public-errors.test.ts`

**Interfaces:**
- Produces: `presentConversation(items: ConversationItem[]): ConversationItem[]`.
- Produces: `waitingForTeacherCopy(sessionKey: SessionKey): string`.
- Produces: `publicErrorText(error: unknown, fallback?: string): string` and `publicSessionErrorText(): string`.

- [ ] **Step 1: Write failing presentation and privacy tests**

Cover one case per invariant:

```ts
const visible = presentConversation([
  tool('read', 'done'), tool('read', 'error'), tool('grep', 'running'),
]);
expect(visible).toHaveLength(1);
expect(visible[0]).toMatchObject({ kind: 'tool', name: 'discovery', status: 'running' });
expect(waitingForTeacherCopy('meta:abc')).toContain('长期方向');
expect(publicErrorText(new Error('ResolveMessage: /private/tmp/x')))
  .not.toMatch(/ResolveMessage|private\/tmp/);
```

Render `ChatPanel` with `sessionKey="plan:plan-001"`, a read ENOENT error, and `running`;
assert no Session key, no “这一步没有完成”, one truthful Plan waiting line, and no raw detail.

- [ ] **Step 2: Run presentation tests and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1d/entry-and-dialogue-ui.test.tsx \
  tests/m1d/public-errors.test.ts tests/m0/material-search-projection.test.ts
```

Expected: missing presentation/error helpers and current raw tool detail assertions fail.

- [ ] **Step 3: Implement the student-facing presentation boundary**

`conversation-presentation.ts` must filter all generic tool errors and merge consecutive
`read|grep|find|ls` items into one synthetic `name: 'discovery'` item. It must not alter assistant/user messages or dedicated activity items. Map actual tools to concise running/done copy and use Session-specific waiting copy:

```ts
const waitingCopy = {
  meta: '老师正在梳理你的长期学习方向…',
  roadmap: '老师正在整理下一阶段的学习安排…',
  plan: '老师正在准备这一阶段的课堂…',
  lesson: '老师正在思考你刚才的学习表现与下一步…',
  free: '老师正在思考你刚才的问题…',
} as const;
```

In conversation projection, set generic tool `detail` to `null` for both history and live events. In `ChatPanel`, render `presentConversation(items)`, remove the Session-key `<code>`, suppress the generic waiting line whenever any real activity is running, and use the tool/session copy helpers.

- [ ] **Step 4: Sanitize whole-run errors without hiding recoverable work**

Publish `publicSessionErrorText()` from the server instead of the caught exception message. Use `publicErrorText` in App, problem-card actions, DesktopRoot, and the client reducer. Starting a new Session run clears its previous visible error. DiagnosticPage keeps the product-level issue title but removes raw `issue.detail` and internal SDK/path output.

- [ ] **Step 5: Run focused tests and commit**

```bash
cd apps/pi-teaching-web
bun test tests/m1d/entry-and-dialogue-ui.test.tsx \
  tests/m1d/public-errors.test.ts tests/m0/material-search-projection.test.ts
cd ../..
git add apps/pi-teaching-web/src/client/conversation-presentation.ts \
  apps/pi-teaching-web/src/client/public-errors.ts \
  apps/pi-teaching-web/src/projection/conversation.ts \
  apps/pi-teaching-web/src/server/app.ts \
  apps/pi-teaching-web/src/client/components/ChatPanel.tsx \
  apps/pi-teaching-web/src/client/state.ts apps/pi-teaching-web/src/client/App.tsx \
  apps/pi-teaching-web/src/client/pages/ProblemCardPage.tsx \
  apps/pi-teaching-web/src/client/desktop/DesktopRoot.tsx \
  apps/pi-teaching-web/src/client/desktop/DiagnosticPage.tsx \
  apps/pi-teaching-web/tests/m0/material-search-projection.test.ts \
  apps/pi-teaching-web/tests/m1d/entry-and-dialogue-ui.test.tsx \
  apps/pi-teaching-web/tests/m1d/public-errors.test.ts
git commit -m "fix: project private agent work as student-safe progress"
```

### Task 3: Repair help media, title Markdown, and route scroll

**Files:**
- Create: `apps/pi-teaching-web/src/client/route-scroll.ts`
- Modify: `apps/pi-teaching-web/src/client/components/MarkdownView.tsx`
- Modify: `apps/pi-teaching-web/src/client/desktop/HelpPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/AssetsPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/ProblemCardPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Test: `apps/pi-teaching-web/tests/m0/math-markdown.test.tsx`
- Test: `apps/pi-teaching-web/tests/m1b/m1b-ui.test.tsx`
- Test: `apps/pi-teaching-web/tests/m1d/navigation-scroll.test.ts`

**Interfaces:**
- Extends: `MarkdownView({ children, inline?, allowDataImages? })`.
- Produces: `resetRouteScroll(target?: Pick<Window, 'scrollTo'>): void`.

- [ ] **Step 1: Add failing render and scroll tests**

Assert these exact observable outcomes:

```ts
expect(render(<MarkdownView allowDataImages>{'![图](data:image/png;base64,AAAA)'}</MarkdownView>))
  .toContain('src="data:image/png;base64,AAAA"');
expect(render(<MarkdownView inline>{'**参数主元**'}</MarkdownView>))
  .toBe('<strong>参数主元</strong>');

const calls: unknown[] = [];
resetRouteScroll({ scrollTo: (value) => calls.push(value) } as never);
expect(calls).toEqual([{ top: 0, left: 0, behavior: 'auto' }]);
```

Render AssetsPage and ProblemCardPage with `**参数主元**`; assert no literal asterisks remain and `<strong>` exists.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
cd apps/pi-teaching-web
bun test tests/m0/math-markdown.test.tsx tests/m1b/m1b-ui.test.tsx \
  tests/m1d/navigation-scroll.test.ts
```

- [ ] **Step 3: Implement narrowly scoped Markdown rendering**

Use React Markdown's `defaultUrlTransform` for normal URLs. Permit only
`data:image/png;base64,` when `allowDataImages` is true; do not allow data images in ordinary teaching messages. When `inline` is true, replace the generated paragraph with a Fragment. Pass `allowDataImages` only from HelpPage and `inline` only for asset titles.

- [ ] **Step 4: Reset scroll only on actual navigation**

Call `resetRouteScroll()` from `navigate()` and the `popstate` handler before loading the new route. Do not call it inside `loadRoute`, because WebSocket invalidations refresh the current route and must not move the student's reading position.

- [ ] **Step 5: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/m0/math-markdown.test.tsx tests/m1b/m1b-ui.test.tsx \
  tests/m1d/navigation-scroll.test.ts tests/desktop/help-content.test.ts \
  tests/desktop/desktop-api.test.ts
cd ../..
git add apps/pi-teaching-web/src/client/route-scroll.ts \
  apps/pi-teaching-web/src/client/components/MarkdownView.tsx \
  apps/pi-teaching-web/src/client/desktop/HelpPage.tsx \
  apps/pi-teaching-web/src/client/pages/AssetsPage.tsx \
  apps/pi-teaching-web/src/client/pages/ProblemCardPage.tsx \
  apps/pi-teaching-web/src/client/App.tsx \
  apps/pi-teaching-web/tests/m0/math-markdown.test.tsx \
  apps/pi-teaching-web/tests/m1b/m1b-ui.test.tsx \
  apps/pi-teaching-web/tests/m1d/navigation-scroll.test.ts
git commit -m "fix: restore readable navigation and offline help"
```

### Task 4: Put the active model configuration first

**Files:**
- Modify: `apps/pi-teaching-web/src/client/desktop/ModelSettings.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles/desktop.css`
- Test: `apps/pi-teaching-web/tests/desktop/desktop-ui.test.tsx`

**Interfaces:**
- Produces: `providerSections(catalog, teacher, scout)` returning `{ primary, other }` with current providers first, then configured providers, then unconfigured providers in `other`.

- [ ] **Step 1: Write the failing settings hierarchy test**

Build a catalog with one current Provider, one other configured Provider, and two unconfigured Providers. Render ModelSettings and assert:

```ts
expect(markup.indexOf('当前安排')).toBeLessThan(markup.indexOf('连接模型服务'));
expect(markup).toContain('连接其他 Provider · 2');
expect(markup).toContain('<details');
expect(markup).not.toContain('<details open');
```

Also assert all Provider names and all model options remain in the markup.

- [ ] **Step 2: Run the desktop UI test and verify RED**

```bash
cd apps/pi-teaching-web
bun test tests/desktop/desktop-ui.test.tsx
```

- [ ] **Step 3: Implement progressive disclosure**

Render a compact “当前安排” section naming the selected teacher and Scout before Provider controls. Render current/connected Providers in the main ledger, sorted with current first. Put every remaining Provider under a closed `<details>` summary. Keep both model selects and every catalog option unchanged; only sort the currently selected model/provider to the front when building options.

- [ ] **Step 4: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/desktop/desktop-ui.test.tsx tests/desktop/model-service.test.ts
cd ../..
git add apps/pi-teaching-web/src/client/desktop/ModelSettings.tsx \
  apps/pi-teaching-web/src/client/styles/desktop.css \
  apps/pi-teaching-web/tests/desktop/desktop-ui.test.tsx
git commit -m "fix: surface the active model arrangement"
```

### Task 5: Full release verification and real DMG smoke

**Files:**
- Modify only if a verified defect requires a scoped correction.

**Interfaces:**
- Consumes all preceding tasks; produces a verified DMG.

- [ ] **Step 1: Run the complete application gate**

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts tests/e2e/m1b-cycle.spec.ts \
  tests/e2e/m1c-cycle.spec.ts tests/e2e/m1d-ui.spec.ts
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: typecheck, all Bun tests, Vite build, four Playwright suites, and Rust tests pass.

- [ ] **Step 2: Build and verify the packaged app**

```bash
cd apps/pi-teaching-web
bun run desktop:smoke
bun run desktop:build
bun run desktop:verify
```

Expected: sidecar smoke passes; DMG exists and contains valid signed arm64 Runtime/Pi sidecars plus all help images.

- [ ] **Step 3: Run a real installed-package smoke**

Mount the new DMG into a fresh temporary directory and use a fresh app-home/documents-home. Verify:

1. Help images render.
2. Settings opens with current teacher/Scout before the collapsed other Provider list.
3. A natural Roadmap confirmation creates `ROADMAP.md` without a machine phrase.
4. First Plan materialization does not show an intermediate failure if the model probes the future path.
5. Switching Home → Assets → problem card always starts at the top.
6. No visible surface contains `API_ERROR`, `ResolveMessage`, `meta:`, `plan:` or an absolute temporary path.

- [ ] **Step 4: Record verification and commit only necessary acceptance updates**

If no tracked acceptance artifact needs a change, do not create one. Confirm `git status --short`, inspect every staged path, and leave unrelated pre-existing files untouched.
