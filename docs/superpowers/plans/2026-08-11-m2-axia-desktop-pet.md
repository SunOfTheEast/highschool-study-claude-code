# StudyForge M2 Axia Desktop Pet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the duplicate in-page Axia embodiment with one app-scoped macOS Live2D desktop-pet window that reuses the existing Peer message, TTS, and Pi Session chain.

**Architecture:** Add one transparent `companion` Tauri WebView beside the existing `main` window. A small native in-memory projection bridge carries only the current public Peer presentation and playback receipt; the companion owns TTS and Live2D playback, while the main window remains the only Pi Session consumer. A separate macOS-only preparation command normalizes the user's local VTube Studio package into the existing private actor slot without tracking or bundling the source model.

**Tech Stack:** Tauri 2 / Rust, React 19 / TypeScript, Bun tests, PixiJS 8, `untitled-pixi-live2d-engine`, macOS `sips`.

## Global Constraints

- Work only in `/Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/m2-free-learning-peer` on `codex/m2-free-learning-peer`.
- Preserve the pre-existing uncommitted `media-src 'self' blob:` CSP change and its test; do not absorb them into feature commits.
- Keep exactly one Pi/Peer Session chain and exactly one TTS playback owner; the companion is a derived projection, never an Agent.
- Remove the Live2D model from the desktop Free Learning page when the companion is available; keep the full Peer text in the timeline.
- Do not add a localhost control service, MCP server, database, second Session subscription, autonomous chatter, or a generic avatar marketplace.
- Keep the downloaded “水色小狗” files, generated runtime copy, Cubism Core, voice assets, and all absolute private paths out of Git and public DMGs.
- The public app must still work with a quiet placeholder when private Live2D files are absent.
- Use deterministic truncation for the bubble; do not call a model to summarize it.
- Limit imported runtime textures to 2048 pixels on their longest edge; preserve the source package byte-for-byte.
- Apply TDD for every production behavior: focused RED, observed failure, minimal GREEN, focused pass, then refactor.

---

### Task 1: Native Companion Window and In-Memory Projection Bridge

**Files:**
- Create: `apps/pi-teaching-web/src-tauri/src/companion.rs`
- Create: `apps/pi-teaching-web/tests/m2/companion-shell.test.ts`
- Modify: `apps/pi-teaching-web/src-tauri/src/lib.rs`
- Modify: `apps/pi-teaching-web/src-tauri/tauri.conf.json`
- Modify: `apps/pi-teaching-web/src-tauri/capabilities/default.json`

**Interfaces:**
- Produces Rust commands `companion_snapshot`, `companion_present`, `companion_set_playback`, `companion_control`, `show_main_window`, `show_companion_window`, `hide_companion_window`, and `quit_studyforge`.
- Produces Tauri events `studyforge:companion-presentation`, `studyforge:companion-playback`, and `studyforge:companion-control`.
- Produces one `companion` window at `/?window=companion`, 340×560, transparent, undecorated, always on top, non-resizable, shadowless, and absent from the task switcher.

- [ ] **Step 1: Write the failing shell/config test**

Add assertions that parse `tauri.conf.json` and `capabilities/default.json`:

```ts
test('declares one app-scoped companion beside the existing main window', () => {
  expect(config.app.windows.map((window) => window.label)).toEqual(['main', 'companion']);
  expect(config.app.windows[1]).toMatchObject({
    url: '/?window=companion', width: 340, height: 560,
    transparent: true, decorations: false, alwaysOnTop: true,
    skipTaskbar: true, shadow: false, resizable: false,
  });
  expect(capability.windows).toEqual(['main', 'companion']);
});
```

Also assert the companion capability includes only the window operations actually used: cursor position, inner position, scale factor, set-ignore-cursor-events, set-position, start-dragging, show, hide, and focus.

- [ ] **Step 2: Run the focused test and observe RED**

Run: `bun test tests/m2/companion-shell.test.ts`

Expected: FAIL because only the implicit main window exists and the companion capability is absent.

- [ ] **Step 3: Add the pure native state transition test**

In `companion.rs`, test a small state object before wiring Tauri commands:

```rust
#[test]
fn finished_playback_clears_only_the_matching_live_presentation() {
    let mut state = CompanionState::default();
    state.present(presentation("peer-1"));
    state.finish("older");
    assert_eq!(state.presentation.as_ref().unwrap().message_id, "peer-1");
    state.finish("peer-1");
    assert!(state.presentation.is_none());
}
```

- [ ] **Step 4: Run the Rust test and observe RED**

Run: `cargo test --manifest-path src-tauri/Cargo.toml companion`

Expected: FAIL because `companion.rs` and its state do not exist.

- [ ] **Step 5: Implement the minimal native bridge and window lifecycle**

Use serializable public projection types:

```rust
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CompanionPresentation {
    pub message_id: String,
    pub actor_id: String,
    pub text: String,
    pub expression: String,
    pub phase: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CompanionPlayback {
    pub message_id: Option<String>,
    pub phase: String,
    pub muted: bool,
}
```

Store only the current presentation/playback in `Arc<Mutex<CompanionState>>`. `companion_present`
updates the snapshot and emits to `companion`; `companion_set_playback` updates the receipt, clears a
matching finished presentation, and emits to `main`. Return `false` from present/control when the
companion window does not exist so the main UI never waits for a missing projection.

In `run()`, manage the state, register the commands, and use `on_window_event` so a close request for
`main` calls `prevent_close()` and hides the window. Keep the existing runtime stop behavior on app exit.

- [ ] **Step 6: Run focused native and Bun tests to GREEN**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml companion
bun test tests/m2/companion-shell.test.ts
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit only Task 1 hunks**

Stage the companion window/config hunks without staging the pre-existing CSP line:

```bash
git add apps/pi-teaching-web/src-tauri/src/companion.rs \
  apps/pi-teaching-web/src-tauri/src/lib.rs \
  apps/pi-teaching-web/src-tauri/capabilities/default.json \
  apps/pi-teaching-web/tests/m2/companion-shell.test.ts
git add -p apps/pi-teaching-web/src-tauri/tauri.conf.json
git commit -m "feat: add app-scoped companion window"
```

---

### Task 2: Single Playback Owner and Companion UI

**Files:**
- Create: `apps/pi-teaching-web/src/client/companion/contracts.ts`
- Create: `apps/pi-teaching-web/src/client/companion/bridge.ts`
- Create: `apps/pi-teaching-web/src/client/companion/CompanionRoot.tsx`
- Create: `apps/pi-teaching-web/src/client/companion/CompanionStage.tsx`
- Create: `apps/pi-teaching-web/src/client/companion/main-playback.ts`
- Create: `apps/pi-teaching-web/src/client/styles/companion.css`
- Create: `apps/pi-teaching-web/tests/m2/companion-projection.test.tsx`
- Modify: `apps/pi-teaching-web/src/client/main.tsx`
- Modify: `apps/pi-teaching-web/src/client/desktop/bridge.ts`
- Modify: `apps/pi-teaching-web/src/client/desktop/DesktopContext.tsx`
- Modify: `apps/pi-teaching-web/src/client/desktop/DesktopRoot.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/peer-playback.ts`

**Interfaces:**
- Consumes Task 1 commands/events through a typed `CompanionBridge`.
- Produces `useCompanionPeerPlayback(items, enabled, bridge)` with the existing `PeerPlaybackView` shape.
- Produces `CompanionRoot`, rendered only when `window=companion`.
- Keeps browser/non-Tauri development on the existing in-page playback path.

- [ ] **Step 1: Write failing projection and markup tests**

Cover three behaviors with real pure functions and server rendering:

```ts
test('publishes only a new live Axia item and never history', () => {
  expect(nextCompanionPresentation([history], new Set())).toBeNull();
  expect(nextCompanionPresentation([live], new Set())).toMatchObject({
    messageId: 'peer-1', actorId: 'peer-axia', phase: 'speaking',
  });
});

test('turns one peer message into a bounded non-semantic bubble', () => {
  expect(companionBubbleText(longMarkdown).length).toBeLessThanOrEqual(58);
  expect(companionBubbleText(longMarkdown)).not.toContain('\\frac');
});

test('desktop chat keeps Peer text but does not mount a second model', () => {
  expect(markup).toContain('阿夏');
  expect(markup).not.toContain('peer-embodiment');
});
```

- [ ] **Step 2: Run the focused test and observe RED**

Run: `bun test tests/m2/companion-projection.test.tsx`

Expected: FAIL because the companion contracts, bridge, root, and remote playback path do not exist.

- [ ] **Step 3: Implement typed bridge and remote playback projection**

Define the narrow browser contract:

```ts
export type CompanionBridge = {
  snapshot(): Promise<CompanionSnapshot>;
  present(value: CompanionPresentation | null): Promise<boolean>;
  control(value: CompanionControl): Promise<boolean>;
  setPlayback(value: CompanionPlayback): Promise<void>;
  onPresentation(listener: (value: CompanionPresentation | null) => void): Promise<() => void>;
  onPlayback(listener: (value: CompanionPlayback) => void): Promise<() => void>;
  onControl(listener: (value: CompanionControl) => void): Promise<() => void>;
  showMain(): Promise<void>;
  showCompanion(): Promise<void>;
  hideCompanion(): Promise<void>;
  quit(): Promise<void>;
};
```

The main hook marks a live Peer ID once, immediately enters `loading`, publishes the public message,
and derives timeline withholding only from the companion playback receipt. `stop`, `toggleMute`, and
formula reading send control events to the same owner. A failed `present()` returns to `idle` immediately.

- [ ] **Step 4: Move TTS and Live2D ownership into `CompanionRoot`**

Select the root in `main.tsx`:

```tsx
const companion = new URLSearchParams(window.location.search).get('window') === 'companion';
document.documentElement.dataset.studyforgeWindow = companion ? 'companion' : 'main';
createRoot(document.getElementById('root')!).render(
  <StrictMode>{companion ? <CompanionRoot /> : <DesktopRoot />}</StrictMode>,
);
```

`CompanionRoot` waits for `runtimeConnection`, calls the existing `configureTransport`, reads the
native snapshot, listens for presentation/control events, and feeds exactly one synthetic live Peer item
into the existing `usePeerPlayback`. It publishes `loading/speaking/idle` receipts back to main and clears
the matching presentation after finish or mute. Reuse `PeerEmbodiment`/`PeerLive2D`; do not create a second
renderer.

- [ ] **Step 5: Split ChatPanel into local and companion-backed owners**

Keep one shared markup component. In desktop context render it with `useCompanionPeerPlayback`; in browser
tests/development render it with the existing `usePeerPlayback` and in-page `PeerEmbodiment`. This avoids
conditional hooks and preserves browser fallback while guaranteeing one model in the packaged app.

- [ ] **Step 6: Run the focused M2 suite to GREEN**

Run:

```bash
bun test tests/m2/companion-projection.test.tsx \
  tests/m2/peer-playback.test.tsx \
  tests/m2/live2d-audio-boundary.test.ts
bun run typecheck
```

Expected: all focused tests and typecheck exit 0.

- [ ] **Step 7: Commit Task 2**

```bash
git add apps/pi-teaching-web/src/client/companion \
  apps/pi-teaching-web/src/client/styles/companion.css \
  apps/pi-teaching-web/src/client/main.tsx \
  apps/pi-teaching-web/src/client/desktop/bridge.ts \
  apps/pi-teaching-web/src/client/desktop/DesktopContext.tsx \
  apps/pi-teaching-web/src/client/desktop/DesktopRoot.tsx \
  apps/pi-teaching-web/src/client/components/ChatPanel.tsx \
  apps/pi-teaching-web/src/client/peer-playback.ts \
  apps/pi-teaching-web/tests/m2/companion-projection.test.tsx
git commit -m "feat: project peer playback into desktop pet"
```

---

### Task 3: Desktop Interaction and Recovery Controls

**Files:**
- Create: `apps/pi-teaching-web/src/client/companion/window-controls.ts`
- Create: `apps/pi-teaching-web/tests/m2/companion-window-controls.test.ts`
- Modify: `apps/pi-teaching-web/src/client/companion/CompanionStage.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles/companion.css`
- Modify: `apps/pi-teaching-web/src/client/desktop/ModelSettings.tsx`
- Modify: `apps/pi-teaching-web/src/client/desktop/DesktopRoot.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles/desktop.css`
- Modify: `apps/pi-teaching-web/tests/desktop/desktop-ui.test.tsx`

**Interfaces:**
- Produces pure `pointInCompanionTarget` and `restoreCompanionPosition` helpers.
- Uses only Tauri's current-window cursor/position/drag operations granted in Task 1.
- Adds a settings action that can re-show a hidden companion.

- [ ] **Step 1: Write failing geometry and settings tests**

```ts
test('restores a saved position only when it intersects a current monitor', () => {
  expect(restoreCompanionPosition(saved, monitors, size)).toEqual(saved);
  expect(restoreCompanionPosition(offscreen, monitors, size)).toEqual({ x: 1050, y: 280 });
});

test('settings always offers a quiet way to show the desktop companion', () => {
  expect(markup).toContain('显示阿夏桌宠');
});
```

- [ ] **Step 2: Run the focused tests and observe RED**

Run:

```bash
bun test tests/m2/companion-window-controls.test.ts tests/desktop/desktop-ui.test.tsx
```

Expected: FAIL because position helpers and the settings action do not exist.

- [ ] **Step 3: Implement restrained window controls**

Use a 120 ms cursor hit-test against the model hit target and the open context menu. Call
`setIgnoreCursorEvents(true)` only when the cursor is outside both. Start native dragging after a four-pixel
pointer movement; persist the physical window position after `onMoved`; restore it only if it intersects an
available monitor, otherwise use a bottom-right inset on the primary monitor.

Double-click calls `showMain()`. The custom right-click menu contains exactly `静音/开声`, `隐藏桌宠`, and
`退出 StudyForge`. A speaking bubble uses `companionBubbleText` and disappears with playback. It does not
render Markdown, tables, or KaTeX.

- [ ] **Step 4: Add the settings recovery action**

Pass `onShowCompanion` into `ModelSettings` and render one quiet `显示阿夏桌宠` button beside the existing
voice section. It invokes Task 1's `show_companion_window`; it does not add avatar configuration or model
selection UI.

- [ ] **Step 5: Run focused tests and typecheck to GREEN**

Run:

```bash
bun test tests/m2/companion-window-controls.test.ts \
  tests/m2/companion-projection.test.tsx \
  tests/desktop/desktop-ui.test.tsx
bun run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit Task 3**

```bash
git add apps/pi-teaching-web/src/client/companion \
  apps/pi-teaching-web/src/client/styles/companion.css \
  apps/pi-teaching-web/src/client/desktop/ModelSettings.tsx \
  apps/pi-teaching-web/src/client/desktop/DesktopRoot.tsx \
  apps/pi-teaching-web/src/client/styles/desktop.css \
  apps/pi-teaching-web/tests/m2/companion-window-controls.test.ts \
  apps/pi-teaching-web/tests/desktop/desktop-ui.test.tsx
git commit -m "feat: add restrained desktop pet controls"
```

---

### Task 4: Normalize and Install the Private Live2D Skin

**Files:**
- Create: `apps/pi-teaching-web/src/desktop/peer-live2d-import.ts`
- Create: `apps/pi-teaching-web/scripts/desktop/import-peer-live2d.ts`
- Create: `apps/pi-teaching-web/tests/m2/peer-live2d-import.test.ts`
- Modify: `apps/pi-teaching-web/package.json`
- Modify: `apps/pi-teaching-web/tests/m2/peer-package.test.ts`

**Interfaces:**
- Produces pure `normalizeVTubeStudioModel(input)` returning the normalized model JSON, manifest, expression copy map, motion copy map, and texture copy map.
- Produces `bun run desktop:peer-live2d -- --source "$STUDYFORGE_SKIN_SOURCE"` for macOS local preparation.
- Installs only into the existing private `actors/peer-axia/live2d` slot, preserving the old slot as a recoverable sibling backup.

- [ ] **Step 1: Write the failing normalizer tests**

Use a small public JSON fixture created inside the test, not the downloaded package:

```ts
test('turns VTube Studio hotkeys into one strict StudyForge package', () => {
  const result = normalizeVTubeStudioModel({ model, hotkeys, files });
  expect(result.model.FileReferences.Expressions.map((entry) => entry.Name))
    .toEqual(['neutral', 'curious', 'skeptical']);
  expect(result.model.FileReferences.Motions.Idle[0].File)
    .toBe('motions/idle.motion3.json');
  expect(result.manifest.modelFiles).toContain('runtime/textures/texture_00.png');
});

test('rejects a package without the exact model, moc, textures, physics, and mouth parameter', () => {
  expect(() => normalizeVTubeStudioModel(incomplete)).toThrow('LIVE2D_SOURCE_INCOMPLETE');
});
```

- [ ] **Step 2: Run the focused test and observe RED**

Run: `bun test tests/m2/peer-live2d-import.test.ts`

Expected: FAIL because no normalizer exists.

- [ ] **Step 3: Implement the pure normalizer**

Map base → `neutral` using a generated empty expression, `lianhong.exp3.json` → `curious`, and
`shengqi.exp3.json` → `skeptical`. Register the existing idle motion. Rewrite all paths to ASCII runtime
names and emit the exact strict manifest consumed by `readPeerLive2DManifest`. Validate
`ParamMouthOpenY` through the source `cdi3.json`; do not infer arbitrary expression semantics from every
VTube Studio hotkey.

- [ ] **Step 4: Implement the macOS preparation command**

Parse only `--source` and optional `--app-home`. Resolve exact source/destination paths, build into a fresh
sibling staging directory, copy the existing private Cubism Core, copy model data, and call
`/usr/bin/sips --resampleHeightWidthMax 2048` for each copied texture. After the complete staged package
validates through `readPeerLive2DManifest`, move the current slot to a timestamp-free recoverable
`live2d.previous` sibling and move staging into `live2d`. If that backup already exists, stop instead of
overwriting it.

Add the package script:

```json
"desktop:peer-live2d": "bun run scripts/desktop/import-peer-live2d.ts"
```

- [ ] **Step 5: Run importer and privacy tests to GREEN**

Run:

```bash
bun test tests/m2/peer-live2d-import.test.ts tests/m2/peer-media.test.ts tests/m2/peer-package.test.ts
bun run typecheck
```

Expected: tests confirm the strict package and confirm no private path or model artifact is tracked.

- [ ] **Step 6: Commit Task 4 before touching private assets**

```bash
git add apps/pi-teaching-web/src/desktop/peer-live2d-import.ts \
  apps/pi-teaching-web/scripts/desktop/import-peer-live2d.ts \
  apps/pi-teaching-web/tests/m2/peer-live2d-import.test.ts \
  apps/pi-teaching-web/package.json \
  apps/pi-teaching-web/tests/m2/peer-package.test.ts
git commit -m "feat: normalize local Live2D skins"
```

- [ ] **Step 7: Install the user's private skin with an inspected source path**

Set and validate a task-specific source variable in one foreground shell, then run the importer:

```bash
test -n "${STUDYFORGE_SKIN_SOURCE:-}" \
  && test -d "${STUDYFORGE_SKIN_SOURCE:?}" \
  && test -f "$STUDYFORGE_SKIN_SOURCE/水色小狗.model3.json" \
  && bun run desktop:peer-live2d -- --source "$STUDYFORGE_SKIN_SOURCE"
```

Afterward inspect the exact generated slot and verify that every texture is at most 2048×2048. This is a
private local mutation; report the backup path and never stage it.

---

### Task 5: Full Build and Real macOS Acceptance

**Files:**
- Modify only if a verified failure requires a focused fix.
- Update: `docs/superpowers/plans/2026-08-11-m2-axia-desktop-pet.md` checkboxes after verification.

**Interfaces:**
- Consumes all prior tasks.
- Produces a packaged DMG with no private skin and a local installed app that can use the private actor slot.

- [ ] **Step 1: Run the complete source verification**

Run:

```bash
bun run check
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
```

Expected: 0 test failures, successful typecheck/build, and no whitespace errors.

- [ ] **Step 2: Build and verify the public DMG**

Run:

```bash
bun run desktop:build
bun run desktop:verify
```

Expected: Tauri build and bundle verification exit 0; verification confirms no private model, Core, voice,
or source path is inside the DMG.

- [ ] **Step 3: Launch the real app and exercise the window lifecycle**

Verify on macOS:

1. main and companion appear together;
2. the companion displays the locally installed “水色小狗” model with transparent background;
3. minimizing and closing main leaves the companion alive;
4. double-clicking the model restores the same main window;
5. dragging persists position and transparent margins click through;
6. right-click mute/hide/quit works, and settings can show a hidden companion;
7. `⌘Q` stops both windows and the sidecar.

- [ ] **Step 4: Exercise one real Free Learning Peer turn**

Ask a natural question, explicitly invite 阿夏 once, and verify:

- the timeline contains one Peer message and no in-page model;
- the desktop pet enters thinking/speaking/calm without reloading;
- exactly one TTS plays and mouth motion stops on interrupt;
- the short bubble does not attempt to render a long formula;
- the teacher continuation appears after playback without a duplicate Session item.

- [ ] **Step 5: Inspect runtime cost and private boundaries**

Confirm generated textures are at most 2048, no second Live2D canvas exists in main, and memory/GPU does
not continually increase across repeated calm → speaking → calm cycles. Re-run `git status --short` and
ensure only the pre-existing CSP/test changes and `.superpowers/` scratch remain outside the feature commits.

- [ ] **Step 6: Commit each reproduced acceptance fix**

For each real defect, reproduce it with a focused failing test before changing production code. Commit only
after the focused test and the full verification are green.
