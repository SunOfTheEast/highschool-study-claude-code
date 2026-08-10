# M2 Local Peer Embodiment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing text-only Free Learning Peer into 阿夏: one durable Peer utterance gains a local portrait, restrained speaking animation, automatic Chinese speech, and teacher-message reveal timing without adding another Agent, Session, or learning fact.

**Architecture:** The native `ask_peer` tool result remains the only durable utterance. Runtime adds one optional semantic move and projects whether a Peer item arrived from history or the live stream. A desktop-only media adapter reads a whitelisted portrait slot and proxies voice-ready text to a separately installed MLX-Audio Qwen3-TTS server. The React client derives expression, audio, mouth motion, mute/stop state, and temporary teacher-message withholding from that one projected item; every media failure falls back first to macOS speech and finally to plain text.

**Tech Stack:** Bun, TypeScript 7, React 19, native Pi Session JSONL, TypeBox, Tauri desktop bearer transport, MLX-Audio OpenAI-compatible speech API, Web Audio API, Web Speech API, existing StudyForge Markdown/KaTeX and paper-theme CSS.

## Global Constraints

- Implement only the existing Free Learning Peer. Do not expose the avatar or `ask_peer` in Roadmap, Plan, Lesson, or Meta.
- Rename the unreleased actor once from `peer-acheng` / 阿澄 to `peer-axia` / 阿夏. Do not add aliases, dual writes, or migration machinery.
- The successful native `ask_peer` `toolResult` is the only durable Peer utterance. Do not persist audio, expression, playback state, or a mirrored message.
- `PeerMove` is only `question | association | challenge`; missing or invalid values map to `neutral` at projection time.
- History restoration never autoplays. Only a newly completed live Peer item may trigger one automatic playback.
- Teacher generation may finish in the background, but later public items remain visually withheld only while that live Peer audio is actually playing.
- Qwen3-TTS weights, voice samples, and identifiable portrait assets stay out of Git and the public DMG.
- No neural lip sync, generated per-message video, Live2D, VRM, generic actor plugin framework, model downloader, voice-cloning UI, or new database.
- Keep the existing text conversation fully usable when the portrait, local voice server, Web Audio, or Web Speech API is unavailable.

---

### Task 1: Pin 阿夏 Identity, Semantic Move, and Live Provenance

**Files:**
- Delete: `apps/pi-teaching-web/resources/peers/acheng.md`
- Create: `apps/pi-teaching-web/resources/peers/axia.md`
- Modify: `apps/pi-teaching-web/src/runtime/peer-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/peer-runner.ts`
- Modify: `apps/pi-teaching-web/src/runtime/peer-context.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/projection/peer-message.ts`
- Modify: `apps/pi-teaching-web/src/projection/conversation.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/tests/m2/peer-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/m2/peer-context.test.ts`
- Modify: `apps/pi-teaching-web/tests/m2/peer-projection.test.tsx`
- Modify: `apps/pi-teaching-web/tests/m2/peer-skill.test.ts`

**Interfaces:**

```ts
export type PeerMove = 'question' | 'association' | 'challenge';
export type PeerExpression = 'neutral' | 'curious' | 'skeptical';
export type PeerDelivery = 'history' | 'live';

export type PeerConversationItem = {
  // existing identity/status/text/time
  move: PeerMove | null;
  expression: PeerExpression;
  delivery: PeerDelivery;
};
```

- [x] **Step 1: Write RED identity and schema expectations**

Change the focused M2 tests first so the tool accepts only `peer-axia`, permits only the optional `move` enum, returns 阿夏 metadata, and rejects unknown moves or actor-controlled fields. Update public-context expectations to `阿夏（AI 同学）` and assert the new persona includes the one voice-ready formula rule.

- [x] **Step 2: Write RED projection provenance expectations**

Assert that native history projects `delivery: 'history'`, live start/end project `delivery: 'live'`, each valid move maps to the stable expression, and a missing move maps to `neutral`. Assert the reducer reconciles a live start/end without replacing its first timestamp or provenance.

- [x] **Step 3: Run RED**

```bash
cd apps/pi-teaching-web
bun test tests/m2/peer-tools.test.ts tests/m2/peer-context.test.ts \
  tests/m2/peer-projection.test.tsx tests/m2/peer-skill.test.ts
```

Expected: FAIL because the runtime still exposes 阿澄 and Peer items have no move/expression/delivery fields.

- [x] **Step 4: Implement the single actor contract**

Create `axia.md` with the existing evidence boundary plus:

```markdown
当回复包含公式时，先用自然语言说明这一步做了什么、得到什么，再展示公式；不要为了朗读重复无关内容。
```

Replace all runtime actor constants with `peer-axia` / 阿夏, load `peers/axia.md`, add the optional TypeBox move field, and include the normalized move in the successful tool-result details. Do not add old-name fallbacks.

- [x] **Step 5: Implement projection-only expression and delivery**

Make `peerMessageStart` and `peerMessageEnd` accept an explicit delivery source. History callers pass `history`; live event callers pass `live`. The projection derives expression with one exhaustive mapping and defaults unknown/missing values to `neutral`. These fields remain UI projection data rather than Session facts beyond the optional move already present in the native call/result.

- [x] **Step 6: Run GREEN and commit**

```bash
bun test tests/m2/peer-tools.test.ts tests/m2/peer-context.test.ts \
  tests/m2/peer-projection.test.tsx tests/m2/peer-skill.test.ts
git add apps/pi-teaching-web/resources/peers \
  apps/pi-teaching-web/src/runtime/peer-tools.ts \
  apps/pi-teaching-web/src/runtime/peer-runner.ts \
  apps/pi-teaching-web/src/runtime/peer-context.ts \
  apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/src/projection/peer-message.ts \
  apps/pi-teaching-web/src/projection/conversation.ts \
  apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/tests/m2
git commit -m "feat: introduce Axia peer semantics"
```

---

### Task 2: Add Deterministic Speech Text and a Restricted Desktop Media Adapter

**Files:**
- Create: `apps/pi-teaching-web/src/shared/peer-speech.ts`
- Create: `apps/pi-teaching-web/src/desktop/peer-media.ts`
- Modify: `apps/pi-teaching-web/src/desktop/contracts.ts`
- Modify: `apps/pi-teaching-web/src/desktop/app-config.ts`
- Modify: `apps/pi-teaching-web/src/server/desktop-app.ts`
- Modify: `apps/pi-teaching-web/src/server/start-server.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Create: `apps/pi-teaching-web/tests/m2/peer-speech.test.ts`
- Create: `apps/pi-teaching-web/tests/m2/peer-media.test.ts`
- Modify: `apps/pi-teaching-web/tests/desktop/desktop-api.test.ts`

**Interfaces:**

```ts
export function automaticPeerSpeech(markdown: string): string;
export function detailedFormulaSpeech(tex: string): string | null;

export type PeerMediaService = {
  portrait(actorId: string, expression: string): Response;
  speech(actorId: string, spokenText: string, signal?: AbortSignal): Promise<Response>;
};
```

- [x] **Step 1: Write RED speech-conversion tests**

Cover plain Chinese, Markdown emphasis/list/table cleanup, a simple inline formula, skipped display math after its natural-language explanation, common Greek/subscript/superscript/fraction/operator structures for detailed reading, and malformed TeX. Assert no raw `\\frac`, `$`, `\\[` or Markdown marker reaches automatic speech.

- [x] **Step 2: Write RED media-boundary tests**

Seed a temporary `appHome/actors/peer-axia/neutral.png`. Assert the service returns only the exact actor and exact `neutral | curious | skeptical` slots, returns 404 for a missing slot, and rejects traversal, unknown actors, arbitrary extensions, and newline/path injection. Inject `fetch` for speech and assert the service calls only the configured localhost MLX endpoint with the pinned model/voice and returns audio bytes; network or non-audio failure becomes a stable unavailable response without exposing provider text.

- [x] **Step 3: Write RED desktop API tests**

Assert authenticated `GET /api/desktop/actors/peer-axia/neutral` serves the image, `POST /api/desktop/peer-speech` accepts only `{ actorId: 'peer-axia', text }`, and both routes preserve existing bearer/origin rules. Unknown actors, extra fields, blank/oversized text, and invalid slots fail closed.

- [x] **Step 4: Run RED**

```bash
bun test tests/m2/peer-speech.test.ts tests/m2/peer-media.test.ts \
  tests/desktop/desktop-api.test.ts
```

Expected: FAIL because the converter and desktop media adapter do not exist.

- [x] **Step 5: Implement the compact deterministic converter**

Use a small delimiter-aware scanner, not an LLM call. Automatic speech keeps prose, speaks only safe simple inline structures, removes display formulas/code/URLs/Markdown furniture, and collapses whitespace. Detailed reading tokenizes the bounded high-school subset and returns `null` when it cannot parse safely instead of reading raw TeX.

- [x] **Step 6: Implement the restricted local adapter**

Resolve the private actor directory under `appHome/actors`. Read only the three exact PNG slots. Proxy speech to `STUDYFORGE_MLX_AUDIO_URL` or `http://127.0.0.1:8000/v1/audio/speech` using `mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit`, the locally configured/default Mandarin voice, and WAV output. Do not accept a URL, model, voice, path, or filename from the browser.

- [x] **Step 7: Wire client blob helpers and run GREEN**

Add authenticated client helpers that return portrait/audio blobs without exposing bearer tokens in image URLs. Run:

```bash
bun test tests/m2/peer-speech.test.ts tests/m2/peer-media.test.ts \
  tests/desktop/desktop-api.test.ts tests/desktop/app-config.test.ts
git add apps/pi-teaching-web/src/shared/peer-speech.ts \
  apps/pi-teaching-web/src/desktop/peer-media.ts \
  apps/pi-teaching-web/src/desktop/contracts.ts \
  apps/pi-teaching-web/src/desktop/app-config.ts \
  apps/pi-teaching-web/src/server/desktop-app.ts \
  apps/pi-teaching-web/src/server/start-server.ts \
  apps/pi-teaching-web/src/client/api.ts \
  apps/pi-teaching-web/tests/m2/peer-speech.test.ts \
  apps/pi-teaching-web/tests/m2/peer-media.test.ts \
  apps/pi-teaching-web/tests/desktop/desktop-api.test.ts
git commit -m "feat: add local peer media adapter"
```

---

### Task 3: Play One Live Peer Utterance Without Blocking the Agent Loop

**Files:**
- Create: `apps/pi-teaching-web/src/client/peer-playback.ts`
- Create: `apps/pi-teaching-web/src/client/components/PeerEmbodiment.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/MarkdownView.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles/course.css`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Modify: `apps/pi-teaching-web/tests/m2/peer-projection.test.tsx`
- Create: `apps/pi-teaching-web/tests/m2/peer-playback.test.tsx`

**Interfaces:**

```ts
export type PeerPlaybackState = {
  itemId: string | null;
  phase: 'idle' | 'loading' | 'speaking';
  mouth: 'closed' | 'half' | 'open';
  muted: boolean;
};
```

- [x] **Step 1: Write RED selection and reveal tests**

Test pure helpers that select only the newest completed unplayed `delivery: 'live'` Peer item, never select history, and return conversation items only through the active Peer while playback is speaking. Muted, stopped, failed, or completed playback must reveal later teacher items exactly once.

- [x] **Step 2: Write RED component expectations**

Server-render the Free Learning chat with an active 阿夏 item and assert one unobtrusive actor stage, expression/mouth data attributes, accessible stop/mute controls, no broken `<img>` URL before a blob is available, and unchanged Markdown text. Assert non-Free-Learning chats never render the stage.

- [x] **Step 3: Run RED**

```bash
bun test tests/m2/peer-playback.test.tsx tests/m2/peer-projection.test.tsx
```

Expected: FAIL because the playback coordinator and actor stage do not exist.

- [x] **Step 4: Implement one browser-owned playback coordinator**

For each newly completed live item, mark its ID attempted before async work. Fetch portrait and MLX audio in parallel. If MLX audio plays, connect the media element to an `AnalyserNode`, smooth RMS amplitude, and choose closed/half/open thresholds. If MLX is unavailable, use `speechSynthesis`; if that is unavailable, finish immediately with text only. Stop, new student send, component unmount, and mute must cancel audio/speech and release object URLs and Web Audio nodes.

- [x] **Step 5: Implement the restrained edge stage and teacher reveal gate**

Render the private portrait blob when available; otherwise show an anonymous paper-and-seal silhouette rather than a broken image. Use the current expression, a low-frequency CSS blink/breath, and a tiny code-native mouth overlay. While phase is `speaking`, keep later items in state but render only through the Peer; when speech ends or is interrupted, render the full list. Do not delay Session events, tool completion, or persistence.

- [x] **Step 6: Add formula click-to-read**

Let `MarkdownView` delegate clicks from KaTeX output to its embedded TeX annotation. Call `detailedFormulaSpeech`; speak only a successful deterministic result through system speech. This is an explicit student action and does not replay the full Peer response.

- [x] **Step 7: Run GREEN and commit**

```bash
bun test tests/m2/peer-playback.test.tsx tests/m2/peer-projection.test.tsx \
  tests/m2/peer-speech.test.ts
bun run typecheck
git add apps/pi-teaching-web/src/client/peer-playback.ts \
  apps/pi-teaching-web/src/client/components/PeerEmbodiment.tsx \
  apps/pi-teaching-web/src/client/components/ChatPanel.tsx \
  apps/pi-teaching-web/src/client/components/MarkdownView.tsx \
  apps/pi-teaching-web/src/client/styles/course.css \
  apps/pi-teaching-web/src/client/styles.css \
  apps/pi-teaching-web/tests/m2/peer-playback.test.tsx \
  apps/pi-teaching-web/tests/m2/peer-projection.test.tsx
git commit -m "feat: embody live Axia replies"
```

---

### Task 4: Add the Private MLX Helper and Verify the Release Boundary

**Files:**
- Create: `apps/pi-teaching-web/scripts/m2/install-local-peer-voice.sh`
- Create: `apps/pi-teaching-web/scripts/m2/run-local-peer-voice.sh`
- Modify: `apps/pi-teaching-web/package.json`
- Modify: `apps/pi-teaching-web/scripts/desktop/package-resources.ts`
- Modify: `apps/pi-teaching-web/scripts/desktop/verify-bundle.ts`
- Create: `apps/pi-teaching-web/tests/m2/peer-package.test.ts`
- Modify: `docs/superpowers/specs/2026-08-11-m2-local-peer-embodiment-design.md`

- [ ] **Step 1: Write RED packaging/privacy checks**

Assert the packaged resource manifest contains `peers/axia.md` and no `acheng`, model weights, voice samples, or identifiable private actor PNG. Assert Git-tracked application files do not contain the private reference-video path or private actor source path.

- [ ] **Step 2: Run RED**

```bash
cd apps/pi-teaching-web
bun test tests/m2/peer-package.test.ts
```

Expected: FAIL until the peer resource rename and package verification are complete.

- [ ] **Step 3: Add a developer-assisted local install/run path**

The install helper uses `uv` to create an isolated environment below `~/Library/Application Support/StudyForge/voice`, installs MLX-Audio with the TTS/server extras, and downloads the pinned 8-bit 0.6B model into the same private cache. The run helper sets the private Hugging Face cache and starts one localhost-only server. It must never write into the repository or bundle weights into the DMG.

- [ ] **Step 4: Exercise the actual local stack when available**

On this Apple Silicon machine, run the helper, start the server, synthesize one short 阿夏 sentence through the StudyForge desktop endpoint, inspect the returned audio type/size, and stop the helper process cleanly. If external package/model download fails, record the exact environmental blocker while retaining system-speech/plain-text fallback verification.

- [ ] **Step 5: Run full deterministic verification**

```bash
cd apps/pi-teaching-web
bun test tests/m2
bun run check
bun run test:e2e -- \
  tests/e2e/m0-cycle.spec.ts \
  tests/e2e/m1b-cycle.spec.ts \
  tests/e2e/m1c-cycle.spec.ts \
  tests/e2e/m1d-ui.spec.ts
bun run desktop:prepare
bun run desktop:sidecars
bun run desktop:smoke
bun run desktop:verify
git diff --check
```

- [ ] **Step 6: Run real UI smoke**

Launch the desktop build/runtime with the private `peer-axia` portraits. In a real Free Learning Session verify: question/association/challenge expression mapping; one live autoplay; no replay after refresh; stop and mute; student-send interruption; teacher continuation reveal; formula click reading; portrait/TTS removal fallback; and no Peer UI in course Sessions. Capture screenshots and timings, but do not commit private images or audio.

- [ ] **Step 7: Update implementation status and commit**

Record only verified results and any explicit deferred real-model comparison in the design document. Then:

```bash
git add apps/pi-teaching-web/scripts/m2 \
  apps/pi-teaching-web/package.json \
  apps/pi-teaching-web/scripts/desktop/package-resources.ts \
  apps/pi-teaching-web/scripts/desktop/verify-bundle.ts \
  apps/pi-teaching-web/tests/m2/peer-package.test.ts \
  docs/superpowers/specs/2026-08-11-m2-local-peer-embodiment-design.md
git commit -m "test: verify local peer embodiment"
```

## Completion Evidence

The feature is complete only when all of the following are evidenced together:

1. A native Session contains one `ask_peer` result and no mirrored avatar/audio fact.
2. History restores the same text without autoplay; a new live result autoplays at most once.
3. Media failure preserves readable three-party text and does not block teacher continuation.
4. Private portraits and model weights remain outside Git and the public bundle.
5. Focused M2 tests, full `bun run check`, selected lifecycle E2E tests, desktop bundle verification, and one real desktop UI smoke all pass or have a clearly isolated external-only blocker.
