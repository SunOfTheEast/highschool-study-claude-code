# M1d Student Interface and Knowledge Relations Implementation Plan

> **Execution:** Implement inline in this worktree with `superpowers:test-driven-development`; verify each task before continuing and use `superpowers:verification-before-completion` before claiming completion.

**Goal:** Turn the existing M0—M1c StudyForge runtime into the approved desktop student product without adding a new canonical fact layer, lifecycle controller, or Agent tool.

**Architecture:** Keep the current Markdown/YAML runtime and Pi sessions authoritative. Add only typed display projections derived from existing course, Session, asset, Material, activity, and semantic-relation facts. Recompose the React pages around a shared Liubai visual grammar, and build the knowledge view as a deterministic local projection over `/api/semantics/relations`.

**Tech stack:** TypeScript, React 19, Bun, Hono-style request handler, CSS, KaTeX, Bun test, Playwright.

**Design source:** `docs/superpowers/specs/2026-08-09-m1d-student-interface-and-knowledge-relations-design.md`

**Execution result (2026-08-09):** Complete. Tasks 1–7 landed as bounded implementation commits; Task 8 passed 307 non-E2E tests, production typecheck/build, 7 deterministic browser cases, desktop screenshot review, and one real-provider UI smoke. The smoke preserved one separate performance finding: confirmed Plan preparation took about 12 minutes 22 seconds despite continuous visible progress.

---

## Task 1: Add the minimal typed display projections

**Files:**

- Create: `apps/pi-teaching-web/src/study/display-projections.ts`
- Create: `apps/pi-teaching-web/tests/m1d/display-projections.test.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/study/learning-set-home.ts`
- Modify: `apps/pi-teaching-web/src/study/semantic-index.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Modify focused fixtures/tests that construct `FreeLearningSessionSummary`

- [x] Write failing tests for: active Lesson exact route, no-active-Lesson null result, first-student-message title normalization, immutable selected assets, formation route resolution, and typed semantic relations.
- [x] Run `bun test tests/m1d/display-projections.test.ts` and confirm RED for the missing projections.
- [x] Add shared `ActiveLessonSummary`, `AssetFormation`, and `SemanticRelation` types; type `semanticRelations()` and asset detail `formation` instead of using `unknown[]`.
- [x] Derive `home.course.activeLesson` only from a real `active` Lesson under its actual Plan; never use browsing history.
- [x] Derive free-learning display title mechanically from the first projected student message, with Markdown/newline cleanup and a bounded fallback; expose the Session owner's immutable `selectedAssets`.
- [x] Resolve asset formation from `createdSessionId` through existing owned Session facts; return `null` for unresolved legacy origins.
- [x] Keep object-memory relation variants available to internal M1c projection code while making the client filter boundary explicit.
- [x] Run the focused test, affected M1b/M1c server tests, then `bun run typecheck`.
- [x] Commit: `feat: add m1d display projections`

## Task 2: Establish the shared Liubai visual grammar

**Files:**

- Create: `apps/pi-teaching-web/tests/m1d/visual-grammar.test.tsx`
- Modify: `apps/pi-teaching-web/src/client/theme-liubai.css`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Modify: `apps/pi-teaching-web/src/client/styles/workspace-shell.css`
- Modify: `apps/pi-teaching-web/src/client/components/AppShell.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/AssetSources.tsx`
- Modify: `apps/pi-teaching-web/src/client/main.tsx`

- [x] Write failing markup/CSS tests for `学 / 继 / 问` seal semantics, four action levels, core/related distinction, formation/source separation, minimum auxiliary type size, and the accessible `--ink-faint` value.
- [x] Run `bun test tests/m1d/visual-grammar.test.tsx` and confirm RED.
- [x] Port only the approved preview tokens and fittings: three papers, hairlines, restrained seal, wash/outline/text actions, readable typography, and no lift shadows.
- [x] Make `AssetTags` preserve `core` versus `related` roles and optionally route a tag to the relation page.
- [x] Add one provenance component that renders “形成于” separately from “内容来源”; keep technical revision/locator details progressive.
- [x] Keep `MarkdownView`, KaTeX, self-hosted WenKai, AppShell routing, and persona hooks unchanged.
- [x] Run focused visual tests plus `tests/m0/liubai-theme.test.ts` and `bun run typecheck`.
- [x] Commit: `feat: establish m1d visual grammar`

## Task 3: Recompose the home, free-learning, Meta, and asset-shelf flows

**Files:**

- Create: `apps/pi-teaching-web/tests/m1d/entry-and-dialogue-ui.test.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/HomePage.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/FreeLearningPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/MetaPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/AssetsPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles/m1b.css`

- [x] Write failing tests for the active-Lesson “继” card and exact route, no-active-Lesson “问” primary action, quiet course/Meta links, real conversation title/context, ended composer, selected count, relation link, reconnect draft behavior, long-task replacement, and hidden generic tool JSON.
- [x] Run the new test and confirm RED.
- [x] Rebuild Home as the 玄关 with one strongest action selected from the server projection; keep free threads in the recent ledger.
- [x] Render Free/Meta as a single-column 信纸 with real display title and selected-asset context; close Meta input after Roadmap materializes.
- [x] Keep textarea editable while disconnected, disable only send, and retain failed drafts. Replace raw generic tool detail with one safe human receipt; preserve dedicated Scout/Reviewer/Handout projections.
- [x] Rebuild Assets as the 架, with Note/card-only multi-selection, `带着所选问老师 · N`, Materials separate, and links to footprint and knowledge relations.
- [x] Preserve current Session creation/end APIs, safe event projections, and route ownership.
- [x] Run the new test, `tests/m0/course-ui.test.tsx`, `tests/m1b/m1b-ui.test.tsx`, `tests/m1c/m1c-ui.test.tsx`, and typecheck.
- [x] Commit: `feat: refine m1d learning entry flows`

## Task 4: Recompose Note, problem-card, and Material detail pages

**Files:**

- Create: `apps/pi-teaching-web/tests/m1d/asset-detail-ui.test.tsx`
- Create: `apps/pi-teaching-web/src/client/material-locator.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/NotePage.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/ProblemCardPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/MaterialPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles/m1b.css`

- [x] Write failing tests for Note formation/source separation and ask action; problem ask copy before/after attempt and the unchanged answer gate; human/canonical locator display; auto-read of suggested locator; failed locate preserving the last successful source and ask binding; and stale-write draft preservation.
- [x] Run the new test and confirm RED.
- [x] Recompose Note as 笺 and add `带着这份笔记问老师`; keep recall blocks and edit semantics.
- [x] Recompose problem card as 卷; separate attempt, cannot, reveal, note-save, and ask pending states so one action never disables unrelated controls.
- [x] Recompose Material as 文献; auto-read the suggestion, show a human label first, hide advanced locator by default, and bind ask only to a successfully resolved locator.
- [x] Handle HTTP 409 as “内容已被更新” while retaining local drafts and offering reload; do not implement automatic merging.
- [x] Run the new test, existing M1b/M1c asset tests, and typecheck.
- [x] Commit: `feat: refine m1d learning asset details`

## Task 5: Turn the learning footprint into an honest ledger

**Files:**

- Create: `apps/pi-teaching-web/tests/m1d/footprint-ui.test.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/FootprintPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles/m1b.css`

- [x] Write failing tests for newest-first independent rows, four event categories, accurate action labels/routes, cognition-only Learning History copy, and `时间未记录` at the end.
- [x] Run the new test and confirm RED.
- [x] Render a single 账簿 timeline with semantic category markers; do not merge events or add filters/statistics.
- [x] Choose action copy from the source kind: enter conversation/course, open content/material/card, or return to learning.
- [x] Keep internal object path, Current Judgment, capabilities, preferences, and bucket names out of markup.
- [x] Run the focused test and `tests/m1c/learning-footprint.test.ts`.
- [x] Commit: `feat: render learning footprint as ledger`

## Task 6: Replace the old knowledge tree with a local semantic relation view

**Files:**

- Create: `apps/pi-teaching-web/src/client/semantic-graph.ts`
- Create: `apps/pi-teaching-web/tests/m1d/semantic-graph.test.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/KnowledgePage.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles/knowledge.css`
- Modify: `apps/pi-teaching-web/tests/m0/knowledge-ui.test.tsx`

- [x] Write failing pure and markup tests for tag/asset focus, core/related edges, weighted tag co-occurrence wording, deterministic node order/positions, 12-node cap, full inspector list, Material-only-through-source, and exclusion of object-memory relations.
- [x] Run the new test and confirm RED.
- [x] Load typed semantic relations, asset summaries, and Material summaries only on `/knowledge`.
- [x] Build a deterministic local neighborhood with left search, central radial SVG/HTML graph, and right inspector. Recenter on tag click and inspect asset click.
- [x] Persist only `?focus=` in the URL; do not persist coordinates, edges, selections, or a graph document.
- [x] Provide “打开内容” and asset-backed “问老师”; never offer “带着标签问老师”.
- [x] Replace old static method-tree UI without deleting the legacy server API.
- [x] Run focused tests, updated knowledge tests, and typecheck.
- [x] Commit: `feat: add local semantic relation view`

## Task 7: Polish the real course overview and three-paper workspace

**Files:**

- Create: `apps/pi-teaching-web/tests/m1d/course-workspace-ui.test.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/CourseOverviewPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/CoursePage.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/CourseTree.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/WorkspaceBreadcrumbs.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles/course.css`
- Modify: `apps/pi-teaching-web/src/client/styles/classroom.css`
- Modify: `apps/pi-teaching-web/src/client/styles/responsive.css`

- [x] Write failing tests for exact Plan-owned Lesson trees, Roadmap/Plan/Lesson right-rail names, active/current state, read-only closed Lesson, lifecycle action preservation, and no ability/Trace projection.
- [x] Run the new test and confirm RED.
- [x] Apply the three-paper layout and approved labels: 长期路线、阶段安排、本课提纲.
- [x] Keep the course overview bound to real Roadmap/Plan/Lesson data and the existing `resolveContinueTarget`; do not create placeholder Plans or inferred progress.
- [x] Preserve Runtime-owned lifecycle calls, existing breadcrumbs, classroom visibility gates, and inline Material/Reviewer/Handout activity.
- [x] Verify 1440×900 and 1280×800 layouts have no horizontal overflow; responsive CSS below that is best-effort only.
- [x] Run focused tests plus existing course overview/UI/navigation tests.
- [x] Commit: `feat: polish m1d course workspace`

## Task 8: Add deterministic browser acceptance and complete release verification

**Files:**

- Create: `apps/pi-teaching-web/tests/e2e/m1d-ui.spec.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/fixture-server.ts` only if deterministic M1d fixtures need an existing extension point
- Create: `apps/pi-teaching-web/tests/validation/m1d-real-model-smoke.md`
- Modify: `apps/pi-teaching-web/package.json` only if a named M1d command is useful

- [x] Add a fixture-driven Playwright pass for blank Home, active-Lesson Home, free conversation/formula, selected assets, Note, problem before/after/reveal, Material success/failure, footprint, local graph, and three-paper course workspace.
- [x] Capture critical-route screenshots at 1440×900 and spot-check 1280×800; assertions target content, hierarchy, state, formula rendering, and overflow rather than pixels.
- [x] Run `bunx playwright test tests/e2e/m1d-ui.spec.ts` and repair only observed failures.
- [x] Start the actual local app with the existing clean-runtime command and run one real-model smoke covering streaming, one long-wait status, KaTeX, and safe receipts. Record model/provider, prompts, visible timestamps, and result without exporting private CoT.
- [x] Run `bun run check` from `apps/pi-teaching-web`.
- [x] Run the existing M0, M1b, and M1c Playwright cycles.
- [x] Run `git diff --check`, inspect `git status --short`, and review the full diff for mock data, new persistent schemas, raw tool output, and accidental memory exposure.
- [x] Update the M1d spec status with the actual verification evidence and remaining non-blocking limitations.
- [x] Commit: `test: validate m1d student interface`

## Final release checklist

- [x] No new canonical store, Agent tool, graph write path, or frontend lifecycle machine exists.
- [x] Home never guesses a course position and presents exactly one strongest action.
- [x] Formation, pinned source, semantic relation, learning event, and cognition remain distinct facts.
- [x] Generic tool JSON and internal memory structures are absent from the normal student UI.
- [x] Formula rendering still uses the production `MarkdownView` / KaTeX path.
- [x] All focused tests, `bun run check`, deterministic Playwright, and the real-model smoke have fresh passing evidence.
