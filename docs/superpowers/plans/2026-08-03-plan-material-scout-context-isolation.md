# Plan Material Scout Context Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move exploratory learning-asset search out of the long-lived Plan Session into one temporary read-only Material Scout while keeping final teaching judgment and Lesson writing in the parent Coach.

**Architecture:** Pin and explicitly load `pi-subagents` only for Plan-node resources. A packaged `study-material-scout` receives a fresh foreground task, reads static learning assets with native read-only tools, and returns at most three compact candidates; the parent Coach then reads only its chosen asset and continues the existing Markdown write cycle. Roadmap, Lesson, post-class review, persistence, and frontend routes remain unchanged.

**Tech Stack:** Bun 1.3.14, TypeScript 7, Pi 0.81, `pi-subagents` 0.35.1, native Pi file tools, Markdown Skills and agents.

## Global Constraints

- Preserve the single Markdown tree `ROADMAP.md → Plan → Lesson → Block Classroom Logs`.
- Do not add a memory pool, Handoff, workflow store, task graph, background monitor, index, vector store, database, API route, or frontend page.
- Expose `subagent` only to Plan Sessions; Roadmap and Lesson keep the six native file tools.
- The Scout has only `read`, `grep`, `find`, and `ls`; it never writes learning-set files or launches nested agents.
- Parent execution is foreground, fresh-context, non-progress-payload, and bounded to 180 seconds.
- The parent Coach owns final selection, full selected-asset verification, Lesson writing, Plan updates, and student-facing language.
- Post-Lesson review remains a direct parent read of the closed Lesson.
- Do not add exact-wording tests for Skill prose. Verify mechanical resource contracts and a real-model class-preparation run.
- Preserve all unrelated existing working-tree modifications.

---

### Task 1: Define the Plan-only runtime tool boundary

**Files:**
- Modify: `apps/pi-teaching-web/tests/m0/public-surface.test.ts`
- Create: `apps/pi-teaching-web/tests/m0/subagent-path.test.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Create: `apps/pi-teaching-web/src/runtime/subagent-path.ts`

**Interfaces:**
- Produces: `PLAN_MODEL_TOOLS`, `modelToolsForNode(kind)`, `studySubagentDirectory`, and `configureStudySubagentDirectory()`.
- Consumed by: Task 2 resource assembly and Session creation.

- [ ] **Step 1: Add failing node-specific tool tests**

Update `public-surface.test.ts` to assert the stable base list separately from the
node-specific list:

```ts
import {
  M0_MODEL_TOOLS,
  modelToolsForNode,
  sessionKeyForNode,
} from '../../src/runtime/session-scope';

expect(M0_MODEL_TOOLS).toEqual(['read', 'grep', 'find', 'ls', 'edit', 'write']);
expect(modelToolsForNode('roadmap')).toEqual(M0_MODEL_TOOLS);
expect(modelToolsForNode('lesson')).toEqual(M0_MODEL_TOOLS);
expect(modelToolsForNode('plan')).toEqual([...M0_MODEL_TOOLS, 'subagent']);
```

- [ ] **Step 2: Add the failing packaged-directory test**

Create `tests/m0/subagent-path.test.ts`:

```ts
import { afterEach, expect, test } from 'bun:test';
import { delimiter } from 'node:path';
import {
  configureStudySubagentDirectory,
  studySubagentDirectory,
} from '../../src/runtime/subagent-path';

const original = process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS;

afterEach(() => {
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = original;
});

test('appends the packaged Scout directory without replacing existing directories', () => {
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = '/tmp/existing-subagents';
  configureStudySubagentDirectory();
  expect(process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS?.split(delimiter)).toEqual([
    '/tmp/existing-subagents',
    studySubagentDirectory,
  ]);
});

test('does not duplicate the packaged Scout directory', () => {
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = studySubagentDirectory;
  configureStudySubagentDirectory();
  expect(process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS).toBe(studySubagentDirectory);
});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/public-surface.test.ts tests/m0/subagent-path.test.ts
```

Expected: failure because `modelToolsForNode` and `subagent-path.ts` do not exist and
Plan resources still expose only the base tools.

- [ ] **Step 4: Implement the minimal tool and directory helpers**

Add to `session-scope.ts`:

```ts
export const PLAN_MODEL_TOOLS = [...M0_MODEL_TOOLS, 'subagent'] as const;

export function modelToolsForNode(kind: NodeKind): readonly string[] {
  return kind === 'plan' ? PLAN_MODEL_TOOLS : M0_MODEL_TOOLS;
}
```

Create `src/runtime/subagent-path.ts`:

```ts
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const studySubagentDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../resources/subagents',
);

export function configureStudySubagentDirectory(): void {
  const paths = [
    ...(process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS?.split(delimiter) ?? []),
    studySubagentDirectory,
  ].map((path) => path.trim()).filter(Boolean);
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = [...new Set(paths)].join(delimiter);
}
```

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run the Step 3 command.

Expected: both focused test files pass.

- [ ] **Step 6: Commit the node-specific boundary**

```bash
git add apps/pi-teaching-web/src/runtime/session-scope.ts \
  apps/pi-teaching-web/src/runtime/subagent-path.ts \
  apps/pi-teaching-web/tests/m0/public-surface.test.ts \
  apps/pi-teaching-web/tests/m0/subagent-path.test.ts
git commit -m "feat: define plan material scout boundary"
```

---

### Task 2: Load `pi-subagents` only for Plan Sessions

**Files:**
- Modify: `apps/pi-teaching-web/package.json`
- Modify: `apps/pi-teaching-web/bun.lock`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`

**Interfaces:**
- Consumes: `modelToolsForNode()` and `configureStudySubagentDirectory()` from Task 1.
- Produces: Plan resource loaders with one explicit `pi-subagents` extension and an active `subagent` tool.

- [ ] **Step 1: Strengthen the failing resource assembly test**

In `native-session.test.ts`, assert:

```ts
expect(loadStaticNodeResources(root, planScope).tools)
  .toEqual(['read', 'grep', 'find', 'ls', 'edit', 'write', 'subagent']);
expect(loadStaticNodeResources(root, roadmapScope).tools)
  .toEqual(['read', 'grep', 'find', 'ls', 'edit', 'write']);
expect(loadStaticNodeResources(root, lessonScope).tools)
  .toEqual(['read', 'grep', 'find', 'ls', 'edit', 'write']);
```

Create real loaders for Plan and Lesson, then inspect the loaded extension tools:

```ts
const planLoader = await createRoleResourceLoader(root, planScope, createEventBus());
const lessonLoader = await createRoleResourceLoader(root, lessonScope, createEventBus());
expect(planLoader.getExtensions().extensions.flatMap((extension) => (
  Array.from(extension.tools.keys())
))).toContain('subagent');
expect(lessonLoader.getExtensions().extensions.flatMap((extension) => (
  Array.from(extension.tools.keys())
))).not.toContain('subagent');
```

- [ ] **Step 2: Run the loader test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts
```

Expected: Plan has no `subagent` tool and no explicitly loaded extension.

- [ ] **Step 3: Pin the extension dependency**

From `apps/pi-teaching-web` run:

```bash
bun add --exact pi-subagents@0.35.1
```

Expected: `package.json` contains `"pi-subagents": "0.35.1"` and `bun.lock` updates.

- [ ] **Step 4: Make resource assembly node-specific**

In `resource-loader.ts`:

```ts
import { fileURLToPath } from 'node:url';
import {
  modelToolsForNode,
  formatSessionOwnerContext,
  type NodeSessionScope,
} from './session-scope';

// loadStaticNodeResources
tools: modelToolsForNode(scope.nodeKind),

// createRoleResourceLoader options
additionalExtensionPaths: scope.nodeKind === 'plan'
  ? [fileURLToPath(import.meta.resolve('pi-subagents'))]
  : [],
noExtensions: true,
```

Keeping `noExtensions: true` suppresses automatically discovered user/project
extensions while Pi still loads the explicitly supplied additional path.

- [ ] **Step 5: Activate the node-specific list in Session creation**

In `session-factory.ts`, call `configureStudySubagentDirectory()` once before Session
creation and pass the scoped tool list:

```ts
import { modelToolsForNode, type NodeSessionScope } from './session-scope';
import { configureStudySubagentDirectory } from './subagent-path';

export async function createPiSessionFactory(root: string): Promise<StudySessionFactory> {
  configureStudySubagentDirectory();
  const modelRuntime = await ModelRuntime.create();
  return async ({ sessionFile, ...scope }) => {
    // ...
    const { session } = await createAgentSession({
      // ...
      tools: [...modelToolsForNode(scope.nodeKind)],
    });
```

- [ ] **Step 6: Run the focused runtime tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/public-surface.test.ts tests/m0/native-session.test.ts tests/m0/subagent-path.test.ts
```

Expected: all tests pass and only Plan exposes `subagent`.

- [ ] **Step 7: Commit the explicit Plan extension path**

```bash
git add apps/pi-teaching-web/package.json apps/pi-teaching-web/bun.lock \
  apps/pi-teaching-web/src/runtime/resource-loader.ts \
  apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/tests/m0/native-session.test.ts
git commit -m "feat: load material scout for plan sessions"
```

---

### Task 3: Package the read-only Material Scout and teach Coach when to use it

**Files:**
- Create: `apps/pi-teaching-web/resources/subagents/study-material-scout.md`
- Modify: `apps/pi-teaching-web/resources/agents/plan-node.md`
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `AGENTS.md`
- Test: `apps/pi-teaching-web/tests/m0/native-session.test.ts`

**Interfaces:**
- Consumes: the Plan-only `subagent` runtime from Task 2.
- Produces: one fresh read-only Scout and a parent decision rule that prevents inline bulk asset search.

- [ ] **Step 1: Add the failing mechanical Scout contract test**

In `native-session.test.ts`, read the packaged agent frontmatter and assert mechanical
permissions only:

```ts
const scout = readFileSync(
  join(import.meta.dir, '../../resources/subagents/study-material-scout.md'),
  'utf8',
);
expect(scout).toContain('name: study-material-scout');
expect(scout).toContain('tools: read, grep, find, ls');
for (const forbidden of ['write', 'edit', 'bash', 'subagent']) {
  expect(scout.match(/^tools:.*$/m)?.[0]).not.toContain(forbidden);
}
```

This is a capability test, not an exact-wording test for teaching prose.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts
```

Expected: the packaged Scout file does not exist.

- [ ] **Step 3: Create the minimal Scout agent**

Create `resources/subagents/study-material-scout.md`:

```md
---
name: study-material-scout
description: Read-only learning-asset recall for one Plan Coach
tools: read, grep, find, ls
thinking: medium
systemPromptMode: replace
inheritProjectContext: false
inheritSkills: false
completionGuard: false
---

You are a temporary read-only material scout. Follow the parent task's Plan path,
closed Lesson paths, public purpose, asset kind, constraints, avoid-list, and student
preferences. Search only cards/, graph/, materials/, and the teaching documents named
in the task. Compare real files; never invent a path, source, title, method, or answer.

Return exactly one JSON object with `candidates` and `search_boundary`. Return at most
three candidates. Each candidate has `asset_path`, `asset_kind`, `source`, `fit`,
`novelty`, and `risks`. Keep every value concise. Do not reproduce full stems,
solutions, decisive transformations, answers, rejected-card contents, chain-of-thought,
or a search transcript. If nothing qualifies, return an empty `candidates` array and a
brief factual `search_boundary`.

You only recall and compare material. Do not decide student capability, teaching
sequence, Lesson structure, hint policy, Plan completion, or any persistent fact.
```

- [ ] **Step 4: Replace inline bulk search with the Scout decision rule**

Edit the existing material-selection sections without removing unrelated current
guidance. State positively:

```text
Exact known asset → parent reads it directly.
Exploratory search or comparison → one foreground study-material-scout run.
Scout call → context=fresh, async=false, includeProgress=false,
maxRuntimeMs=180000, artifacts=false, agentScope=user.
Parent receives ≤3 candidates → selects → reads only selected full asset.
No suitable result → at most one corrected Scout retry; never inline bulk fallback.
```

Keep the existing whole-turn no-spoiler boundary and direct closed-Lesson review.

- [ ] **Step 5: Update the repository contract**

In `AGENTS.md`, replace the statement that every node has exactly six tools with the
base-plus-Plan exception. Document that the Scout is disposable working memory, not a
teaching fact store or Handoff.

- [ ] **Step 6: Run assembled-resource tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts tests/m0/public-surface.test.ts
```

Expected: all mechanical capability and resource assembly tests pass.

- [ ] **Step 7: Commit the Scout and Coach behavior**

Because `plan-node.md` and `coach-study/SKILL.md` already contain preserved working-tree
edits, inspect the staged patch and stage only the Material Scout additions plus the
new files and repository contract:

```bash
git add -p apps/pi-teaching-web/resources/agents/plan-node.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md
git add apps/pi-teaching-web/resources/subagents/study-material-scout.md AGENTS.md
git diff --cached --check
git diff --cached
git commit -m "feat: delegate plan material recall"
```

---

### Task 4: Verify the complete runtime and run one real-model preparation

**Files:**
- Create: `docs/audits/2026-08-03-plan-material-scout-acceptance.md`

**Interfaces:**
- Consumes: the complete Plan-only Scout path.
- Produces: executable verification evidence and a comparison with the seven-minute inline baseline.

- [ ] **Step 1: Run the full deterministic verification**

Run:

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

Expected: typecheck, unit tests, production build, and deterministic browser cycle all
exit 0.

- [ ] **Step 2: Install the current repository resources into an isolated runtime copy**

Copy `examples/derivative-m0/learning-set` and a temporary Pi agent directory. Start
the app against that copy with the configured real model. Do not mutate the public
example during acceptance.

- [ ] **Step 3: Run one real Plan preparation that requires semantic card comparison**

Ask the Coach to prepare one diagnostic Lesson with constraints that require comparing
multiple assets. Record the raw parent Session tool sequence and wall time.

Expected parent sequence:

```text
read Plan and closed Lessons
→ subagent(study-material-scout, context=fresh)
→ read one selected asset
→ write Lesson
→ read Lesson
→ edit Plan
→ read Plan
→ public summary
```

- [ ] **Step 4: Audit isolation and teaching behavior**

Verify:

- parent Session performs no exploratory `ls`/`grep`/`find` across assets;
- parent Session does not open rejected candidate cards;
- Scout changes no learning-set file;
- result has at most three real paths with concise fit/novelty/risk fields;
- student-visible output contains no stem, derivative, decisive route, expected trap,
  answer, or file-operation narration;
- Lesson and Plan obey the canonical Markdown contract;
- wall time and parent context growth are recorded honestly.

- [ ] **Step 5: Write the acceptance report**

Create `docs/audits/2026-08-03-plan-material-scout-acceptance.md` with environment,
prompt, tool timeline, selected asset, rejected-parent-read count, file checksum result,
student-visible message, timing/context comparison, passed checks, and remaining
limitations.

- [ ] **Step 6: Run final verification and inspect the diff**

Run:

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
cd ../..
git diff --check
git status --short
```

Expected: commands exit 0; only intended files plus pre-existing unrelated working-tree
changes appear.

- [ ] **Step 7: Commit the acceptance evidence**

```bash
git add docs/audits/2026-08-03-plan-material-scout-acceptance.md
git commit -m "docs: record material scout acceptance"
```
