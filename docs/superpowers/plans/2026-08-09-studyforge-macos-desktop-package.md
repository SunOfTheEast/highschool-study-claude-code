# StudyForge macOS Desktop Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task. For every behavior change, use `superpowers:test-driven-development`; before declaring completion, use `superpowers:verification-before-completion`.

**Goal:** Ship an Apple Silicon macOS beta that opens StudyForge without a preinstalled Bun, Node, or Pi, keeps its Pi credentials and sessions isolated, supports first-run learning-set/model setup, and includes offline Chinese help.

**Architecture:** A single Tauri window hosts the existing React application. Tauri owns only native folder dialogs and sidecar lifecycle. The bundle contains two Bun-compiled executables: `studyforge-runtime` serves the existing teaching runtime plus a small desktop-control API, while `studyforge-pi` is the Pi CLI child used by `pi-subagents`. Both receive an explicit StudyForge agent home and read bundled teaching resources through an explicit resource root. Markdown learning sets remain the source of truth.

**Tech Stack:** Tauri 2, Rust, Bun 1.3, TypeScript 7, React 19, Vite 8, Bun test, Playwright.

## Product and visual constraints

- **Visual thesis:** 一张刚铺开的宣纸学习桌；温润象牙底、墨色层级，朱砂只用于当前主行动，安静而有判断力。
- **Content plan:** 首启页先给一个占主导地位的“空白开始”，已有学习集和导数示例是两行安静入口；模型页采用账簿式纵向编排；诊断页是一张状态单；帮助页是一份可阅读、可打印的纸面文档。
- **Interaction thesis:** 首启步骤以 180–240ms 纸页显现；主行动有轻微落章反馈；运行时 ready 后只做一次克制的横向换页；遵循 `prefers-reduced-motion`。
- 复用现有 M1d 字体、留白、墨色和朱砂 tokens，不引入渐变、SaaS 卡片墙、图标拼盘或第二套页面组件。
- Rust 不读取或修改教学文档；教学语义仍只存在于 TypeScript Runtime。
- 不为假设性平台、自动更新、云同步、遥测或多窗口预留抽象。
- 测试只覆盖新增边界：路径隔离、可执行包自包含、首启状态、认证/模型映射、进程协议和桌面 UI。不得复制 M0–M1d 教学测试。

---

## Task 1: 固化桌面配置与三种 learning set 入口

**Files:**
- Create: `apps/pi-teaching-web/src/desktop/contracts.ts`
- Create: `apps/pi-teaching-web/src/desktop/app-config.ts`
- Create: `apps/pi-teaching-web/src/desktop/learning-sets.ts`
- Create: `apps/pi-teaching-web/resources/templates/blank-learning-set/LEARNING_GUIDE.md`
- Create: `apps/pi-teaching-web/resources/templates/blank-learning-set/memory/INDEX.md`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/src/runtime/subagent-path.ts`
- Test: `apps/pi-teaching-web/tests/desktop/app-config.test.ts`
- Test: `apps/pi-teaching-web/tests/desktop/learning-sets.test.ts`
- Test: `apps/pi-teaching-web/tests/m0/subagent-path.test.ts`

**Step 1 — RED:** Write focused tests that prove:

1. default paths resolve below an explicitly supplied Application Support/Documents root and never below `~/.pi`;
2. `app.json` round-trips only desktop settings and rejects malformed selected paths/models;
3. blank creation emits only `LEARNING_GUIDE.md` and `memory/INDEX.md`;
4. existing sets are validated read-only;
5. derivative example is copied into a fresh user-owned destination;
6. resource and subagent roots honor `STUDYFORGE_RESOURCE_ROOT`.

Run:

```bash
cd apps/pi-teaching-web
bun test tests/desktop/app-config.test.ts tests/desktop/learning-sets.test.ts tests/m0/subagent-path.test.ts
```

Expected: FAIL because desktop modules and resource-root override do not exist.

**Step 2 — GREEN:** Implement the smallest synchronous filesystem domain needed by those tests. Use atomic temp-file rename for `app.json`; reject an existing destination rather than merging or overwriting it. Keep `StudyForgeAppConfig` versioned at `1` and store only `onboardingComplete`, selected/recent learning-set paths, and teacher/scout model selections.

**Step 3 — verify:** Re-run the focused tests and `bun run typecheck`.

**Step 4 — commit:**

```bash
git add apps/pi-teaching-web/src/desktop apps/pi-teaching-web/resources/templates apps/pi-teaching-web/src/runtime/resource-loader.ts apps/pi-teaching-web/src/runtime/subagent-path.ts apps/pi-teaching-web/tests/desktop apps/pi-teaching-web/tests/m0/subagent-path.test.ts
git commit -m "feat: add isolated desktop workspace configuration"
```

---

## Task 2: 绑定独立 Pi Home、模型选择与 Scout override

**Files:**
- Create: `apps/pi-teaching-web/src/desktop/model-service.ts`
- Create: `apps/pi-teaching-web/src/desktop/pi-settings.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/resources/subagents/study-material-scout.md`
- Modify: `apps/pi-teaching-web/resources/subagents/lesson-risk-reviewer.md`
- Test: `apps/pi-teaching-web/tests/desktop/model-service.test.ts`
- Test: `apps/pi-teaching-web/tests/desktop/pi-settings.test.ts`
- Test: `apps/pi-teaching-web/tests/m0/native-session.test.ts`

**Step 1 — RED:** Add tests for a `PiRuntimeOptions` boundary that requires explicit `agentDir`, `authPath`, `modelsPath`, teacher model and thinking. Prove the resulting session factory passes the teacher selection to root sessions and writes `settings.json` overrides so `study-material-scout` uses Scout while `lesson-risk-reviewer` follows the teacher. Add a temp-HOME sentinel assertion showing no StudyForge path resolves into `~/.pi`.

Run:

```bash
cd apps/pi-teaching-web
bun test tests/desktop/model-service.test.ts tests/desktop/pi-settings.test.ts tests/m0/native-session.test.ts
```

Expected: FAIL on the missing options and services.

**Step 2 — GREEN:** Create one `ModelRuntime` against the explicit credential/model files; expose provider, auth-status, model and thinking metadata without re-implementing provider-specific rules. Persist only model choices in `app.json` and write Pi subagent overrides to the isolated agent `settings.json`. Remove model/thinking pins from the two packaged subagent frontmatters so those explicit overrides can actually take effect. Do not silently fall back when a configured model is unavailable.

**Step 3 — verify:** Re-run focused tests and typecheck.

**Step 4 — commit:**

```bash
git add apps/pi-teaching-web/src/desktop apps/pi-teaching-web/src/runtime/session-factory.ts apps/pi-teaching-web/tests/desktop apps/pi-teaching-web/tests/m0/native-session.test.ts
git commit -m "feat: isolate desktop pi models and subagents"
```

---

## Task 3: 增加窄桌面控制 API、启动令牌与可配置前端传输

**Files:**
- Create: `apps/pi-teaching-web/src/server/desktop-app.ts`
- Create: `apps/pi-teaching-web/src/server/start-server.ts`
- Create: `apps/pi-teaching-web/src/client/transport.ts`
- Modify: `apps/pi-teaching-web/src/server/index.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Test: `apps/pi-teaching-web/tests/desktop/desktop-api.test.ts`
- Test: `apps/pi-teaching-web/tests/desktop/runtime-protocol.test.ts`
- Test: `apps/pi-teaching-web/tests/desktop/transport.test.ts`

**Step 1 — RED:** Prove that desktop mode:

- serves health/status before a learning set is selected;
- requires the exact in-memory bearer token for HTTP and a token-bearing WebSocket subprotocol;
- exposes only learning-set, provider/model, help and shutdown control operations;
- separates invalid learning set, unauthenticated provider, unavailable model and runtime failure;
- emits exactly one JSON ready line with protocol version and selected random port;
- leaves browser-mode relative URLs and unauthenticated local development unchanged.

Run:

```bash
cd apps/pi-teaching-web
bun test tests/desktop/desktop-api.test.ts tests/desktop/runtime-protocol.test.ts tests/desktop/transport.test.ts tests/m0/server-api.test.ts
```

Expected: FAIL because desktop transport and protocol do not exist.

**Step 2 — GREEN:** Extract `startStudyForgeServer`. In desktop mode, compose the narrow control handler before the existing teaching handler, bind only `127.0.0.1`, accept port `0`, redact secrets from responses, and print the ready receipt only after listeners and selected workspace initialization succeed. Add `configureTransport({apiBase, token})`; all existing API calls and `/events` use it while web development keeps current relative behavior.

**Step 3 — verify:** Re-run focused tests, typecheck, and existing server tests.

**Step 4 — commit:**

```bash
git add apps/pi-teaching-web/src/server apps/pi-teaching-web/src/client/api.ts apps/pi-teaching-web/src/client/App.tsx apps/pi-teaching-web/src/client/transport.ts apps/pi-teaching-web/tests/desktop
git commit -m "feat: expose authenticated desktop runtime protocol"
```

---

## Task 4: 建立 Tauri 壳与 sidecar 生命周期

**Files:**
- Create: `apps/pi-teaching-web/src-tauri/Cargo.toml`
- Create: `apps/pi-teaching-web/src-tauri/build.rs`
- Create: `apps/pi-teaching-web/src-tauri/tauri.conf.json`
- Create: `apps/pi-teaching-web/src-tauri/capabilities/default.json`
- Create: `apps/pi-teaching-web/src-tauri/icons/*`
- Create: `apps/pi-teaching-web/src-tauri/src/main.rs`
- Create: `apps/pi-teaching-web/src-tauri/src/lib.rs`
- Create: `apps/pi-teaching-web/src-tauri/src/sidecar.rs`
- Modify: `apps/pi-teaching-web/package.json`
- Modify: `apps/pi-teaching-web/bun.lock`

**Step 1 — prerequisite:** Install the official minimal Rust toolchain required by Tauri and record exact versions in the execution report.

**Step 2 — RED:** Add Rust unit tests for ready-line parsing, child state transition (`starting → ready → stopped/crashed`), and construction of explicit app-home/resource-root/agent-home environment. Tests must not spawn a fake teaching model.

Run:

```bash
cd apps/pi-teaching-web/src-tauri
cargo test
```

Expected: FAIL until the sidecar module exists.

**Step 3 — GREEN:** Scaffold a single-window Tauri 2 app. On setup, generate an in-memory token, launch `studyforge-runtime`, parse its ready receipt, and expose commands for runtime connection info, restart, folder selection, Finder reveal, external URL, help and clean shutdown. Resolve bundled `studyforge-pi` and pass it as `PI_SUBAGENT_PI_BINARY`. Do not expose arbitrary shell execution.

**Step 4 — verify:** Run `cargo test`, `cargo clippy -- -D warnings`, and `bun run typecheck`.

**Step 5 — commit:**

```bash
git add apps/pi-teaching-web/src-tauri apps/pi-teaching-web/package.json apps/pi-teaching-web/bun.lock
git commit -m "feat: add studyforge macos shell"
```

---

## Task 5: 实现首启、设置、诊断与离线帮助界面

**Files:**
- Create: `apps/pi-teaching-web/src/client/desktop/bridge.ts`
- Create: `apps/pi-teaching-web/src/client/desktop/DesktopRoot.tsx`
- Create: `apps/pi-teaching-web/src/client/desktop/FirstRun.tsx`
- Create: `apps/pi-teaching-web/src/client/desktop/ModelSettings.tsx`
- Create: `apps/pi-teaching-web/src/client/desktop/DiagnosticPage.tsx`
- Create: `apps/pi-teaching-web/src/client/desktop/HelpPage.tsx`
- Create: `apps/pi-teaching-web/src/client/styles/desktop.css`
- Modify: `apps/pi-teaching-web/src/client/main.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/AppShell.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Test: `apps/pi-teaching-web/tests/desktop/desktop-ui.test.tsx`
- Test: `apps/pi-teaching-web/tests/e2e/desktop-onboarding.spec.ts`

**Step 1 — RED:** Component tests cover the actual student decisions: blank start is dominant; existing/example are quieter; setup cannot complete without one available teacher and Scout model; “你安排” is not invented as a model fallback; diagnostic actions reflect typed status; browser mode still renders `<App />`. E2E uses a deterministic fake desktop bridge, not fake teaching semantics.

Run:

```bash
cd apps/pi-teaching-web
bun test tests/desktop/desktop-ui.test.tsx
bun run test:e2e -- tests/e2e/desktop-onboarding.spec.ts
```

Expected: FAIL because desktop UI does not exist.

**Step 2 — GREEN:** Implement the four paper-like surfaces using existing tokens/components. Add settings/help entry points to the desktop header only. Keep provider forms data-driven from Pi prompt descriptors. Use the approved motion thesis and reduced-motion override.

**Step 3 — verify:** Run focused component/E2E tests, `bun run build`, and inspect desktop widths at 1280×800 and 1512×982.

**Step 4 — commit:**

```bash
git add apps/pi-teaching-web/src/client apps/pi-teaching-web/tests/desktop/desktop-ui.test.tsx apps/pi-teaching-web/tests/e2e/desktop-onboarding.spec.ts
git commit -m "feat: add macos first run and settings experience"
```

---

## Task 6: 构建自包含双 sidecar 并验证真实 Scout 子进程

**Files:**
- Create: `apps/pi-teaching-web/src/desktop/pi-cli.ts`
- Create: `apps/pi-teaching-web/scripts/desktop/build-sidecars.ts`
- Create: `apps/pi-teaching-web/scripts/desktop/package-resources.ts`
- Create: `apps/pi-teaching-web/scripts/desktop/smoke-sidecars.ts`
- Modify: `apps/pi-teaching-web/package.json`
- Modify: `apps/pi-teaching-web/src-tauri/tauri.conf.json`
- Test: `apps/pi-teaching-web/tests/desktop/sidecar-build.test.ts`

**Step 1 — RED:** Add a packaging contract test that verifies target-suffixed external binaries, bundled resource paths, and launch without `bun`, `node` or system `pi` on `PATH`.

**Step 2 — GREEN:** Use `bun build --compile --target=bun-darwin-arm64` to produce:

- `src-tauri/binaries/studyforge-runtime-aarch64-apple-darwin` from the server entry;
- `src-tauri/binaries/studyforge-pi-aarch64-apple-darwin` from Pi’s Bun CLI entry/wrapper.

Copy only canonical resources and the derivative example into the Tauri resource bundle. Never copy credentials or test sessions.

**Step 3 — real child smoke:** Start compiled `studyforge-runtime` with an empty `PATH`, temp app home and derivative example copy. Verify health, create a real Pi root Session with the configured model, trigger one bounded Scout request, and confirm the child executable path is the bundled `studyforge-pi`. If provider credentials are absent, report the real-model portion as blocked rather than substituting a fake pass.

**Step 4 — verify:** Run the packaging test, sidecar smoke and `file`/`otool -L` checks.

**Step 5 — commit:**

```bash
git add apps/pi-teaching-web/src/desktop/pi-cli.ts apps/pi-teaching-web/scripts/desktop apps/pi-teaching-web/tests/desktop/sidecar-build.test.ts apps/pi-teaching-web/package.json apps/pi-teaching-web/src-tauri/tauri.conf.json
git commit -m "build: bundle studyforge runtime and pi sidecars"
```

---

## Task 7: 写入离线教程并用成品截图核验

**Files:**
- Create: `apps/pi-teaching-web/resources/help/macos-installation.md`
- Create: `apps/pi-teaching-web/resources/help/first-learning.md`
- Create: `apps/pi-teaching-web/resources/help/images/*.png`
- Modify: `README.md`
- Modify: `apps/pi-teaching-web/src/server/desktop-app.ts`
- Test: `apps/pi-teaching-web/tests/desktop/help-content.test.ts`

**Step 1 — RED:** Test that every required task is present, every local screenshot reference resolves, no terminal command is required of students, and installation text accurately states ad-hoc signing/Gatekeeper limitations.

**Step 2 — GREEN:** Write the two concise Chinese guides. Build and run the actual desktop app, capture first-run, model choice, learning start and save-confirmation screens, then insert those images. Link the same canonical guides from the root README; do not maintain duplicate prose.

**Step 3 — verify:** Run the help test and manually follow both guides from top to bottom against the built app.

**Step 4 — commit:**

```bash
git add apps/pi-teaching-web/resources/help apps/pi-teaching-web/src/server/desktop-app.ts apps/pi-teaching-web/tests/desktop/help-content.test.ts README.md
git commit -m "docs: add offline studyforge macos guides"
```

---

## Task 8: 生成 ad-hoc signed DMG 并完成发布验收

**Files:**
- Create: `apps/pi-teaching-web/scripts/desktop/verify-bundle.ts`
- Create: `apps/pi-teaching-web/docs/desktop-release-checklist.md`
- Modify: `apps/pi-teaching-web/package.json`

**Step 1 — automated suite:** Run from `apps/pi-teaching-web`:

```bash
bun run check
bun run test:e2e
bun run desktop:build
bun run desktop:verify
```

The verifier mounts the DMG, checks the `.app`, both sidecars and bundled help/resources, runs `codesign --verify --deep --strict`, and confirms the bundle is arm64.

**Step 2 — fresh-home smoke:** With fresh temporary `HOME`, Application Support and Documents roots, and an explicit `~/.pi` sentinel:

1. launch the built `.app`;
2. create a blank set;
3. authenticate/select models if required;
4. save one Note through a real free-learning session;
5. quit/reopen and recover it;
6. switch to a derivative-example copy;
7. invoke Scout once;
8. assert the `~/.pi` sentinel is byte-identical.

Record any step requiring a human Gatekeeper click as a manual beta limitation, not an automated success.

**Step 3 — visual review:** Capture final desktop screenshots at both target sizes; check hierarchy, overflow, formula rendering, focus order and reduced motion. Fix only observed defects.

**Step 4 — final evidence:** Record toolchain versions, test counts, binary hashes, DMG path/size, signing output, real-model provider/model, Scout child path, and any unresolved beta limitations in `apps/pi-teaching-web/docs/desktop-release-checklist.md`.

**Step 5 — commit:**

```bash
git add apps/pi-teaching-web/scripts/desktop/verify-bundle.ts apps/pi-teaching-web/docs/desktop-release-checklist.md apps/pi-teaching-web/package.json
git commit -m "release: build studyforge macos beta"
```

## Completion boundary

The implementation is complete only when a DMG exists and the full automated suite, bundle verification, isolated-path sentinel, restart persistence and real packaged Scout path have evidence. A missing real Provider credential may block only the real-model answer quality check; it may not be replaced by a mock or used to waive packaging, path isolation or child-process verification.
