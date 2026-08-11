# M2 Axia Live2D Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce one private, recognizable Axia Live2D model and make it a calm, session-long optional companion in Free Learning without changing Peer facts, Agent behavior, or the public StudyForge package boundary.

**Architecture:** Keep `ask_peer` and the existing TTS playback as the only semantic and audio sources. A manifest-whitelisted desktop adapter serves the private Cubism Core and model files through the existing authenticated transport; the browser reconstructs those responses as `File[]`, which `untitled-pixi-live2d-engine` can load through object URLs without any anonymous file server or token-bearing asset URL. The client must install and verify the Core global before dynamically importing the engine, because version `1.3.5` checks `window.Live2DCubismCore` during module evaluation. A lazy Pixi/Cubism renderer then consumes only `calm | thinking | speaking`, expression, and the existing three-state audio envelope. It unloads with the Free Learning route and falls back atomically to the existing static portrait on any missing resource, WebGL failure, or renderer error.

**Tech Stack:** TypeScript 7, React 19, Bun 1.3, Tauri 2 WebView, PixiJS `8.19.0`, `untitled-pixi-live2d-engine` `1.3.5`, official Cubism 5 Editor and Web SDK Core, existing MiMo TTS/Web Audio pipeline, Bun tests, real macOS DMG validation.

## Global Constraints

- Work only in `/Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/m2-free-learning-peer` on `codex/m2-free-learning-peer`.
- Preserve the pre-existing uncommitted changes in `apps/pi-teaching-web/src-tauri/tauri.conf.json`, `apps/pi-teaching-web/tests/m2/peer-package.test.ts`, and `.superpowers/`; re-open their diffs before touching either tracked file.
- The successful native `ask_peer` result remains the only durable Peer utterance. Do not add Agent calls, a second Session, memory writes, model-side mood state, or a Live2D fact schema.
- Long companion scope is exactly one active Free Learning route. Roadmap, Plan, Lesson, Meta, Home, Assets, and Knowledge Atlas do not mount the model.
- Private source art, `.psd`, `.cmo3`, `.moc3`, textures, Core runtime, voice sample, and identifiable screenshots never enter Git or the public DMG.
- Do not expose a directory browser or arbitrary relative path. The browser may request only files named by the validated private `manifest.json` for the fixed actor `peer-axia`.
- Load the Pixi/Cubism renderer lazily. Missing Core/model, invalid manifest, unsupported WebGL, context loss, and initialization failure must all produce one atomic static-portrait fallback; never show a half-loaded canvas or public error banner.
- Continue using the current TTS `<audio>` element and Web Audio analyser. Do not add `@pixi/sound`, a second audio player, phoneme recognition, camera tracking, or neural lip sync.
- Calm animation is local rendering only. It must not call a model, synthesize speech, read conversation state beyond the already projected items, or keep running while the page is hidden.
- Public Live2D distribution remains blocked until the official Cubism AI/chatbot/Expandable Application publication classification is reviewed. This plan validates a private local installation while keeping the public package functional without Live2D.
- The user makes both visual gates: recognizable source art before rigging, and acceptable long-companion behavior after the real DMG smoke. Automated checks cannot approve likeness or comfort.

---

### Task 1: Pin the private package contract and authenticated media boundary

**Files:**
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Create: `apps/pi-teaching-web/src/desktop/peer-live2d-package.ts`
- Modify: `apps/pi-teaching-web/src/desktop/peer-media.ts`
- Modify: `apps/pi-teaching-web/src/server/desktop-app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Modify: `apps/pi-teaching-web/tests/m2/peer-media.test.ts`
- Modify: `apps/pi-teaching-web/tests/desktop/desktop-api.test.ts`

**Interfaces:**

```ts
export type PeerLive2DManifest = {
  version: 1;
  modelFile: string;
  coreFile: string;
  modelFiles: string[];
};

export function readPeerLive2DManifest(root: string): PeerLive2DManifest | null;

export type PeerMediaService = {
  portrait(actorId: string, expression: string): Response;
  live2dManifest(actorId: string): Response;
  live2dFile(actorId: string, relativePath: string): Response;
  speech(actorId: string, text: string, signal?: AbortSignal): Promise<Response>;
};
```

Private runtime layout, outside the repository:

```text
/Users/yangrundong/Library/Application Support/StudyForge/actors/peer-axia/live2d/
├── manifest.json
├── source/
│   ├── axia-master.psd
│   └── axia.cmo3
└── runtime/
    ├── live2dcubismcore.min.js
    ├── axia.model3.json
    ├── axia.moc3
    ├── axia.physics3.json
    ├── expressions/
    │   ├── neutral.exp3.json
    │   ├── curious.exp3.json
    │   └── skeptical.exp3.json
    └── textures/
        └── texture_00.png
```

`manifest.json` is exactly:

```json
{
  "version": 1,
  "modelFile": "runtime/axia.model3.json",
  "coreFile": "runtime/live2dcubismcore.min.js",
  "modelFiles": [
    "runtime/axia.model3.json",
    "runtime/axia.moc3",
    "runtime/axia.physics3.json",
    "runtime/expressions/neutral.exp3.json",
    "runtime/expressions/curious.exp3.json",
    "runtime/expressions/skeptical.exp3.json",
    "runtime/textures/texture_00.png"
  ]
}
```

- [ ] **Step 1: Write RED package-parser and media-service tests**

Extend the temporary actor fixture with the exact tree above. Assert:

```ts
const manifest = readPeerLive2DManifest(join(actors, 'peer-axia', 'live2d'));
expect(manifest).toEqual({
  version: 1,
  modelFile: 'runtime/axia.model3.json',
  coreFile: 'runtime/live2dcubismcore.min.js',
  modelFiles: [
    'runtime/axia.model3.json',
    'runtime/axia.moc3',
    'runtime/axia.physics3.json',
    'runtime/expressions/neutral.exp3.json',
    'runtime/expressions/curious.exp3.json',
    'runtime/expressions/skeptical.exp3.json',
    'runtime/textures/texture_00.png',
  ],
});
expect(service.live2dManifest('peer-axia').status).toBe(200);
expect(service.live2dFile('peer-axia', 'runtime/axia.moc3').status).toBe(200);
expect(service.live2dFile('peer-axia', '../voice.mp3').status).toBe(404);
expect(service.live2dFile('peer-other', 'runtime/axia.moc3').status).toBe(404);
```

Also cover one missing declared file, duplicate entry, absolute path, `..` segment, wrong version, `modelFile` absent from `modelFiles`, and missing Core. Each makes the whole package unavailable rather than partially serving it.

- [ ] **Step 2: Write RED authenticated route tests**

Add exact endpoints:

```text
GET /api/desktop/actors/peer-axia/live2d/manifest
GET /api/desktop/actors/peer-axia/live2d/file?path=<encoded-relative-path>
```

Assert both require the existing bearer token, preserve the Tauri origin policy, return 404 when the package is absent, return the declared bytes when present, and reject any path not in the manifest. Place these route branches before the existing two-segment portrait matcher.

- [ ] **Step 3: Run RED**

```bash
cd apps/pi-teaching-web
bun test tests/m2/peer-media.test.ts tests/desktop/desktop-api.test.ts
```

Expected: FAIL because the manifest type, parser, service methods, routes, and client helpers do not exist.

- [ ] **Step 4: Implement the minimal package parser and service**

`readPeerLive2DManifest` reads only `<root>/manifest.json`, validates the four fields, requires unique normalized POSIX-relative paths, verifies that `modelFile` is in `modelFiles`, and verifies every declared file exists below the same root. Do not enumerate the actor directory or infer alternative filenames.

`live2dFile` re-reads the validated manifest and serves only `coreFile` or a member of `modelFiles`. Infer response MIME from the fixed suffixes `.js`, `.json`, `.moc3`, and `.png`; return `cache-control: no-store`.

- [ ] **Step 5: Add optional client helpers**

Add helpers that use `transportFetch`, swallow only the expected unavailable response, and never generate raw filesystem or token-bearing URLs:

```ts
peerLive2DManifest: async (actorId: 'peer-axia'): Promise<PeerLive2DManifest | null>;
peerLive2DFile: async (
  actorId: 'peer-axia',
  relativePath: string,
  signal?: AbortSignal,
): Promise<Blob | null>;
```

- [ ] **Step 6: Run GREEN and commit Task 1**

```bash
bun test tests/m2/peer-media.test.ts tests/desktop/desktop-api.test.ts
git add src/shared/contracts.ts src/desktop/peer-live2d-package.ts \
  src/desktop/peer-media.ts src/server/desktop-app.ts src/client/api.ts \
  tests/m2/peer-media.test.ts tests/desktop/desktop-api.test.ts
git commit -m "feat: serve private Axia Live2D packages"
```

---

### Task 2: Produce and validate the private Axia model

**Private files — never stage or commit:**
- Create: `/Users/yangrundong/Library/Application Support/StudyForge/actors/peer-axia/live2d/source/axia-master.psd`
- Create: `/Users/yangrundong/Library/Application Support/StudyForge/actors/peer-axia/live2d/source/axia.cmo3`
- Create: `/Users/yangrundong/Library/Application Support/StudyForge/actors/peer-axia/live2d/runtime/axia.model3.json`
- Create: runtime files enumerated by Task 1's manifest
- Create: `/Users/yangrundong/Library/Application Support/StudyForge/actors/peer-axia/live2d/manifest.json`

**Interfaces:**
- Consumes: approved private reference material and the already selected Japanese Live2D visual direction.
- Produces: one Cubism 5 bust model with standard parameter IDs and expression IDs `neutral`, `curious`, and `skeptical`.
- Does not produce: repository assets, public screenshots, full-body motions, tracking data, or a generic avatar package.

- [ ] **Step 1: Install only the official authoring/runtime prerequisites**

Install the current Cubism 5 Editor from the official Live2D site and download the matching Cubism 5 SDK for Web. Copy only `live2dcubismcore.min.js` into the private `runtime/` directory. Record the downloaded Editor and SDK versions in the execution report; do not copy the SDK archive or license files into the repository.

- [ ] **Step 2: Generate a riggable neutral master with the imagegen skill**

Use the approved private reference material only inside the generation/editing call. Generate a front-facing head-to-chest neutral portrait with full hair silhouette, both shoulders, closed mouth, open eyes, clean line art, restrained cel shading, and no hand/prop/background. Preserve the recognizable eye shape, face proportions, nose/lips, hair color, and center-part hairstyle. Do not reuse the earlier visual sample as the final flat master.

- [ ] **Step 3: Pause for the first user visual gate**

Show the clean master at actual page-edge scale and at full resolution. Continue only after the user says it looks recognizably like Axia. If rejected, revise the master; do not compensate for a poor likeness with rigging.

- [ ] **Step 4: Build the restrained layered PSD**

Separate only independently moving regions:

```text
back hair
face + ears
front hair + a few loose strands
left/right brows
left/right lashes, sclera, irises, highlights
upper/lower lips, oral cavity, teeth, tongue
nose
neck
upper-body clothing
necklace
```

Inpaint hidden eye, face, forehead, neck, and hair regions exposed by small head/eye/hair movement. Import the PSD into Cubism Editor and reject the import if any part clips or reveals transparency within the intended `Angle X/Y/Z` range.

- [ ] **Step 5: Rig the first useful parameter set**

Use Cubism auto mesh, auto Deformer, and automatic facial XY generation as a starting point, then manually correct the visible result. The exported model must expose:

```text
ParamAngleX, ParamAngleY, ParamAngleZ
ParamEyeLOpen, ParamEyeROpen
ParamEyeBallX, ParamEyeBallY
ParamBrowLY, ParamBrowRY
ParamMouthOpenY, ParamMouthForm
ParamBodyAngleX, ParamBreath
```

Add modest hair and necklace physics. Create three expression files named `neutral`, `curious`, and `skeptical`; keep their differences in brows, gaze, and mouth form rather than large pose changes. Do not add hand tracking, full-body parameters, or per-message motions.

- [ ] **Step 6: Export and validate the private package**

Export `.cmo3` to `source/` and the Cubism Web runtime pack to `runtime/`. Write the exact Task 1 manifest using only files actually exported. Validate in Cubism Viewer that:

- all three expressions resolve by ID;
- `ParamMouthOpenY` moves continuously from 0 to 1;
- blink, breath, small head turns, hair, and necklace remain stable;
- no texture edge or unpainted region appears;
- the model remains legible at approximately 160–210 CSS pixels wide.

Do not commit this task. Its output is private application data consumed by later tasks.

---

### Task 3: Reconstruct the authenticated package as browser `File[]`

**Files:**
- Create: `apps/pi-teaching-web/src/client/live2d/private-package.ts`
- Create: `apps/pi-teaching-web/tests/m2/live2d-private-package.test.ts`

**Interfaces:**

```ts
export type PeerLive2DPackage = {
  manifest: PeerLive2DManifest;
  coreSource: string;
  modelFiles: File[];
};

export async function loadPeerLive2DPackage(
  actorId: 'peer-axia',
  signal?: AbortSignal,
): Promise<PeerLive2DPackage | null>;
```

- [ ] **Step 1: Write RED reconstruction tests**

Inject or mock the two API helpers and assert that the loader:

```ts
expect(result?.modelFiles.map((file) => file.webkitRelativePath)).toEqual([
  'runtime/axia.model3.json',
  'runtime/axia.moc3',
  'runtime/axia.physics3.json',
  'runtime/expressions/neutral.exp3.json',
  'runtime/expressions/curious.exp3.json',
  'runtime/expressions/skeptical.exp3.json',
  'runtime/textures/texture_00.png',
]);
expect(result?.coreSource).toContain('Live2DCubismCore');
```

Assert one missing response, an empty Core source, abort, or a mismatched model-file count returns `null` and leaves no object URL behind.

- [ ] **Step 2: Run RED**

```bash
bun test tests/m2/live2d-private-package.test.ts
```

Expected: FAIL because the authenticated package loader does not exist.

- [ ] **Step 3: Implement one bounded parallel fetch**

Fetch the Core and every `modelFiles` entry through `api.peerLive2DFile`. Create each browser `File` with `basename(path)` and the returned Blob MIME, then define its `webkitRelativePath` as the original manifest path:

```ts
const file = new File([blob], path.split('/').at(-1)!, { type: blob.type });
Object.defineProperty(file, 'webkitRelativePath', {
  configurable: false,
  enumerable: true,
  value: path,
});
```

Return `null` unless every declared response is present. Do not create object URLs here; the Live2D engine's `FileLoader` owns and revokes them with the model.

- [ ] **Step 4: Run GREEN and commit Task 3**

```bash
bun test tests/m2/live2d-private-package.test.ts
git add src/client/live2d/private-package.ts tests/m2/live2d-private-package.test.ts
git commit -m "feat: load authenticated Live2D packages"
```

---

### Task 4: Add the lazy Pixi/Cubism renderer behind a testable adapter

**Files:**
- Modify: `apps/pi-teaching-web/package.json`
- Modify: `apps/pi-teaching-web/bun.lock`
- Create: `apps/pi-teaching-web/src/client/live2d/contracts.ts`
- Create: `apps/pi-teaching-web/src/client/live2d/cubism-core.ts`
- Create: `apps/pi-teaching-web/src/client/live2d/state.ts`
- Create: `apps/pi-teaching-web/src/client/live2d/pixi-renderer.ts`
- Create: `apps/pi-teaching-web/tests/m2/live2d-state.test.ts`

**Interfaces:**

```ts
export type PeerPresencePhase = 'calm' | 'thinking' | 'speaking';

export type PeerVisualState = {
  phase: PeerPresencePhase;
  expression: PeerExpression;
  mouth: PeerMouth;
};

export type PeerLive2DRenderer = {
  setState(state: PeerVisualState): void;
  setPaused(paused: boolean): void;
  destroy(): void;
};

export type PeerVisualDriver = {
  setAttention(phase: PeerPresencePhase): void;
  setExpression(expression: PeerExpression): void;
  setMouthTarget(value: number): void;
  setPaused(paused: boolean): void;
  destroy(): void;
};

export function createPeerVisualController(
  driver: PeerVisualDriver,
  initialState: PeerVisualState,
): PeerLive2DRenderer;

export function mouthTarget(mouth: PeerMouth): 0 | 0.45 | 1;

export type CreatePeerLive2DRenderer = (input: {
  host: HTMLElement;
  package: PeerLive2DPackage;
  initialState: PeerVisualState;
  onFailure(): void;
}) => Promise<PeerLive2DRenderer>;

export const createPeerLive2DRenderer: CreatePeerLive2DRenderer;

export function ensureCubismCore(coreSource: string): Promise<void>;
```

- [ ] **Step 1: Add pinned browser dependencies**

```bash
cd apps/pi-teaching-web
bun add pixi.js@8.19.0 untitled-pixi-live2d-engine@1.3.5
```

Do not add `@pixi/sound`; the existing audio player remains authoritative.

- [ ] **Step 2: Write RED pure adapter-state tests**

Keep the Core-dependent `pixi-renderer.ts` outside Bun imports. Put mouth mapping and state deduplication in
`state.ts`, then test it with a fake `PeerVisualDriver` so that:

- `closed | half | open` maps to mouth targets `0 | 0.45 | 1`;
- repeated identical state does not restart an expression;
- `question | association | challenge` continue to arrive as `curious | neutral | skeptical` without a second mapping;
- pause/resume requests reach the driver once per transition;
- destroy is idempotent and reaches the driver exactly once.

Core/Pixi/model/context failures are exercised through the bootstrap/fallback test in Task 5 and the real
WebView smoke in Task 7, not by pretending Bun has a WebGL implementation.

- [ ] **Step 3: Run RED**

```bash
bun test tests/m2/live2d-state.test.ts
```

Expected: FAIL because the renderer contracts and implementation do not exist.

- [ ] **Step 4: Load Cubism Core from authenticated source**

`cubism-core.ts` caches one initialization promise. If `globalThis.Live2DCubismCore` already exists, reuse it. Otherwise create a JavaScript Blob URL from `coreSource`, append one `<script>`, resolve on load, revoke the Blob URL immediately after load, and remove the element. Clear the cached promise on failure so a later Free Learning Session can retry.

This module must not import `untitled-pixi-live2d-engine`. Version `1.3.5` throws during module
evaluation when the Core global is absent, so Core installation before the renderer's dynamic import is a
hard ordering invariant rather than a recoverable initialization detail.

- [ ] **Step 5: Implement the renderer**

In `pixi-renderer.ts`:

```ts
import { Application, extensions } from 'pixi.js';
import {
  CubismFramework,
  Live2DModel,
  Live2DPlugin,
} from 'untitled-pixi-live2d-engine/cubism';
```

Register `Live2DPlugin` once before `Application.init`. Initialize a transparent WebGL canvas with `resizeTo: host`, `autoDensity: true`, and capped resolution `Math.min(devicePixelRatio, 2)`. Load the package with the engine's built-in File middleware:

```ts
const model = await Live2DModel.from(package_.modelFiles as never, {
  ticker: app.ticker,
  anchorMode: 'drawable',
  breathDepth: 0.35,
  eyeBlink: true,
  textureOptions: { lod: 'single-auto' },
});
```

Anchor at bottom center and resize by visible drawable bounds so the bust fits the existing page-edge footprint. Use `model.expression(state.expression)` only when the expression changes. Ease the three-state mouth target on the ticker, and on `beforeModelUpdate` add it to the standard Cubism `ParamMouthOpenY` parameter through `CubismFramework.getIdManager()`.

Calm uses only native blink/breath plus a very small slow focus drift; thinking moves focus slightly toward the conversation; speaking uses the current expression and mouth target. `setPaused(true)` stops the ticker. `destroy()` removes resize/context listeners, destroys the model and Pixi application, and leaves no canvas or animation frame.

- [ ] **Step 6: Run GREEN, typecheck, and commit Task 4**

```bash
bun test tests/m2/live2d-state.test.ts
bun run typecheck
git add package.json bun.lock src/client/live2d/contracts.ts \
  src/client/live2d/cubism-core.ts src/client/live2d/state.ts \
  src/client/live2d/pixi-renderer.ts tests/m2/live2d-state.test.ts
git commit -m "feat: add optional Cubism renderer"
```

---

### Task 5: Turn the existing Peer stage into a session-long companion

**Files:**
- Modify: `apps/pi-teaching-web/src/client/peer-playback.ts`
- Create: `apps/pi-teaching-web/src/client/live2d/bootstrap.ts`
- Create: `apps/pi-teaching-web/src/client/components/PeerLive2D.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/PeerEmbodiment.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles/course.css`
- Modify: `apps/pi-teaching-web/tests/m2/peer-playback.test.tsx`
- Create: `apps/pi-teaching-web/tests/m2/live2d-bootstrap.test.ts`

**Interfaces:**

```ts
export function peerPresence(
  items: readonly ConversationItem[],
  playback: Pick<PeerPlaybackView, 'item' | 'phase' | 'mouth'>,
): PeerVisualState;

export function PeerLive2D(props: {
  state: PeerVisualState;
  onReady(ready: boolean): void;
  onFailure(): void;
}): ReactElement;

export async function bootstrapPeerLive2D(input: {
  host: HTMLElement;
  state: PeerVisualState;
  signal: AbortSignal;
  onFailure(): void;
}, dependencies?: {
  loadPackage: typeof loadPeerLive2DPackage;
  ensureCore: typeof ensureCubismCore;
  importRenderer(): Promise<{ createPeerLive2DRenderer: CreatePeerLive2DRenderer }>;
}): Promise<PeerLive2DRenderer | null>;
```

- [ ] **Step 1: Write RED presence and component tests**

Add focused presence expectations:

```ts
expect(peerPresence([], idlePlayback)).toEqual({
  phase: 'calm', expression: 'neutral', mouth: 'closed',
});
expect(peerPresence([peer({ status: 'running' })], idlePlayback).phase).toBe('thinking');
expect(peerPresence([peer()], speakingPlayback)).toEqual({
  phase: 'speaking', expression: 'skeptical', mouth: 'half',
});
```

Server-render `PeerEmbodiment` in calm with no current message and assert the stage remains present. Assert the caption is absent in calm, says `阿夏在想` in thinking, and exposes stop/mute only during active audio. Assert a non-Free-Learning `ChatPanel` still contains no Peer stage.

In `live2d-bootstrap.test.ts`, inject `loadPackage`, `ensureCore`, and `importRenderer` functions. Assert the
call order is `package → core → import → create`; a missing package or failed Core never imports the engine;
and every failure returns `null` after calling `onFailure` exactly once.

- [ ] **Step 2: Run RED**

```bash
bun test tests/m2/peer-playback.test.tsx tests/m2/live2d-bootstrap.test.ts \
  tests/m2/peer-projection.test.tsx
```

Expected: FAIL because idle currently returns `null`, portrait loading belongs to the audio hook, and there is no Live2D child.

- [ ] **Step 3: Separate audio playback from embodiment media**

Remove `portraitUrl` from `PeerPlaybackView`; the playback hook should own only current utterance, audio phase, mouth state, mute, stop, and formula speech. Keep its existing analyser and three mouth states unchanged.

Add a `visibilitychange` listener while playback is active. Hiding the page calls the existing `finish` path, which stops audio and closes the mouth; showing the page must not replay the same Peer item.

- [ ] **Step 4: Mount the optional model for the whole Free Learning route**

`bootstrap.ts` owns the hard load order, and `PeerLive2D` calls it from one mount effect:

```ts
const package_ = await loadPeerLive2DPackage('peer-axia', controller.signal);
if (!package_) return onFailure();
await ensureCubismCore(package_.coreSource);
const { createPeerLive2DRenderer } = await import('../live2d/pixi-renderer');
renderer = await createPeerLive2DRenderer({ host, package: package_, initialState: state, onFailure });
```

The effect must not start the dynamic import until `ensureCubismCore` has resolved. A focused test should
inject an import callback and assert that a failed Core load never evaluates the renderer module.

Subsequent state changes call `renderer.setState` without reloading. Hiding the page calls
`setPaused(true)`; showing it first sets `{ phase: 'calm', expression: 'neutral', mouth: 'closed' }`
and then calls `setPaused(false)`. Unmount aborts loading and destroys the renderer. Keep the canvas
`aria-hidden` because the text Peer remains the accessible fact.

- [ ] **Step 5: Preserve one complete static fallback**

`PeerEmbodiment` independently loads the current expression portrait through `api.peerPortrait` and revokes its Blob URL on expression change/unmount. It renders the static portrait until Live2D reports ready, and again after any failure. Keep the current CSS mouth overlay only for static speaking fallback. No broken image URL or error copy may appear.

Render the stage whenever `freeLearning && enabled` is true, including calm. An explicitly ended thread
does not keep the companion mounted. During calm, keep only the figure; show the caption and controls for
thinking/loading/speaking. Keep the figure at the page edge and do not alter chat-column width.

- [ ] **Step 6: Run GREEN and commit Task 5**

```bash
bun test tests/m2/peer-playback.test.tsx tests/m2/live2d-bootstrap.test.ts \
  tests/m2/peer-projection.test.tsx
bun run typecheck
git add src/client/peer-playback.ts src/client/live2d/bootstrap.ts \
  src/client/components/PeerLive2D.tsx \
  src/client/components/PeerEmbodiment.tsx src/client/components/ChatPanel.tsx \
  src/client/styles/course.css tests/m2/peer-playback.test.tsx \
  tests/m2/live2d-bootstrap.test.ts
git commit -m "feat: keep Axia present through free learning"
```

---

### Task 6: Preserve the public package and deterministic fallback

**Files:**
- Modify carefully after reviewing existing diff: `apps/pi-teaching-web/src-tauri/tauri.conf.json`
- Modify carefully after reviewing existing diff: `apps/pi-teaching-web/tests/m2/peer-package.test.ts`
- Modify: `apps/pi-teaching-web/scripts/desktop/verify-bundle.ts`

**Interfaces:**
- Consumes: the optional Blob-loaded Core script and the existing public DMG layout.
- Produces: a CSP that permits only the required local Blob script, and a verifier that rejects private model/runtime artifacts from the DMG.

- [ ] **Step 1: Inspect and preserve the pre-existing local changes**

```bash
git diff -- src-tauri/tauri.conf.json tests/m2/peer-package.test.ts
```

Do not overwrite or restage unrelated CSP/package assertions. Integrate only the Live2D requirements into the current versions.
If either file is still dirty from another task, finish or commit that owning task before continuing Task 6;
do not use a whole-file `git add` to absorb unrelated hunks into the Live2D commit.

- [ ] **Step 2: Write RED package-boundary expectations**

Extend the existing test and mounted-DMG verifier to reject these case-insensitive suffixes/names anywhere under `StudyForge.app`:

```text
.moc3
.cmo3
.psd
.physics3.json
.exp3.json
live2dcubismcore.min.js
peer-axia/live2d
```

Assert the CSP permits `script-src 'self' blob:` for the authenticated Core Blob while retaining existing `media-src 'self' blob:` and all current restrictions.

- [ ] **Step 3: Run RED**

```bash
bun test tests/m2/peer-package.test.ts
```

Expected: FAIL because the Core Blob is not yet permitted and the bundle verifier does not reject Live2D private artifacts.

- [ ] **Step 4: Apply the narrow CSP and verifier changes**

Add only `blob:` to the existing `script-src`; do not add `unsafe-eval`, remote script origins, wildcard sources, or anonymous actor directories. Make `verify-bundle.ts` recursively inspect the mounted app and fail with the first private Live2D path found.

- [ ] **Step 5: Run GREEN and commit Task 6**

```bash
bun test tests/m2/peer-package.test.ts
bun run typecheck
git add src-tauri/tauri.conf.json tests/m2/peer-package.test.ts \
  scripts/desktop/verify-bundle.ts
git commit -m "chore: keep private Live2D assets out of releases"
```

---

### Task 7: Verify the full private companion and static public fallback

**Files:**
- Create: `docs/superpowers/reports/2026-08-11-axia-live2d-companion-validation.md`
- Modify only if a real failure requires it: files from Tasks 1–6

**Interfaces:**
- Consumes: one release-built DMG, the private actor slot, and the configured real teacher/Peer model path.
- Produces: objective test evidence plus the user's final subjective visual judgment.

- [ ] **Step 1: Run the focused and full automated suite**

```bash
cd apps/pi-teaching-web
bun test tests/m2/peer-media.test.ts \
  tests/m2/live2d-private-package.test.ts \
  tests/m2/live2d-state.test.ts \
  tests/m2/live2d-bootstrap.test.ts \
  tests/m2/peer-playback.test.tsx \
  tests/m2/peer-package.test.ts \
  tests/desktop/desktop-api.test.ts
bun run check
```

Expected: focused tests PASS; full typecheck, non-E2E tests, and Vite build PASS.

- [ ] **Step 2: Build and inspect the real DMG**

```bash
bun run desktop:prepare
bun run desktop:sidecars
bun run desktop:smoke
bun run desktop:build
bun run desktop:verify
```

Expected: signed arm64 DMG passes the existing runtime/resource checks and the new private-asset absence check.

- [ ] **Step 3: Run a private-model Free Learning smoke**

Use the real DMG and the private actor slot. Through the normal UI:

1. Enter a new Free Learning Session and wait 60 seconds without sending a message. Axia stays calm; no TTS or Peer request is emitted.
2. Ask a normal study question without naming Axia. The teacher behaves normally and the companion remains calm.
3. Ask `阿夏你怎么看？`. The running Peer item produces thinking, the completed live reply produces speaking with the existing TTS, and completion returns to calm without remount flicker.
4. Exercise `question`, `association`, and `challenge` across real Peer replies; confirm curious, neutral, and skeptical remain restrained and recognizable.
5. Stop speech, mute/unmute, send a new student message during playback, hide/show the app, refresh, leave for Assets, and return. No old audio replays, no zombie canvas remains, and the teacher/Peer text order is unchanged.
6. Keep one Session open for 20 minutes with several Peer turns. Record Activity Monitor CPU/memory at minute 1 and minute 20; investigate continuous growth or sustained idle CPU before acceptance.

Use the `studyclaw-e2e-validation` or `studyforge-local-ui-debug` skill for runtime localization if the real app fails; do not patch around a Provider or Session failure in the renderer.

- [ ] **Step 4: Run the missing-model fallback smoke**

Quit StudyForge, temporarily move only the private `live2d/` directory outside `actors/peer-axia`, relaunch the same DMG, and repeat one Peer turn. The static portrait, text, TTS, teacher continuation, stop, and mute paths must all work without a public error. Restore the directory afterward; do not delete it.

- [ ] **Step 5: Record evidence and request the final user judgment**

Write the validation report with:

- exact dependency, Cubism Editor, SDK/Core, and DMG versions;
- automated command outputs;
- textual results for calm/thinking/speaking, while keeping identifiable screenshots only in the private
  `/Users/yangrundong/Library/Application Support/StudyForge/validation/axia-live2d/` directory and showing
  them to the user without committing or linking them from Git;
- transition, interrupt, background, route-leave, refresh, and fallback results;
- minute-1/minute-20 CPU and memory observations;
- known visual limitations.

Show the real companion to the user. Completion requires the user's explicit judgment that the likeness and long-companion behavior are acceptable. If rejected, return to Task 2 for art/rig changes or Task 4/5 for motion/presentation changes; do not add prompting or Agent state to compensate.

- [ ] **Step 6: Commit only the validation report and any verified fixes**

```bash
git add docs/superpowers/reports/2026-08-11-axia-live2d-companion-validation.md
git commit -m "test: validate Axia Live2D companion"
```

Do not create `live2d-model-production` as a claimed reusable Skill in this plan. After this first pipeline passes and the user accepts it, use the real production report, layer contract, and failure cases as the evidence for a separate Skill-design task.

---

## Final Self-Review Gate

- [ ] Compare every changed behavior with `docs/superpowers/specs/2026-08-11-m2-axia-live2d-companion-design.md` and remove anything outside that boundary.
- [ ] Search for accidental identity/private artifacts: `rg -n "\.moc3|\.cmo3|live2dcubismcore|Library/Containers|voice\.(mp3|wav)" --glob '!docs/superpowers/plans/2026-08-11-m2-axia-live2d-companion.md' .` and inspect every hit.
- [ ] Confirm no route outside Free Learning imports or mounts `PeerLive2D`.
- [ ] Confirm calm does not invoke `ask_peer`, `peerSpeech`, or any model API.
- [ ] Confirm one TTS element remains authoritative and `@pixi/sound` is absent.
- [ ] Confirm the public DMG contains neither private model assets nor Cubism Core.
- [ ] Run `git diff --check` and `bun run check` from `apps/pi-teaching-web`.
- [ ] Review `git status --short` and ensure unrelated pre-existing work was neither staged nor overwritten.
