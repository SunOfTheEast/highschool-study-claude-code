# StudyForge Packaged Runtime Dependencies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the compiled macOS Runtime retain Plan Scout, PDF extraction, and Amazon Bedrock without shipping the whole dependency tree.

**Architecture:** Replace runtime package resolution with static, narrowly scoped module edges. A compiled-runtime self-test exercises the same sidecar artifact that ships in the DMG.

**Tech Stack:** Bun 1.3 compile, TypeScript, Pi 0.81, PDF.js 5.4, Tauri 2.

## Global Constraints

- Preserve unrelated dirty-worktree changes.
- Use one focused regression per missing runtime seam.
- Do not add a generic dependency crawler or copy all of `node_modules`.
- Keep PDF native setup lazy and Plan subagent access Plan-only.

---

### Task 1: Pin the three runtime seams

**Files:**
- Create: `apps/pi-teaching-web/src/runtime/bun-runtime.ts`
- Create: `apps/pi-teaching-web/src/study/pdf-runtime.ts`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/src/study/materials.ts`
- Modify: `apps/pi-teaching-web/src/server/index.ts`
- Modify: `apps/pi-teaching-web/src/desktop/pi-cli.ts`
- Modify: `apps/pi-teaching-web/package.json`
- Modify: `apps/pi-teaching-web/bun.lock`
- Test: `apps/pi-teaching-web/tests/desktop/runtime-dependencies.test.ts`

**Interfaces:**
- Produces: `registerStudyForgeBunRuntime(): { bedrock: 'registered' }`
- Produces: `loadPdfJs(): Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')>`
- Changes: Plan ResourceLoader receives `pi-subagents` as an inline extension factory.

- [ ] **Step 1: Write the failing tests**

  Assert that the shared Bun registration reports Bedrock, PDF setup supplies the required globals and worker, and `resource-loader.ts` no longer depends on `import.meta.resolve('pi-subagents')` while a Plan loader still exposes `subagent`.

- [ ] **Step 2: Verify RED**

  Run: `bun test tests/desktop/runtime-dependencies.test.ts`

  Expected: FAIL because the two runtime modules do not exist and Plan still uses runtime package resolution.

- [ ] **Step 3: Implement the minimal static edges**

  Use Pi AI's public Bedrock provider/compat exports, statically import the `pi-subagents` factory, and make PDF.js initialization lazy behind `loadPdfJs()`.

- [ ] **Step 4: Verify GREEN**

  Run: `bun test tests/desktop/runtime-dependencies.test.ts tests/m0/native-session.test.ts tests/m1c/materials.test.ts`

  Expected: all selected tests pass.

### Task 2: Make the compiled sidecar prove the contract

**Files:**
- Create: `apps/pi-teaching-web/src/server/runtime-self-test.ts`
- Modify: `apps/pi-teaching-web/src/server/index.ts`
- Modify: `apps/pi-teaching-web/scripts/desktop/smoke-sidecars.ts`
- Modify: `apps/pi-teaching-web/docs/desktop-release-checklist.md`
- Test: `apps/pi-teaching-web/tests/desktop/runtime-dependencies.test.ts`

**Interfaces:**
- Produces: `runRuntimeSelfTest(resourceRoot: string): Promise<RuntimeSelfTestReceipt>`.
- Adds internal CLI: `studyforge-runtime --runtime-self-test --resource-root <absolute-path>`.

- [ ] **Step 1: Add a failing compiled-runtime smoke expectation**

  Extend `desktop:smoke` to invoke the internal self-test and require receipts for `planSubagent`, `pdfText`, and `bedrock`.

- [ ] **Step 2: Verify RED against the current compiled Runtime**

  Run: `bun run desktop:prepare && bun run desktop:smoke`

  Expected: FAIL before the self-test path/static seams exist.

- [ ] **Step 3: Implement the self-test with a temporary learning set and one-page PDF**

  The self-test must load a real Plan ResourceLoader, call real `importMaterial`, and check the shared provider registration without a network request.

- [ ] **Step 4: Verify compiled sidecars**

  Run: `bun run desktop:prepare && bun run desktop:smoke`

  Expected: JSON reports Runtime, Pi, OAuth bootstrap, Plan subagent, PDF text, and Bedrock passed.

### Task 3: Rebuild and verify the shipping artifact

**Files:**
- Modify only if a release check reveals a packaging-specific defect.

- [ ] **Step 1: Run repository checks**

  Run: `bun run check`

  Expected: typecheck, non-E2E tests, and Vite build pass.

- [ ] **Step 2: Build and inspect the DMG**

  Run: `bun run desktop:prepare && bun run desktop:build && bun run desktop:verify`

  Expected: arm64 DMG, both sidecars, resources, and ad-hoc signature verify.

- [ ] **Step 3: Run the original black-box paths from the mounted DMG**

  Confirm a Plan opens with Scout available, a PDF imports as searchable text, and provider configuration can load Bedrock without `ResolveMessage`.
