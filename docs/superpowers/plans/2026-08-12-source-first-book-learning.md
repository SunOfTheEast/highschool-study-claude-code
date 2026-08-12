# Source-First Book Learning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a real PDF book the simplest StudyForge starting point: import it without loading the whole file into browser memory, read the original pages, progressively extract only the pages the student opens, start Free Learning from an exact page range, and see resulting Notes/problem cards projected back under the source book and chapter.

**Architecture:** Keep `Material revision` as the only source fact and add one rebuildable `book-index.yaml` projection per revision. Desktop file picking sends an absolute path only to the authenticated desktop handler; the runtime copies and hashes it without a browser upload. PDF metadata, bookmarks, page labels, per-page extraction state, and outline candidates are persisted incrementally. The reader displays a rendered original page; native text extraction and vision fallback run as isolated material-processing calls with no teaching Session context. Existing asset `sources`, Free Learning, semantic tags, memory, review, and Roadmap/Plan/Lesson ownership remain unchanged.

**Tech Stack:** Bun 1.3, TypeScript 7, React 19, Vite 8, Tauri 2, `pdfjs-dist` 5, `@napi-rs/canvas`, Pi `ModelRuntime`, YAML projections, Bun test, Playwright.

**Execution status (2026-08-13):** Tasks 1–9 are implemented. Deterministic E2E and the real scanned-book/model loop pass; final full-suite verification is recorded in the Task 9 validation report.

## Global Constraints

- Work in an isolated worktree. Preserve the user's unrelated dirty files on `main`.
- Follow red-green-refactor for every behavior slice. A new test must fail for the expected reason before production code changes.
- The PDF is immutable source truth. OCR/native extracted text, page labels, bookmarks, and outline nodes are rebuildable projections.
- Do not add canonical `Book`, `Chapter`, `OCRDocument`, relationship-edge, progress, mastery, or background-job schemas.
- Do not perform hidden whole-book OCR, adjacent-chapter prefetch, or semantic indexing of untouched raw pages.
- Never infer learning, mastery, memory, review enrollment, or course state from import, open, scroll, extraction, or asset counts.
- The runtime creates and validates `page-NNNN` / `pages-NNNN-NNNN`; models do not handwrite locator strings.
- A vision task receives only its prompt and rendered page images. It does not inherit Tutor messages, student memory, course documents, or teaching Skills.
- Imported PDFs can exceed 32 MB on desktop. Browser multipart remains a compatibility path for small non-desktop files, not the primary book path.
- Reuse the approved visual baseline in `apps/pi-teaching-web/preview/source-first/`; do not add dashboard cards, drag-to-build graphs, chapter completion percentages, or unverified status labels.
- First-stage scope excludes model-authored books, a curated-set marketplace, cloud sync, crop/region annotations, and batch card generation.

---

## Task 1: Add one mechanical locator grammar and a revision-keyed book-index projection

**Files:**

- Create: `apps/pi-teaching-web/src/study/material-locators.ts`
- Create: `apps/pi-teaching-web/src/study/material-book-index.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/study/materials.ts`
- Create: `apps/pi-teaching-web/tests/source-first/material-locators.test.ts`
- Create: `apps/pi-teaching-web/tests/source-first/material-book-index.test.ts`

**Interfaces:**

```ts
export type MaterialLocator =
  | { kind: 'whole' }
  | { kind: 'lines'; start: number; end: number }
  | { kind: 'pages'; start: number; end: number };

export function parseMaterialLocator(value: string | null): MaterialLocator;
export function formatMaterialLocatorValue(locator: MaterialLocator): string | null;

export type MaterialBookPage = {
  physicalPage: number;
  pdfLabel: string | null;
  state: 'pending' | 'native-text' | 'visual-text' | 'failed';
  textPath: string | null;
  method: 'native' | 'vision' | null;
  model: string | null;
  updatedAt: string | null;
  error: string | null;
};

export type MaterialBookOutlineNode = {
  id: string;
  title: string;
  level: number;
  source: 'pdf-bookmark' | 'visual-toc' | 'curated';
  printedPage: string | null;
  startPage: number | null;
  endPage: number | null;
  provenancePages: number[];
};

export type MaterialBookIndex = {
  schema: 'studyforge.material-book-index.v1';
  materialId: string;
  revision: number;
  pageCount: number;
  state: 'ready' | 'partial';
  pages: MaterialBookPage[];
  outline: MaterialBookOutlineNode[];
  updatedAt: string;
};
```

- [ ] Write locator tests covering `whole`, `lines-2-8`, `page-0062`, `pages-0062-0065`, reversed ranges, zero, malformed padding, and a range exceeding known page count.
- [ ] Run `bun test tests/source-first/material-locators.test.ts` and confirm failure because the module does not exist.
- [ ] Implement a single parser/formatter used by HTTP validation, source validation, material reads, and UI formatting. Preserve `page-NNNN` on a one-page range; use `pages-NNNN-NNNN` only for two or more contiguous pages.
- [ ] Write book-index tests for deterministic path `materials/<id>/projections/<revision>/book-index.yaml`, strict schema/revision identity, complete physical page enumeration, atomic replacement, and recovery from an absent projection.
- [ ] Run the book-index test and confirm the missing implementation failure.
- [ ] Implement YAML read/write helpers through `commitDocumentCandidates`; do not add the projection path to the canonical Material manifest.
- [ ] Update `readMaterialLocator()` to read and concatenate a contiguous page range from page projection files while preserving exact pinned revision behavior.
- [ ] Run both focused tests plus `bun test tests/m1c/materials.test.ts tests/m1c/session-asset-tools.test.ts`.
- [ ] Commit: `feat: add recoverable material book indexes`

## Task 2: Replace desktop PDF upload with authenticated path import and lazy initialization

**Files:**

- Modify: `apps/pi-teaching-web/src/study/materials.ts`
- Modify: `apps/pi-teaching-web/src/server/desktop-app.ts`
- Modify: `apps/pi-teaching-web/src/server/start-server.ts`
- Modify: `apps/pi-teaching-web/src/client/desktop/bridge.ts`
- Modify: `apps/pi-teaching-web/src/client/desktop/api.ts`
- Modify: `apps/pi-teaching-web/src-tauri/src/lib.rs`
- Modify: `apps/pi-teaching-web/src/client/pages/AssetsPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Create: `apps/pi-teaching-web/tests/source-first/material-path-import.test.ts`
- Modify: `apps/pi-teaching-web/tests/desktop/desktop-api.test.ts`
- Modify: `apps/pi-teaching-web/tests/desktop/desktop-ui.test.tsx`

**Interfaces:**

```ts
export type MaterialImportSource =
  | { kind: 'bytes'; bytes: Uint8Array }
  | { kind: 'path'; absolutePath: string };

export async function importMaterial(
  root: string,
  input: Omit<MaterialImportInput, 'bytes'> & { source: MaterialImportSource },
  importedAt: string,
): Promise<MaterialImportReceipt>;

// Desktop-only, authenticated, same-origin endpoint.
POST /api/desktop/materials/import-path
{ requestId, title, absolutePath, target? }
```

- [ ] Write a path-import test that creates a sparse file larger than 32 MB, imports it through `{ kind: 'path' }`, verifies the immutable copy/hash/manifest, and asserts no page projection is produced during import.
- [ ] Run `bun test tests/source-first/material-path-import.test.ts` and confirm it fails against the bytes-only API.
- [ ] Refactor `importMaterial` so both sources share validation, idempotency, revision checks, cleanup, and manifest commit. Hash path input with a stream and copy to a sibling temporary path before atomic rename; reject symlink/non-file sources and never place a half-copy in a visible revision.
- [ ] Change PDF import to `searchStatus: unavailable` plus no eager page extraction. Keep native text files readable immediately and keep the existing small multipart endpoint for compatibility.
- [ ] Add a Tauri `choose_book_file` command filtered to PDF and expose it through `DesktopBridge.chooseBookFile()`.
- [ ] Add the desktop endpoint. Resolve the currently selected learning-set root from validated app config; do not accept a caller-supplied destination root. Publish the same home/assets/knowledge invalidations after success.
- [ ] Add a desktop import function to the client. In desktop mode, `AssetsPage` receives a “选择 PDF” action that uses the bridge path; the browser `File` form remains available in non-desktop mode.
- [ ] Test cancellation, a path outside any learning set (allowed as source), symlink rejection, idempotent request IDs, stale target revision, and source deletion after a successful copy.
- [ ] Run `bun test tests/source-first/material-path-import.test.ts tests/desktop/desktop-api.test.ts tests/desktop/desktop-ui.test.tsx tests/m1c/materials.test.ts tests/m1c/server-api.test.ts`.
- [ ] Commit: `feat: import desktop books by file path`

## Task 3: Bootstrap PDF metadata, bookmarks, page labels, and faithful page rendering on demand

**Files:**

- Create: `apps/pi-teaching-web/src/study/pdf-book.ts`
- Modify: `apps/pi-teaching-web/src/study/pdf-runtime.ts`
- Modify: `apps/pi-teaching-web/src/study/material-book-index.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/server/start-server.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Create: `apps/pi-teaching-web/tests/source-first/pdf-book.test.ts`
- Create: `apps/pi-teaching-web/tests/source-first/material-book-api.test.ts`

**Endpoints:**

```text
POST /api/materials/:id/revisions/:revision/book-index
GET  /api/materials/:id/revisions/:revision/page/:physicalPage.png
GET  /api/materials/:id/revisions/:revision/book-index
```

- [ ] Add a fixture PDF with three pages, page labels, and nested bookmarks. Write a test that expects a complete physical page list and bookmark nodes mapped to physical pages without extracting page bodies.
- [ ] Run the PDF test and confirm failure because no book bootstrap exists.
- [ ] Implement `bootstrapPdfBookIndex()` using `pdfjs-dist`: open the immutable revision path, record page count/labels, flatten bookmarks while preserving levels, and resolve bookmark destinations mechanically. Do not read every page's text.
- [ ] Write an API test that explicitly starts indexing, polls the resulting synchronous receipt, and fetches a rendered PNG for one physical page. Assert formulas/lines are present by verifying nonblank pixel content and image dimensions.
- [ ] Implement single-page rendering with `@napi-rs/canvas`; cap scale/pixel area and expose only immutable revision pages. Do not expose arbitrary filesystem paths.
- [ ] Persist index state before returning. Repeating bootstrap must be idempotent and preserve already processed page states.
- [ ] Return student-safe errors for non-PDF material, page out of range, corrupt PDF, and render failure.
- [ ] Run `bun test tests/source-first/pdf-book.test.ts tests/source-first/material-book-api.test.ts tests/m1c/server-api.test.ts`.
- [ ] Commit: `feat: index and render pdf books on demand`

## Task 4: Expose image capability and configure one isolated visual-reading model

**Files:**

- Modify: `apps/pi-teaching-web/src/desktop/contracts.ts`
- Modify: `apps/pi-teaching-web/src/desktop/app-config.ts`
- Modify: `apps/pi-teaching-web/src/desktop/model-service.ts`
- Modify: `apps/pi-teaching-web/src/server/desktop-app.ts`
- Modify: `apps/pi-teaching-web/src/client/desktop/api.ts`
- Modify: `apps/pi-teaching-web/src/client/desktop/ModelSettings.tsx`
- Modify: `apps/pi-teaching-web/src/client/desktop/DesktopRoot.tsx`
- Create: `apps/pi-teaching-web/src/desktop/material-vision.ts`
- Modify: `apps/pi-teaching-web/tests/desktop/app-config.test.ts`
- Modify: `apps/pi-teaching-web/tests/desktop/model-service.test.ts`
- Modify: `apps/pi-teaching-web/tests/desktop/desktop-ui.test.tsx`
- Create: `apps/pi-teaching-web/tests/source-first/material-vision.test.ts`

**Contracts:**

```ts
export type DesktopVisionSelection =
  | { mode: 'auto' }
  | { mode: 'model'; selection: DesktopModelSelection };

export type DesktopModelDescriptor = {
  // existing fields
  input: Array<'text' | 'image'>;
};
```

- [ ] Write config migration tests: an existing version-1 config without `vision` loads as `{ mode: 'auto' }`; explicit vision selection round-trips; malformed modes fail.
- [ ] Run config tests and confirm failure.
- [ ] Add the backward-compatible config field and include Pi model `input` capabilities in the desktop catalog.
- [ ] Add an optional “资料视觉读取” row to settings. Default is “自动使用支持图片的主教师”; explicit choices show only image-capable models. Saving an explicit text-only model must fail server-side even if the UI is bypassed.
- [ ] Write `MaterialVisionService` tests with a fake `ModelRuntime`: auto selects the teacher only when `model.input` contains `image`; explicit override wins; no capable model returns `MATERIAL_VISION_UNAVAILABLE`; request context contains only a fixed system instruction plus page images/text prompt.
- [ ] Implement the isolated call using Pi `ImageContent`; parse one strict JSON response `{ text, outline? }`, reject nonconforming output, and store provider/model identity only in the page projection.
- [ ] Run `bun test tests/desktop/app-config.test.ts tests/desktop/model-service.test.ts tests/desktop/desktop-ui.test.tsx tests/source-first/material-vision.test.ts`.
- [ ] Commit: `feat: configure isolated visual material reading`

## Task 5: Progressively read native or scanned pages and build a bounded visual table of contents

**Files:**

- Create: `apps/pi-teaching-web/src/study/material-page-reader.ts`
- Modify: `apps/pi-teaching-web/src/study/pdf-book.ts`
- Modify: `apps/pi-teaching-web/src/study/material-book-index.ts`
- Modify: `apps/pi-teaching-web/src/study/materials.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/server/start-server.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Create: `apps/pi-teaching-web/tests/source-first/material-page-reader.test.ts`
- Create: `apps/pi-teaching-web/tests/source-first/visual-toc.test.ts`

**Endpoints:**

```text
POST /api/materials/:id/revisions/:revision/pages/:page/read
POST /api/materials/:id/revisions/:revision/outline/scan
POST /api/materials/:id/revisions/:revision/outline/:nodeId/locate
```

- [ ] Write page-reader tests for a native-text page, an empty scanned page routed to vision, explicit visual retry, persisted success, persisted failure, and retry without re-reading successful pages.
- [ ] Run the focused test and confirm failure.
- [ ] Implement the bright-line order: extract native text → if nonempty and sane, persist native result → otherwise render only that page and call vision → atomically persist state/text/provenance. Never write asset, memory, review, or course files.
- [ ] Treat formula/table/diagram meaning as a reason the UI may request explicit visual retry; do not pretend a text heuristic can prove semantic completeness.
- [ ] Write visual-TOC tests using a fake vision response over a bounded caller-selected page range (maximum 12 pages). Nodes initially keep printed page hints and null physical pages.
- [ ] Implement outline scan only when the student explicitly asks to organize the directory. If bookmarks already exist, preserve them and place visual candidates separately/by source rather than overwriting them.
- [ ] Implement bounded node location: first map exact PDF page labels; otherwise inspect a maximum configured candidate window around the printed-page hypothesis. Persist a locator only after matching the chapter title. On failure return candidate pages and keep the node unresolved.
- [ ] Extend `readMaterialLocator()` so requesting a pending PDF page triggers no hidden model work; only the explicit read endpoint processes it.
- [ ] Run `bun test tests/source-first/material-page-reader.test.ts tests/source-first/visual-toc.test.ts tests/source-first/material-book-api.test.ts tests/m1c/materials.test.ts`.
- [ ] Commit: `feat: progressively read scanned book pages`

## Task 6: Project source-tree assets and human-readable source labels without new facts

**Files:**

- Create: `apps/pi-teaching-web/src/study/source-tree.ts`
- Create: `apps/pi-teaching-web/src/study/source-labels.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Modify: `apps/pi-teaching-web/src/client/components/AssetSources.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/NotePage.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/ProblemCardPage.tsx`
- Create: `apps/pi-teaching-web/tests/source-first/source-tree.test.ts`
- Create: `apps/pi-teaching-web/tests/source-first/source-labels-ui.test.tsx`

**Projection rules:**

- A material source appears beneath every resolved outline node whose physical span intersects its locator.
- A multi-source asset can appear in multiple books/chapters but retains one canonical kind/id/revision.
- Assets with no Material source appear once under “书外生长”.
- Unresolved locators appear under the book's “暂未归入章节”, never under a guessed chapter.

- [ ] Write a source-tree test with two books, one cross-book Note, one one-page card, one page-range card, one unresolved outline, one source-less Note, and an old source revision.
- [ ] Run the test and confirm failure.
- [ ] Implement `readSourceTree(root)` entirely from Material manifests/index projections, canonical asset revisions, and pinned `sources`. Do not persist reverse links or mutate assets.
- [ ] Add `GET /api/source-tree` and source label projection that resolves book title, revision, chapter title when mechanically known, and physical page/range. Internal locators remain in link targets, not visible copy.
- [ ] Update Note/problem-card source displays to use labels and provide one-click navigation back to the exact old Material revision/page.
- [ ] Test that revising a Material leaves old source labels/routes pinned, and that deleting/rebuilding a book index degrades to book + page rather than changing the source.
- [ ] Run `bun test tests/source-first/source-tree.test.ts tests/source-first/source-labels-ui.test.tsx tests/m1d/asset-detail-ui.test.tsx tests/m1c/semantic-index.test.ts`.
- [ ] Commit: `feat: project learning assets along source books`

## Task 7: Implement the approved five-screen source-first desktop flow

**Files:**

- Modify: `apps/pi-teaching-web/src/client/desktop/FirstRun.tsx`
- Modify: `apps/pi-teaching-web/src/client/desktop/DesktopRoot.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/HomePage.tsx`
- Replace: `apps/pi-teaching-web/src/client/pages/MaterialPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/AssetsPage.tsx`
- Create: `apps/pi-teaching-web/src/client/pages/SourceTreePage.tsx`
- Modify: `apps/pi-teaching-web/src/client/routes.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/study/learning-set-home.ts`
- Create: `apps/pi-teaching-web/tests/source-first/source-first-ui.test.tsx`
- Modify: `apps/pi-teaching-web/tests/desktop/desktop-ui.test.tsx`
- Modify: `apps/pi-teaching-web/tests/m1c/m1c-ui.test.tsx`
- Modify: `apps/pi-teaching-web/tests/m1d/navigation-scroll.test.ts`

**Routes:**

```text
/assets/books/:materialId                         book overview
/assets/books/:materialId/read/:revision/:locator original-page reader
/assets?view=sources                              source tree
```

- [ ] Write static-render/router tests for all five approved screens using the copy and hierarchy from `preview/source-first/`: first run, home, book overview, reader, source-tree assets.
- [ ] Confirm the tests fail because routes/components do not exist and First Run still leads with blank learning.
- [ ] Make “从一本书开始” the sole dominant First Run action. It creates a normal blank learning set, restarts into it, opens the file picker, imports the PDF, and navigates to its overview. Cancellation after set creation lands on a calm empty home with an import action, not an error loop.
- [ ] Add the home source-first action only when a Material exists: continue the most recently imported/opened book or choose from its directory; keep “问老师” as the quiet alternative. Do not show fake reading progress.
- [ ] Build the book overview with cover/identity, visible indexing state, outline, static teacher-like start guidance, and “从本书长出的资产”. Rendering the page must not create a Session or call a model.
- [ ] Build the desktop three-column reader: source outline, rendered original page(s), compact learning rail. “和老师学这里” passes exactly one pinned Material reference to existing `createFreeLearning`; selecting a range uses runtime-formatted contiguous locator.
- [ ] Add previous/next page and previous/next resolved outline navigation, explicit “视觉读取这一页/重新读取”, and student-language states. Preserve the last successful page while a request fails.
- [ ] Add the Assets “沿书学习” view next to existing type, footprint, and knowledge views. Reuse canonical asset links; never duplicate asset bodies.
- [ ] Match the approved paper/ink/green/cinnabar grammar. Verify content boundaries at 1280×768 and 1440×900; the PDF pane gets the largest width and the right rail has a visible boundary.
- [ ] Run `bun test tests/source-first/source-first-ui.test.tsx tests/desktop/desktop-ui.test.tsx tests/m1c/m1c-ui.test.tsx tests/m1d/navigation-scroll.test.ts` and `bun run build`.
- [ ] Commit: `feat: make books the source-first learning entrance`

## Task 8: Keep source context compact and reuse the existing teaching/asset loop

**Files:**

- Modify: `apps/pi-teaching-web/src/client/free-learning-contexts.ts`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/src/study/learning-assets.ts`
- Modify: `apps/pi-teaching-web/src/runtime/free-learning-tools.ts`
- Create: `apps/pi-teaching-web/src/runtime/material-source-tools.ts` only if the red test proves native exact-file reading cannot enforce the neighboring-page boundary
- Modify: `apps/pi-teaching-web/resources/skills/free-learning/SKILL.md` only if the current skill fails to state the source boundary
- Create: `apps/pi-teaching-web/tests/source-first/source-session-boundary.test.ts`
- Modify: `apps/pi-teaching-web/tests/m1c/session-asset-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/m1b/free-learning-session.test.ts`

- [ ] Write a session-boundary test: starting from `pages-0042-0044` exposes only book identity, human chapter label, exact pinned revision/locator, and already processed text for those pages. It must not inject the entire book index, other chapters, all book assets, memory indexes, or raw PDF bytes.
- [ ] Run the test and confirm the current context projection is insufficient or overbroad.
- [ ] Keep the selected page/range inline through `renderSelectedAssetContext()`. If the red test proves adjacent glue cannot be read safely with the native exact-file reader, add one narrow `read_material_source` tool whose only inputs are the already selected source alias and one exact adjacent locator; otherwise do not add a redundant tool. Keep every extra read small and visible in tool history.
- [ ] Verify existing propose Note/problem-card tools can save the exact pinned source from the Session and that natural student confirmation remains the only save gate.
- [ ] If a Skill edit is needed, add only one bright line: learn from the selected source first; read neighboring source only when the current explanation needs its glue; save only after an explicit student-approved draft. Do not add a general distillation workflow.
- [ ] Test that no Roadmap, Plan, Lesson, memory object, review event, or mastery statement appears from source opening alone.
- [ ] Run `bun test tests/source-first/source-session-boundary.test.ts tests/m1c/session-asset-tools.test.ts tests/m1b/free-learning-session.test.ts tests/m2/learning-asset-proposals.test.tsx`.
- [ ] Commit: `feat: carry exact book sections into teaching sessions`

## Task 9: Validate the full real-book loop and package-facing behavior

**Files:**

- Create: `apps/pi-teaching-web/tests/e2e/source-first-book.spec.ts`
- Create: `apps/pi-teaching-web/scripts/source-first-validation/cli.ts`
- Create: `apps/pi-teaching-web/tests/validation/source-first-real-model.md`
- Modify: `apps/pi-teaching-web/package.json`
- Update: `docs/superpowers/specs/2026-08-12-source-first-learning-set-design.md`

- [ ] Add a deterministic E2E fixture covering path import, index bootstrap, original-page display, range selection, Free Learning creation, one Note save, source-tree appearance, and return-to-source navigation. Assert no internal model/task/locator codes are visible.
- [ ] Run `bunx playwright test tests/e2e/source-first-book.spec.ts` and fix only source-first regressions.
- [ ] Run the real validation with a legally held scanned PDF over 32 MB containing formulas, a table, a diagram, and a printed/PDF page-number offset. Use the configured real teacher/vision models; do not replace this with a generated one-page PDF.
- [ ] Record timestamps and outcomes for import return, index bootstrap, first rendered page, scanned-page extraction, Session start, and saved-asset round trip. Verify interruption/restart reuses persisted page states.
- [ ] Add a second book and form one Note with two pinned sources. Verify one canonical Note appears under both source branches and in the semantic view without an invented “same”, “prerequisite”, or “consensus” edge.
- [ ] Verify old-revision return links after importing a new revision of the first book.
- [ ] Verify no implicit Roadmap, Plan, Lesson, memory, review enrollment, or mastery facts were created.
- [ ] Run `bun run typecheck`, all focused source-first tests, `bun run test`, and `bun run build`.
- [ ] If packaging files changed, run `bun run desktop:prepare`, `bun run desktop:sidecars`, `bun run desktop:smoke`, `bun run desktop:build`, and `bun run desktop:verify`.
- [ ] Update the design status and append exact real-model evidence, known degradations, and deferred boundaries. Do not call the feature release-ready if scanned visual extraction or packaged PDF rendering was not actually exercised.
- [ ] Commit: `test: validate source-first book learning end to end`

## Completion Gate

The implementation is complete only when all of the following are true:

- A desktop user can select and import a PDF larger than 32 MB without browser `arrayBuffer()` or whole-book extraction.
- The book overview returns after cheap metadata/index work and never performs hidden full-book OCR.
- Original formulas, tables, diagrams, and layout are visible from immutable revision pages.
- A scanned page can be read by an explicitly verified image-capable model and resumes from persisted page state.
- One exact page/range opens a normal Free Learning Session, and an approved Note/problem card preserves that exact source.
- Source tree and semantic view are orthogonal projections of the same canonical asset.
- Old assets still return to the old source revision after an update.
- Import/open/read alone creates no learning, memory, review, or course facts.
- The five production screens match the approved preview hierarchy and remain readable at desktop target sizes.
- Focused, full, E2E, real-model, and (when touched) packaged-DMG verification evidence is recorded.
