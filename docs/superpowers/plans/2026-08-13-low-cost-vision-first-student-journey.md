# Low-Cost Vision Reader and First Student Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make source-first book reading use a bounded low-cost visual worker by default, then prove that one new Desktop learning set can carry a real student from book import through free learning into a Plan-driven Lesson with sourced cards and evidence-backed memory.

**Architecture:** Keep the existing one-shot `MaterialVisionService`; give its judgment prompt one packaged resource and change only automatic model selection. Explicit visual configuration remains authoritative, GPT OAuth teachers prefer `openai-codex/gpt-5.6-luna` at `low`, and the image-capable teacher is fallback. The longitudinal acceptance uses a clean Desktop data root and visible UI actions; shell and HTTP are read-only audit surfaces after student-facing stages.

**Tech Stack:** TypeScript 7, Bun 1.3, Pi model runtime, React 19, Tauri 2, Bun test, Playwright, macOS DMG.

## Global Constraints

- Work only in `/Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/source-first-book-learning` on `codex/source-first-book-learning`.
- Do not add a second OCR model, full Pi Session, file tools, retry loop, background queue, or database for visual reading.
- Reliable native PDF text remains first; rendered page images go to the visual worker only after the existing quality gate.
- Explicit visual selection wins. Automatic GPT OAuth routing may choose Luna only when the teacher uses `openai-codex` and the runtime advertises an image-capable `gpt-5.6-luna`.
- Do not guess a cheap MiMo or Qwen model by brand or price; non-OpenAI users retain the explicit image-model selector.
- The visual worker receives no teacher conversation, memory, course tree, teaching Skill, or writable tool.
- Runtime retains page bounds, JSON validation, locator construction, persistence, and cache ownership.
- Real acceptance creates product state only through visible Desktop actions and role-authorized model tools. Inspect files, Sessions, and HTTP read-only.
- Do not commit credentials, original books, raw Session JSONL, private memory payloads, or unsanitized transcripts.

---

### Task 1: Give the visual worker one packaged prompt owner

**Files:**
- Create: `apps/pi-teaching-web/resources/workers/study-material-vision-reader.md`
- Create: `apps/pi-teaching-web/src/desktop/material-vision-prompt.ts`
- Modify: `apps/pi-teaching-web/src/desktop/material-vision.ts`
- Modify: `apps/pi-teaching-web/tests/source-first/material-vision.test.ts`
- Modify: `apps/pi-teaching-web/tests/desktop/sidecar-build.test.ts`

**Interfaces:**
- Produces: `loadMaterialVisionPrompt(resourceRoot?: string): string`.
- Consumed by: `MaterialVisionService` constructor default.
- Preserves: `MaterialVisionService.read(...)` and `MaterialVisionResult` public shapes.

- [ ] **Step 1: Write failing prompt ownership tests**

Add imports and a test to `tests/source-first/material-vision.test.ts`:

```ts
import { resolve } from 'node:path';
import { loadMaterialVisionPrompt } from '../../src/desktop/material-vision-prompt';

test('loads one packaged visual role that forbids teaching and unsupported completion', () => {
  const prompt = loadMaterialVisionPrompt(resolve(import.meta.dir, '../../resources'));
  expect(prompt).toContain('只负责读取');
  expect(prompt).toContain('不承担教学');
  expect(prompt).toContain('不确定就保留未知');
  expect(prompt).toContain('只返回 JSON');
});
```

Extend the existing isolated-context test:

```ts
expect(fake.calls[0]?.context.systemPrompt).toBe(
  loadMaterialVisionPrompt(resolve(import.meta.dir, '../../resources')),
);
```

Extend `tests/desktop/sidecar-build.test.ts`:

```ts
expect(existsSync(join(
  appRoot,
  'resources/workers/study-material-vision-reader.md',
))).toBe(true);
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/source-first/material-vision.test.ts tests/desktop/sidecar-build.test.ts
```

Expected: FAIL because `material-vision-prompt.ts` and the worker resource do not exist.

- [ ] **Step 3: Add the bounded worker resource**

Create `resources/workers/study-material-vision-reader.md` with this complete prompt:

```markdown
# 资料视觉读取员

你只负责读取 Runtime 给出的资料页面，不承担教学、诊断、学生建模、课程设计或资产生成。

按这条顺序工作：

1. 先辨认页面真实可见内容、阅读顺序和版面关系；
2. 按当前任务忠实转写正文、公式、表格或图意；
3. 目录任务只保留相当于编、章、节的导航骨架与可见印刷页码；
4. 只有图片同时出现目录末页与带可见印刷页码的首张正文时，才提出“物理页 = 印刷页 + 偏移”的候选；
5. 不确定就保留未知，不根据常识补写缺字、章节、公式、图意或页码；
6. 不翻页、不搜索整书、不自行重试，不读取或推断学生信息；
7. 只返回 JSON：{"text":"...","outline":[{"title":"...","level":1,"printedPage":"..."}],"printedPageOffset":15}。

没有目录候选时省略 `outline`；没有可靠页码偏移证据时省略 `printedPageOffset`。不要在 JSON 前后解释。
```

- [ ] **Step 4: Add the resource loader and inject it into the service**

Create `src/desktop/material-vision-prompt.ts`:

```ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceResourceRoot = join(dirname(fileURLToPath(import.meta.url)), '../../resources');

export function loadMaterialVisionPrompt(resourceRoot?: string): string {
  const root = resourceRoot
    ?? process.env.STUDYFORGE_RESOURCE_ROOT?.trim()
    ?? sourceResourceRoot;
  const value = readFileSync(
    join(root, 'workers', 'study-material-vision-reader.md'),
    'utf8',
  ).trim();
  if (!value) throw new Error('MATERIAL_VISION_PROMPT_EMPTY');
  return value;
}
```

In `src/desktop/material-vision.ts`, delete the inline `systemPrompt` constant, import the loader, and change the constructor and Context assignment:

```ts
import { loadMaterialVisionPrompt } from './material-vision-prompt';

export class MaterialVisionService {
  constructor(
    private readonly runtime: VisionRuntime,
    private readonly systemPrompt = loadMaterialVisionPrompt(),
  ) {}
}
```

Leave the existing `read(input)` method and result type unchanged.

Keep this existing Context behavior:

```ts
const context: Context = {
  systemPrompt: this.systemPrompt,
  messages: [{
    role: 'user',
    content: [{ type: 'text', text: input.prompt }, ...input.images],
    timestamp: Date.now(),
  }],
};
```

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/source-first/material-vision.test.ts tests/desktop/sidecar-build.test.ts
```

Expected: all tests PASS; the captured Context still has no tools or student memory.

- [ ] **Step 6: Commit Task 1**

```bash
git add apps/pi-teaching-web/resources/workers/study-material-vision-reader.md \
  apps/pi-teaching-web/src/desktop/material-vision-prompt.ts \
  apps/pi-teaching-web/src/desktop/material-vision.ts \
  apps/pi-teaching-web/tests/source-first/material-vision.test.ts \
  apps/pi-teaching-web/tests/desktop/sidecar-build.test.ts
git commit -m "refactor: isolate the material vision prompt"
```

---

### Task 2: Route GPT OAuth visual work to Luna low

**Files:**
- Modify: `apps/pi-teaching-web/src/desktop/material-vision.ts`
- Modify: `apps/pi-teaching-web/tests/source-first/material-vision.test.ts`
- Modify: `apps/pi-teaching-web/src/client/desktop/ModelSettings.tsx`
- Modify: `apps/pi-teaching-web/tests/desktop/desktop-ui.test.tsx`

**Interfaces:**
- Consumes: existing `DesktopModelSelection`, `DesktopVisionSelection`, `Model<Api>.input`.
- Produces: automatic selection behavior only; persisted config remains `{ mode: 'auto' }`.
- Preserves: explicit visual selection and teacher fallback behavior.

- [ ] **Step 1: Write the failing Luna route tests**

Allow the model fixture helper to receive a provider:

```ts
function model(
  id: string,
  input: Array<'text' | 'image'>,
  provider = 'test',
): Model<any> {
  return {
    provider,
    id,
    name: id,
    api: 'openai-responses',
    baseUrl: 'https://example.test',
    reasoning: true,
    input,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 100_000,
    maxTokens: 4_000,
  };
}
```

Add these tests before production changes:

```ts
test('auto routes an OpenAI Codex teacher to image-capable Luna at low', async () => {
  const fake = runtime([
    model('gpt-5.6-sol', ['text', 'image'], 'openai-codex'),
    model('gpt-5.6-luna', ['text', 'image'], 'openai-codex'),
  ]);
  const service = new MaterialVisionService(fake as never);
  const result = await service.read({
    teacher: { provider: 'openai-codex', model: 'gpt-5.6-sol', thinking: 'high' },
    vision: { mode: 'auto' },
    prompt: '读取这一页',
    images: [image],
  });

  expect(result.model).toBe('openai-codex/gpt-5.6-luna');
  expect(fake.calls[0]?.options).toEqual({ reasoning: 'low' });
});

test('auto does not steal an unselected OpenAI model from another provider', async () => {
  const fake = runtime([
    model('qwen-vision', ['text', 'image'], 'qwen'),
    model('gpt-5.6-luna', ['text', 'image'], 'openai-codex'),
  ]);
  const service = new MaterialVisionService(fake as never);
  const result = await service.read({
    teacher: { provider: 'qwen', model: 'qwen-vision', thinking: 'medium' },
    vision: { mode: 'auto' },
    prompt: '读取这一页',
    images: [image],
  });

  expect(result.model).toBe('qwen/qwen-vision');
  expect(fake.calls[0]?.options).toEqual({ reasoning: 'medium' });
});

test('auto falls back to the image-capable Codex teacher when Luna is absent', async () => {
  const fake = runtime([
    model('gpt-5.6-sol', ['text', 'image'], 'openai-codex'),
  ]);
  const service = new MaterialVisionService(fake as never);
  const result = await service.read({
    teacher: { provider: 'openai-codex', model: 'gpt-5.6-sol', thinking: 'high' },
    vision: { mode: 'auto' },
    prompt: '读取这一页',
    images: [image],
  });

  expect(result.model).toBe('openai-codex/gpt-5.6-sol');
  expect(fake.calls[0]?.options).toEqual({ reasoning: 'high' });
});
```

Change the UI assertion in `tests/desktop/desktop-ui.test.tsx` to:

```ts
expect(markup).toContain('自动选择低成本视觉模型');
expect(markup).toContain('GPT OAuth 优先 Luna');
expect(markup).not.toContain('自动使用支持图片的主教师');
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/source-first/material-vision.test.ts tests/desktop/desktop-ui.test.tsx
```

Expected: the Luna test calls Sol at `high`, and the new UI copy is absent.

- [ ] **Step 3: Implement the minimal automatic route**

Replace `selectedModel(...)` in `src/desktop/material-vision.ts` with behavior equivalent to:

```ts
function exactImageModel(
  models: readonly Model<Api>[],
  selection: DesktopModelSelection,
): Model<Api> | null {
  const model = models.find((candidate) => (
    candidate.provider === selection.provider && candidate.id === selection.model
  ));
  return model?.input.includes('image') ? model : null;
}

function selectedModel(
  models: readonly Model<Api>[],
  teacher: DesktopModelSelection,
  vision: DesktopVisionSelection,
): { model: Model<Api>; selection: DesktopModelSelection } {
  if (vision.mode === 'model') {
    const model = exactImageModel(models, vision.selection);
    if (!model) throw new Error('MATERIAL_VISION_UNAVAILABLE');
    return { model, selection: vision.selection };
  }

  if (teacher.provider === 'openai-codex') {
    const lunaSelection: DesktopModelSelection = {
      provider: 'openai-codex',
      model: 'gpt-5.6-luna',
      thinking: 'low',
    };
    const luna = exactImageModel(models, lunaSelection);
    if (luna) return { model: luna, selection: lunaSelection };
  }

  const model = exactImageModel(models, teacher);
  if (!model) throw new Error('MATERIAL_VISION_UNAVAILABLE');
  return { model, selection: teacher };
}
```

Do not inspect model price metadata and do not scan other providers.

- [ ] **Step 4: Update the settings copy without adding controls**

In `VisionModelRow`, change only these two literals:

```tsx
<p>独立读取扫描页、公式和图表，不进入课堂上下文；GPT OAuth 自动优先 Luna</p>
<option value="auto">自动选择低成本视觉模型</option>
```

Keep the existing explicit image-model options and thinking selector unchanged.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/source-first/material-vision.test.ts tests/desktop/desktop-ui.test.tsx
```

Expected: all tests PASS, including explicit override, JSON validation, Luna route, cross-provider restraint, and teacher fallback.

- [ ] **Step 6: Commit Task 2**

```bash
git add apps/pi-teaching-web/src/desktop/material-vision.ts \
  apps/pi-teaching-web/tests/source-first/material-vision.test.ts \
  apps/pi-teaching-web/src/client/desktop/ModelSettings.tsx \
  apps/pi-teaching-web/tests/desktop/desktop-ui.test.tsx
git commit -m "feat: route visual reading to Luna"
```

---

### Task 3: Verify packaging and all source-first boundaries

**Files:**
- Modify: `apps/pi-teaching-web/scripts/desktop/verify-bundle.ts`
- Modify: `AGENTS.md`
- Modify after evidence only: `docs/superpowers/specs/2026-08-12-source-first-learning-set-design.md`

**Interfaces:**
- Produces: a DMG containing `Contents/Resources/studyforge/workers/study-material-vision-reader.md`.
- Preserves: all existing source-first, M0–M2, typecheck, Vite, and deterministic E2E behavior.

- [ ] **Step 1: Write the bundle expectation before changing the verifier**

The source staging assertion from Task 1 is already green. First confirm the current built DMG does not contain the new resource:

```bash
cd apps/pi-teaching-web
find src-tauri/target/release/bundle -path '*study-material-vision-reader.md' -print
```

Expected before rebuilding: no matching path in the previous bundle.

- [ ] **Step 2: Require the worker resource in packaged verification**

Add to `scripts/desktop/verify-bundle.ts`:

```ts
'Contents/Resources/studyforge/workers/study-material-vision-reader.md',
```

Update `AGENTS.md` with these exact ownership facts:

```markdown
The one-shot Material vision reader is not a Pi teaching Session or a Plan-callable subagent. Its sole prompt owner is `apps/pi-teaching-web/resources/workers/study-material-vision-reader.md`; it receives only bounded rendered pages and returns validated structured text/outline hints. GPT OAuth automatic routing prefers image-capable `openai-codex/gpt-5.6-luna` at `low`, while explicit visual configuration remains authoritative.
```

- [ ] **Step 3: Run focused and source-first suites**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/source-first tests/desktop/desktop-ui.test.tsx \
  tests/desktop/sidecar-build.test.ts tests/desktop/desktop-api.test.ts
bunx playwright test tests/e2e/source-first-book.spec.ts
```

Expected: all focused tests PASS and Playwright reports `1 passed`.

- [ ] **Step 4: Run the full application check**

Run:

```bash
cd apps/pi-teaching-web
bun run check
```

Expected: TypeScript, all non-E2E Bun tests, and Vite production build PASS with no warnings treated as errors.

- [ ] **Step 5: Build and verify the real DMG**

Run:

```bash
cd apps/pi-teaching-web
bun run desktop:build
bun run desktop:verify
```

Expected: arm64 sidecars, ad-hoc signature, required resources including the visual worker, and DMG verification all PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add apps/pi-teaching-web/scripts/desktop/verify-bundle.ts AGENTS.md
git commit -m "build: package the visual reader role"
```

---

### Task 4: Run the real first-student Desktop journey

**Files:**
- Create after the run: `apps/pi-teaching-web/tests/validation/source-first-first-student-journey.md`
- Modify after the run: `docs/superpowers/specs/2026-08-12-source-first-learning-set-design.md`
- Do not add an automated state-writing validation script.

**Interfaces:**
- Consumes: verified DMG, existing local GPT OAuth credential, one user-owned real PDF, visible Desktop UI.
- Produces: sanitized evidence for one same-learning-set journey: book → Free Learning → confirmed problem card and object memory → Meta → Roadmap → Plan → prepared/active Lesson → Lesson close and memory evolution.

- [ ] **Step 1: Prepare a clean, recoverable runtime without deleting user data**

Use the already validated real book `/Users/yangrundong/Downloads/mst26版导数（上）原书.pdf` and create a new dedicated directory without deleting anything:

```bash
STUDENT_RUN_ROOT="$(mktemp -d /tmp/studyforge-first-student.XXXXXX)"
case "$STUDENT_RUN_ROOT" in
  /tmp/studyforge-first-student.*) ;;
  *) exit 1 ;;
esac
[ -n "$STUDENT_RUN_ROOT" ] && [ -d "$STUDENT_RUN_ROOT" ] && [ ! -L "$STUDENT_RUN_ROOT" ]
mkdir -m 700 "$STUDENT_RUN_ROOT/app" "$STUDENT_RUN_ROOT/app/agent" "$STUDENT_RUN_ROOT/documents"
AUTH_SOURCE='/Users/yangrundong/Library/Application Support/StudyForge/agent/auth.json'
BOOK_SOURCE='/Users/yangrundong/Downloads/mst26版导数（上）原书.pdf'
[ -f "$AUTH_SOURCE" ] && [ ! -L "$AUTH_SOURCE" ]
[ -f "$BOOK_SOURCE" ] && [ ! -L "$BOOK_SOURCE" ]
install -m 600 "$AUTH_SOURCE" "$STUDENT_RUN_ROOT/app/agent/auth.json"
```

Copy only the OAuth credential. Do not copy `app.json`, Sessions, learning sets, memory, or current course state.

Record:

```text
source commit and dirty state
DMG filename and SHA-256
isolated app/data root
selected local book title and byte size (not its private absolute path)
```

- [ ] **Step 2: Launch the verified DMG with isolated Desktop roots**

Resolve and mount the newest DMG read-only, then start its real `StudyForge.app` binary in a controlled terminal session:

```bash
STUDENT_DMG="$(find apps/pi-teaching-web/src-tauri/target/release/bundle/dmg -maxdepth 1 -type f -name '*.dmg' -print0 | xargs -0 ls -t | head -1)"
[ -n "$STUDENT_DMG" ] && [ -f "$STUDENT_DMG" ] && [ ! -L "$STUDENT_DMG" ]
STUDENT_DMG_MOUNT="$STUDENT_RUN_ROOT/dmg"
mkdir -m 700 "$STUDENT_DMG_MOUNT"
/usr/bin/hdiutil attach -nobrowse -readonly -mountpoint "$STUDENT_DMG_MOUNT" "$STUDENT_DMG"
STUDENT_APP_BIN="$STUDENT_DMG_MOUNT/StudyForge.app/Contents/MacOS/studyforge-desktop"
[ -x "$STUDENT_APP_BIN" ]
STUDYFORGE_DESKTOP_APP_HOME="$STUDENT_RUN_ROOT/app" \
STUDYFORGE_DESKTOP_DOCUMENTS_HOME="$STUDENT_RUN_ROOT/documents" \
"$STUDENT_APP_BIN"
```

Use the visible settings UI to save Sol `high`, Terra `high`, and visual `auto`. Confirm the model catalog displays Luna; do not edit `app.json` to force the selection.

- [ ] **Step 3: Create the first learning set and import the real book visibly**

From “第一次见面”, choose “从一本书开始”, use the system PDF picker, and create the new learning set under the isolated documents root. Through the visible book UI:

```text
initialize the page index
enter the real physical range covering the printed table of contents
build the outline
open one coherent chapter or page range
```

Capture the book overview, source reader, and visible processing progress. After the page task completes, audit the page projection read-only and require `model: openai-codex/gpt-5.6-luna`.

- [ ] **Step 4: Conduct natural Free Learning and create the first facts**

Act as a first-time student using only the selected pages and visible teacher replies. Start with a genuine, imperfect explanation or question grounded in the page. Reply naturally to the teacher’s probe until the student either shows an observable change or remains uncertain.

When a real worked problem is present, say naturally:

```text
这道题我以后还想重新做一次，帮我存成题卡，先把草稿给我看。
```

Review the visible stem, student note, answer boundary, and source. Approve in ordinary language only if correct. End the Free Learning thread from the UI after a natural close. Then audit, read-only:

```text
the exact native Free Learning Session
the canonical problem card revision and Material source locator
the semantic sidecar if created
memory/INDEX.md and the referenced object memory
the asset-to-source round trip in the UI
```

Require at least one evidence-backed object-memory entry. If none exists despite a visible cognitive change, record FAIL; do not write one manually.

- [ ] **Step 5: Continue the same history through Meta, Roadmap, Plan, and Lesson**

Using visible UI actions only:

```text
open long-term path discussion
describe the student’s real goal without naming hidden state
review the complete Roadmap-level proposal and confirm naturally
enter the Roadmap Session
discuss and confirm the first Plan
enter the Plan Session
discuss and prepare the first Lesson
start the Lesson from the UI
```

During the Lesson, respond from visible information only. Complete one independent check, naturally request or accept a second asset only if useful, and close the Lesson with the UI action. Do not force the whole Plan to completed.

- [ ] **Step 6: Audit continuity only after the classroom closes**

Read the exact native Sessions and canonical Markdown/YAML read-only. Require evidence that:

```text
Roadmap/Plan/Lesson ownership and statuses are valid
the prepared Lesson uses accurate source pages from the imported book
the formal path read or acted on the prior object memory or saved card when relevant
old memory evidence remains intact and the current judgment evolves rather than rewrites history
all saved assets return to the exact Material revision and page/page range
student-visible UI contains no raw IDs, tool arguments, private judgments, hidden answers, or API errors
```

- [ ] **Step 7: Write the sanitized report and update the design record**

Write `tests/validation/source-first-first-student-journey.md` with:

```markdown
## Run Identity
- commit, dirty state, DMG hash, models and thinking levels

## Student Journey
| Stage | visible student action | model/session | elapsed | durable result |

## Source and Asset Evidence
- imported Material revision and human-readable locator
- confirmed problem card and source round trip

## Memory Continuity
- observed change, object-memory summary, later use, remaining uncertainty

## Course Continuity
- Meta/Roadmap/Plan/Lesson ownership, first Lesson use of prior history

## Result
| Layer | PASS / FAIL / BLOCKED | sanitized evidence |

## Next Action
- smallest evidence-backed next step, or none
```

Do not include secrets, raw teacher-only text, full copyrighted pages, or full transcripts. Update the source-first design status and implementation record only for stages that actually passed.

- [ ] **Step 8: Run final verification and commit the evidence**

Run:

```bash
cd apps/pi-teaching-web
bun run check
git diff --check
```

Expected: all checks PASS. Then commit only the sanitized report and accurate design record:

```bash
git add apps/pi-teaching-web/tests/validation/source-first-first-student-journey.md \
  docs/superpowers/specs/2026-08-12-source-first-learning-set-design.md
git commit -m "test: validate the first book learning journey"
```

Keep the isolated runtime intact until the report is reviewed. Stop the Desktop process and detach the read-only DMG; do not delete the evidence root automatically.
