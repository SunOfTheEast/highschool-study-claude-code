# Markdown-First Highschool Study Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `highschool-study-markdown/` from scratch as a local Claude Code learning plugin whose only durable state is a human-readable Markdown learning set, with native directory recall, bidirectional card/Trace search, append-only Trace, and student-confirmed long-term-preference consolidation at Plan boundaries.

**Architecture:** Claude Code Agents, Skills, Tasks, `Read`, `Glob`, `Grep`, and optional Dynamic Workflow own conversation and recall. A small Bun/TypeScript MCP publishes only `card_search`, `trace_search`, `trace_append`, and `source_resolve`. Trace owns the canonical card relation; card-to-Trace lookup is a request-local projection. Two compact profile files hold current confirmed preferences and change only through a student-approved delta after a Plan is complete.

**Tech Stack:** Claude Code plugin manifests, Markdown with YAML frontmatter, Bun 1.3.14, TypeScript 7.0.2, MCP SDK 1.29.0, Zod 4.4.3, YAML 2.9.0, `bun:test`.

## Global Constraints

- Create only the sibling `highschool-study-markdown/` directory. Do not modify frozen `highschool-study/`.
- The user-facing plugin name remains `highschool-study`; never load old and new plugin directories together.
- `learning-set/` is the only mutable study-state boundary.
- The public MCP surface is exactly `card_search`, `trace_search`, `trace_append`, and `source_resolve`. Do not implement `study_context_get`.
- `recall-study-memory` uses native directory tools for structure, summaries, and profiles; there is no universal ContextView service.
- Roadmap, Plan, Lesson, Trace, and memory are Markdown. Existing card and graph assets may remain YAML.
- Plan/Lesson frontmatter `id` equals the file stem.
- Trace is the only owner of `cardPath` and optional `cardStepId`. Card files contain no Trace backlinks.
- Every `card_search` candidate includes its complete active `traceHistory` or `[]`. Limit card candidates, not one card's history.
- `trace_search` returns active Trace entries and deduplicated `cardsByPath`; cardless Trace remains searchable.
- Corrections append a new `Supersedes` Trace. Superseded events are absent from search, projections, and consolidation.
- Every confirmed preference, including an explicit student declaration, links directly to an original Lesson block, Trace entry, card, or material.
- `student-profile.md` and `teaching-profile.md` contain only current, student-confirmed preferences, with one owner per preference.
- `consolidate-plan-memory` shows an add/revise/delete delta and may edit profiles only after explicit student confirmation.
- `planner-attention.md` is a rebuildable preparation projection, not long-term memory.
- Lesson closure, capability attainment, and Task completion remain separate.
- Method weights are primary `2` and secondary `1`; assessment factors are `correct=1`, `partially_correct=0.5`, `incorrect=0`, `incomplete=0`; support factors are `none=1`, `tutor=0.5`, `external=0.75`. This is uncalibrated preparation evidence, not a BKT claim.
- Dynamic Workflow starts only when direct evidence is insufficient and at least two independent searches are worth parallelizing. Raw JSON stays in the Claude session.
- Add no SQLite, migration, vector database, persistent reverse index, background service, compatibility reader, or automatic Git commit.

## File Responsibility Map

| Responsibility | Files |
| --- | --- |
| Plugin shell | `.claude-plugin/plugin.json`, `.mcp.json`, `package.json`, `tsconfig.json` |
| Roles and workflows | `agents/*.md`, `skills/*/SKILL.md` |
| Learning-set template | `learning-set-template/**` |
| Source assets | `subject-packs/highschool-math/**` |
| File/source reading | `server/src/learning-set.ts`, `markdown.ts`, `sources.ts` |
| Trace facts | `server/src/traces.ts` |
| Bidirectional search | `server/src/cards.ts`, `trace-search.ts`, `trace-index.ts` |
| Preparation projection | `server/src/method-signals.ts`, `scripts/rebuild-planner-attention.ts` |
| MCP adapter | `server/src/mcp/create-server.ts`, `register-tools.ts`, `index.ts` |
| Verification | `tests/contract/**`, `tests/unit/**`, `tests/integration/**`, `tests/e2e/**` |

---

### Task 1: Scaffold the Plugin and Human-Readable Learning-Set Template

**Files:**
- Create: `highschool-study-markdown/package.json`
- Create: `highschool-study-markdown/tsconfig.json`
- Create: `highschool-study-markdown/.claude-plugin/plugin.json`
- Create: `highschool-study-markdown/.mcp.json`
- Create: `highschool-study-markdown/learning-set-template/ROADMAP.md`
- Create: `highschool-study-markdown/learning-set-template/memory/student-profile.md`
- Create: `highschool-study-markdown/learning-set-template/memory/teaching-profile.md`
- Create: `highschool-study-markdown/learning-set-template/memory/planner-attention.md`
- Create placeholders under `plans/`, `lessons/`, `cards/`, `graph/`, and `materials/`
- Copy the four approved conics card/graph YAML assets into `subject-packs/highschool-math/`
- Test: `highschool-study-markdown/tests/contract/package-and-template.test.ts`

**Interfaces:**
- Produces the `highschool-study-markdown` Bun package and `highschool-study` Claude plugin.
- Produces a copyable learning set with two empty confirmed-profile files and one explicitly rebuildable attention file.

- [ ] **Step 1: Write the failing package/template contract**

```ts
import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '../..');

test('ships the minimal Markdown template', () => {
  for (const path of [
    '.claude-plugin/plugin.json',
    '.mcp.json',
    'learning-set-template/ROADMAP.md',
    'learning-set-template/memory/student-profile.md',
    'learning-set-template/memory/teaching-profile.md',
    'learning-set-template/memory/planner-attention.md',
  ]) expect(existsSync(join(root, path))).toBe(true);
  const student = readFileSync(
    join(root, 'learning-set-template/memory/student-profile.md'), 'utf8',
  );
  expect(student).toContain('Only student-confirmed current preferences');
  expect(student).not.toContain('[student-stated]');
});
```

- [ ] **Step 2: Run the test and verify the missing-file failure**

Run: `cd highschool-study-markdown && bun test tests/contract/package-and-template.test.ts`
Expected: FAIL, first missing path is `.claude-plugin/plugin.json`.

- [ ] **Step 3: Create exact package and memory templates**

`package.json` pins Bun 1.3.14, TypeScript 7.0.2, MCP SDK 1.29.0, Zod 4.4.3, and YAML 2.9.0. It exposes `test`, `typecheck`, `check`, `start:mcp`, `rebuild:attention`, `validate:plugin`, and `release:check`.

Both profiles use `kind: confirmed-preferences` and an empty `## Active Preferences` section. Their prose states that every item is current, student-confirmed, and directly source-linked. `planner-attention.md` states: “This file is a rebuildable preparation projection, not long-term memory.” `ROADMAP.md` contains `Goal`, `Observable Capability Standard`, `Plan Graph`, and `Change Log`.

Create the final MCP launch configuration in Task 1:

```json
{
  "mcpServers": {
    "study-markdown": {
      "command": "bun",
      "args": ["run", "${CLAUDE_PLUGIN_ROOT}/server/src/index.ts"],
      "env": {
        "STUDY_LEARNING_SET": "${CLAUDE_PROJECT_DIR}/learning-set"
      }
    }
  }
}
```

- [ ] **Step 4: Install and verify the scaffold**

Run: `cd highschool-study-markdown && bun install && bun test tests/contract/package-and-template.test.ts && bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add highschool-study-markdown
git commit -m "feat: scaffold markdown study plugin"
```

---

### Task 2: Implement Learning-Set, Markdown, and Source Resolution

**Files:**
- Create: `highschool-study-markdown/server/src/errors.ts`
- Create: `highschool-study-markdown/server/src/learning-set.ts`
- Create: `highschool-study-markdown/server/src/markdown.ts`
- Create: `highschool-study-markdown/server/src/sources.ts`
- Create: `highschool-study-markdown/tests/helpers/learning-set.ts`
- Test: `highschool-study-markdown/tests/unit/learning-set.test.ts`
- Test: `highschool-study-markdown/tests/integration/source-resolve.test.ts`

**Interfaces:**
- Produces `resolveInsideRoot(root, relativePath)`, `readMarkdownFile(root, path)`, and `sourceResolve(root, input)`.
- Resolves Markdown headings and real YAML `#step=<id>` fragments.
- Produces `makeLearningSet()`, which copies the template into a temporary directory and seeds one real Lesson/card source.

- [ ] **Step 1: Write failing containment and source tests**

```ts
import { expect, test } from 'bun:test';
import { makeLearningSet } from '../helpers/learning-set';
import { resolveInsideRoot } from '../../server/src/learning-set';
import { sourceResolve } from '../../server/src/sources';

test('keeps every source inside the learning set', () => {
  const root = makeLearningSet();
  expect(() => resolveInsideRoot(root, '../outside.md')).toThrow(/OUTSIDE_LEARNING_SET/);
  expect(sourceResolve(root, {
    fromPath: 'lessons/lesson-001.md',
    target: '../cards/conics/freeze-variable-01.yaml#step=identify-freeze',
  }).valid).toBe(true);
  expect(sourceResolve(root, {
    fromPath: 'lessons/lesson-001.md',
    target: '../cards/conics/freeze-variable-01.yaml#step=missing',
  }).valid).toBe(false);
});
```

- [ ] **Step 2: Run tests and verify missing modules**

Run: `cd highschool-study-markdown && bun test tests/unit/learning-set.test.ts tests/integration/source-resolve.test.ts`
Expected: FAIL with missing `server/src/learning-set`.

- [ ] **Step 3: Implement the exact contracts**

```ts
export type MarkdownDocument = {
  path: string;
  id: string;
  frontmatter: Record<string, unknown>;
  body: string;
  headings: Map<string, string>;
};
export type SourceResolution = {
  valid: boolean;
  path: string | null;
  fragment: string | null;
  excerpt: string | null;
  error: 'OUTSIDE_LEARNING_SET' | 'MISSING_FILE' | 'MISSING_FRAGMENT' | null;
};
export function resolveInsideRoot(root: string, relativePath: string): string;
export function readMarkdownFile(root: string, relativePath: string): MarkdownDocument;
export function sourceResolve(
  root: string,
  input: { fromPath: string; target: string },
): SourceResolution;
```

Use realpath containment. Reject Plan/Lesson IDs that differ from the file stem. Resolve GitHub-style Markdown heading anchors and only stable step IDs present in the YAML card.

- [ ] **Step 4: Verify and commit**

Run: `cd highschool-study-markdown && bun test tests/unit/learning-set.test.ts tests/integration/source-resolve.test.ts && bun run typecheck`
Expected: PASS.

```bash
git add highschool-study-markdown/server/src highschool-study-markdown/tests
git commit -m "feat: resolve markdown study sources"
```

---

### Task 3: Implement Active Trace Reading and Append-Only Writes

**Files:**
- Create: `highschool-study-markdown/server/src/traces.ts`
- Modify: `highschool-study-markdown/tests/helpers/learning-set.ts`
- Test: `highschool-study-markdown/tests/integration/trace-records.test.ts`

**Interfaces:**
- Produces `readTraceRecords`, `readActiveTraces`, and `appendTrace`.
- Resolves the model-supplied card alias through the Lesson and persists canonical `cardPath`.
- Adds `makeLearningSetWithLesson()` with `step-01`, `step-02`, and a real `Q-FREEZE-01` alias.

- [ ] **Step 1: Write the failing Trace tests**

```ts
import { expect, test } from 'bun:test';
import { makeLearningSetWithLesson } from '../helpers/learning-set';
import { appendTrace, readActiveTraces } from '../../server/src/traces';

test('stores canonical card bindings and closes supersession', () => {
  const root = makeLearningSetWithLesson();
  appendTrace(root, {
    lessonPath: 'lessons/lesson-001.md',
    blockId: 'step-02',
    cardAlias: 'Q-FREEZE-01',
    cardStepId: 'identify-freeze',
    materialPath: null,
    assessment: 'partially_correct',
    support: 'tutor',
    note: 'Selected the frozen quantity but missed the domain.',
    supersedes: null,
  }, () => new Date('2026-07-21T02:00:00Z'));
  expect(readActiveTraces(root)[0]).toMatchObject({
    eventId: 'event-001',
    cardPath: 'cards/conics/freeze-variable-01.yaml',
    cardStepId: 'identify-freeze',
  });
});
```

- [ ] **Step 2: Run and verify the missing module**

Run: `cd highschool-study-markdown && bun test tests/integration/trace-records.test.ts`
Expected: FAIL with missing `server/src/traces`.

- [ ] **Step 3: Implement the Trace contract**

```ts
export type TraceAssessment = 'correct' | 'partially_correct' | 'incorrect' | 'incomplete';
export type TraceSupport = 'none' | 'tutor' | 'external';
export type TraceRecord = {
  eventId: string;
  lessonPath: string;
  lessonId: string;
  planId: string;
  blockId: string;
  cardPath: string | null;
  cardStepId: string | null;
  materialPath: string | null;
  assessment: TraceAssessment;
  support: TraceSupport;
  note: string;
  supersedes: string | null;
  sourceAnchor: string;
  recordedAt: string;
};
export type TraceAppendInput = Omit<
  TraceRecord,
  'eventId' | 'lessonId' | 'planId' | 'cardPath' | 'sourceAnchor' | 'recordedAt'
> & { cardAlias: string | null };
export function readTraceRecords(root: string, lessonPaths?: string[]): TraceRecord[];
export function readActiveTraces(root: string, lessonPaths?: string[]): TraceRecord[];
export function appendTrace(
  root: string,
  input: TraceAppendInput,
  now: () => Date,
): { eventId: string; lessonPath: string; sourceAnchor: string };
```

Validate Lesson, block, alias, card, optional card step, and same-Lesson supersession before one `appendFileSync`. Allocate the next padded event number. Cardless Trace is valid.

- [ ] **Step 4: Verify and commit**

Run: `cd highschool-study-markdown && bun test tests/integration/trace-records.test.ts && bun run typecheck`
Expected: PASS.

```bash
git add highschool-study-markdown/server/src/traces.ts highschool-study-markdown/tests
git commit -m "feat: append canonical lesson traces"
```

---

### Task 4: Implement Bidirectional Card/Trace Search

**Files:**
- Create: `highschool-study-markdown/server/src/trace-index.ts`
- Create: `highschool-study-markdown/server/src/cards.ts`
- Create: `highschool-study-markdown/server/src/trace-search.ts`
- Modify: `highschool-study-markdown/tests/helpers/learning-set.ts`
- Test: `highschool-study-markdown/tests/integration/bidirectional-search.test.ts`

**Interfaces:**
- Produces `buildTraceIndex`, `searchCards`, and `searchTraces`.
- Every card hit contains complete active history; Trace hits carry a deduplicated card map.
- Adds `makeLearningSetWithHistory()` with two candidate cards, two active events on one card, one superseded event, and one text-matchable cardless event.

- [ ] **Step 1: Write the failing bidirectional tests**

```ts
import { expect, test } from 'bun:test';
import { makeLearningSetWithHistory } from '../helpers/learning-set';
import { searchCards } from '../../server/src/cards';
import { searchTraces } from '../../server/src/trace-search';

test('joins cards and active Trace in both directions', () => {
  const root = makeLearningSetWithHistory();
  const cards = searchCards(root, { query: 'freeze variable', limit: 3 }).cards;
  expect(cards[0]?.traceHistory.map((trace) => trace.eventId)).toEqual([
    'event-001',
    'event-003',
  ]);
  expect(cards[1]?.traceHistory).toEqual([]);
  const traces = searchTraces(root, {
    query: 'domain',
    planId: 'max-value',
    lessonId: null,
    cardPath: null,
    limit: 20,
  });
  expect(Object.keys(traces.cardsByPath)).toEqual([
    'cards/conics/freeze-variable-01.yaml',
  ]);
  expect(traces.traces.some((trace) => trace.cardPath === null)).toBe(true);
});
```

- [ ] **Step 2: Run and verify missing search modules**

Run: `cd highschool-study-markdown && bun test tests/integration/bidirectional-search.test.ts`
Expected: FAIL with missing `server/src/cards`.

- [ ] **Step 3: Implement exact search types**

```ts
import type { TraceRecord } from './traces';
export type TraceIndex = { byCardPath: Map<string, TraceRecord[]> };
export type CardHit = {
  path: string;
  title: string;
  content: string;
  goal: string;
  methods: Array<{ name: string; role: 'primary' | 'secondary' }>;
  steps: Array<{ id: string; title: string }>;
  traceHistory: TraceRecord[];
};
export type TraceSearchResult = {
  traces: TraceRecord[];
  cardsByPath: Record<string, Omit<CardHit, 'traceHistory'>>;
};
export function buildTraceIndex(activeTraces: TraceRecord[]): TraceIndex;
export function searchCards(
  root: string,
  input: { query: string; limit: number },
): { cards: CardHit[] };
export function searchTraces(root: string, input: {
  query: string | null;
  planId: string | null;
  lessonId: string | null;
  cardPath: string | null;
  limit: number;
}): TraceSearchResult;
```

`searchCards` calls `readActiveTraces` once per request, builds one map, and never truncates one card's history. `searchTraces` filters active Trace first and reads only the unique referenced cards. Add an injectable-reader regression test proving three card hits still cause one Trace scan.

- [ ] **Step 4: Verify and commit**

Run: `cd highschool-study-markdown && bun test tests/integration/bidirectional-search.test.ts && bun run typecheck`
Expected: PASS.

```bash
git add highschool-study-markdown/server/src highschool-study-markdown/tests
git commit -m "feat: search cards and traces bidirectionally"
```

---

### Task 5: Implement Method Aggregation and Rebuildable Planner Attention

**Files:**
- Create: `highschool-study-markdown/server/src/method-signals.ts`
- Create: `highschool-study-markdown/scripts/rebuild-planner-attention.ts`
- Create: `highschool-study-markdown/tests/fixtures/learning-set/**`
- Test: `highschool-study-markdown/tests/integration/method-signals.test.ts`

**Interfaces:**
- Produces `aggregateMethodSignals(root, traces): MethodSignal[]`.
- The script rewrites only `memory/planner-attention.md`.

- [ ] **Step 1: Write the failing primary/secondary aggregation test**

```ts
import { expect, test } from 'bun:test';
import { makeLearningSetWithHistory } from '../helpers/learning-set';
import { readActiveTraces } from '../../server/src/traces';
import { aggregateMethodSignals } from '../../server/src/method-signals';

test('weights primary methods more than secondary methods', () => {
  const root = makeLearningSetWithHistory();
  const signals = aggregateMethodSignals(root, readActiveTraces(root));
  expect(signals).toContainEqual(expect.objectContaining({
    method: '冻结变量法',
    evidenceWeight: 2,
    earnedWeight: 1,
    score: 0.5,
  }));
  expect(signals).toContainEqual(expect.objectContaining({
    method: '参数化与消元',
    evidenceWeight: 1,
    earnedWeight: 0.5,
    score: 0.5,
  }));
});
```

- [ ] **Step 2: Run and verify the missing module**

Run: `cd highschool-study-markdown && bun test tests/integration/method-signals.test.ts`
Expected: FAIL with missing `server/src/method-signals`.

- [ ] **Step 3: Implement the uncalibrated projection**

```ts
export type MethodSignal = {
  method: string;
  evidenceWeight: number;
  earnedWeight: number;
  score: number;
  sourceRefs: string[];
};
const roleWeight = { primary: 2, secondary: 1 } as const;
const assessmentFactor = {
  correct: 1,
  partially_correct: 0.5,
  incorrect: 0,
  incomplete: 0,
} as const;
const supportFactor = { none: 1, tutor: 0.5, external: 0.75 } as const;
export function aggregateMethodSignals(
  root: string,
  traces: import('./traces').TraceRecord[],
): MethodSignal[];
```

Use the strongest role once for a repeated method in one card. Skip broken cards, cardless Trace, and superseded Trace. The rebuild script writes source-linked Markdown headed “Uncalibrated preparation signal; not a mastery claim.” It must leave both profile files byte-identical.

- [ ] **Step 4: Verify and commit**

Run: `cd highschool-study-markdown && bun test tests/integration/method-signals.test.ts && STUDY_LEARNING_SET=tests/fixtures/learning-set bun run rebuild:attention`
Expected: PASS; only `planner-attention.md` changes.

```bash
git add highschool-study-markdown/server/src/method-signals.ts highschool-study-markdown/scripts highschool-study-markdown/tests
git commit -m "feat: rebuild planner attention from traces"
```

---

### Task 6: Publish Exactly Four MCP Tools over stdio

**Files:**
- Create: `highschool-study-markdown/server/src/config.ts`
- Create: `highschool-study-markdown/server/src/mcp/create-server.ts`
- Create: `highschool-study-markdown/server/src/mcp/register-tools.ts`
- Create: `highschool-study-markdown/server/src/index.ts`
- Modify: `highschool-study-markdown/.mcp.json`
- Test: `highschool-study-markdown/tests/contract/mcp-tools.test.ts`

**Interfaces:**
- Produces `createStudyMcpServer({ learningSetRoot, now })`.
- Envelopes are `card_search → { cards }`, `trace_search → { traces, cardsByPath }`, `trace_append → TraceAppendResult`, and `source_resolve → SourceResolution`.

- [ ] **Step 1: Write the failing real-MCP contract**

```ts
import { expect, test } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { makeLearningSetWithHistory } from '../helpers/learning-set';
import { createStudyMcpServer } from '../../server/src/mcp/create-server';

test('publishes exactly four study tools', async () => {
  const server = createStudyMcpServer({
    learningSetRoot: makeLearningSetWithHistory(),
    now: () => new Date('2026-07-21T02:00:00Z'),
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  expect((await client.listTools()).tools.map((tool) => tool.name).sort()).toEqual([
    'card_search',
    'source_resolve',
    'trace_append',
    'trace_search',
  ]);
});
```

- [ ] **Step 2: Run and verify the missing MCP module**

Run: `cd highschool-study-markdown && bun test tests/contract/mcp-tools.test.ts`
Expected: FAIL with missing `server/src/mcp/create-server`.

- [ ] **Step 3: Register exact schemas and configuration**

`card_search` accepts `{ query, limit: 1..20 }`. `trace_search` accepts optional `query`, `planId`, `lessonId`, and `cardPath` plus `limit: 1..100`. `trace_append` uses Task 3's input. `source_resolve` accepts `{ fromPath, target }`. Every tool returns identical JSON text and `structuredContent`. Register no alias or compatibility tool.

```json
{
  "mcpServers": {
    "study-markdown": {
      "command": "bun",
      "args": ["run", "${CLAUDE_PLUGIN_ROOT}/server/src/index.ts"],
      "env": {
        "STUDY_LEARNING_SET": "${CLAUDE_PROJECT_DIR}/learning-set"
      }
    }
  }
}
```

- [ ] **Step 4: Extend the contract through append and reverse lookup**

Call `trace_append` with a Lesson alias, assert the new event appears in `card_search.traceHistory`, then assert `trace_search.cardsByPath` contains the card once. Append and find one cardless Trace as well.

- [ ] **Step 5: Verify and commit**

Run: `cd highschool-study-markdown && bun test tests/unit tests/integration tests/contract/mcp-tools.test.ts && bun run typecheck`
Expected: PASS.

```bash
git add highschool-study-markdown/.mcp.json highschool-study-markdown/server/src highschool-study-markdown/tests
git commit -m "feat: expose four markdown study tools"
```

---

### Task 7: Add Roles, Native Recall, and Plan-Gated Memory Skills

**Files:**
- Create: `highschool-study-markdown/agents/study-coach.md`
- Create: `highschool-study-markdown/agents/lesson-designer.md`
- Create: `highschool-study-markdown/skills/recall-study-memory/SKILL.md`
- Create: `highschool-study-markdown/skills/consolidate-plan-memory/SKILL.md`
- Create: `highschool-study-markdown/skills/study/SKILL.md`
- Create: `highschool-study-markdown/skills/start-or-revise-roadmap/SKILL.md`
- Create: `highschool-study-markdown/skills/prepare-next-lesson/SKILL.md`
- Create: `highschool-study-markdown/skills/run-lesson/SKILL.md`
- Create: `highschool-study-markdown/skills/close-lesson-reflection/SKILL.md`
- Create: `highschool-study-markdown/skills/correct-learning-record/SKILL.md`
- Create: `highschool-study-markdown/skills/inspect-progress/SKILL.md`
- Test: `highschool-study-markdown/tests/contract/agent-and-skills.test.ts`

**Interfaces:**
- The Coach is the only student-facing entry. The Designer is preparation-only.
- `recall-study-memory` performs seven recall classes without a ContextView.
- `consolidate-plan-memory` cannot write either profile before student confirmation.

- [ ] **Step 1: Write the failing prompt contract**

```ts
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = join(import.meta.dir, '../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('preserves recall and consolidation boundaries', () => {
  const recall = read('skills/recall-study-memory/SKILL.md');
  const consolidate = read('skills/consolidate-plan-memory/SKILL.md');
  expect(recall).toContain('Read both confirmed profiles in full');
  expect(recall).toContain('prior Lesson Summaries in the same Plan');
  expect(recall).toContain('relevant earlier Plan Summaries');
  expect(recall).not.toContain('study_context_get');
  expect(consolidate).toContain(
    'Never edit either profile before explicit student confirmation',
  );
  expect(consolidate).toContain('add / revise / delete');
  expect(consolidate).toContain('one owner only');
});
```

- [ ] **Step 2: Run and verify missing Skills**

Run: `cd highschool-study-markdown && bun test tests/contract/agent-and-skills.test.ts`
Expected: FAIL, first missing file is `skills/recall-study-memory/SKILL.md`.

- [ ] **Step 3: Write role tool boundaries**

The Coach may use native file tools, Skills, `Agent(highschool-study:lesson-designer)`, Tasks, and all four MCP tools. The Designer may use native readers, optional Agent, `card_search`, `trace_search`, and `source_resolve`, but not `trace_append`. Both forbid student Agent switching, invented cards/sources/session IDs, and persistence of Workflow raw JSON.

- [ ] **Step 4: Write the seven-stage recall Skill**

In order: locate Roadmap/Plan/Lesson; read prior same-Plan closed Lesson Summaries; read relevant earlier Plan Summaries; read both confirmed profiles in full for preparation and teaching; read `planner-attention.md` only for preparation; use `card_search` for cards and `trace_search` for evidence; use `source_resolve` only to drill down. Include: “Only launch Agent/Dynamic Workflow when direct evidence is insufficient and at least two independent searches can run in parallel.”

- [ ] **Step 5: Write the Plan consolidation Skill**

The Skill must:

1. verify the capability standard is met and the student explicitly chooses to complete the Plan;
2. read every indexed Lesson and call `trace_search(planId=...)` for active Trace;
3. read both current profiles;
4. propose `add/revise/delete` rows with `student/teaching` owner, direct sources, conflicts, and scope conditions;
5. let the student keep, rewrite, delete, or reject all rows in natural language;
6. state “Never edit either profile before explicit student confirmation”;
7. merge confirmed rows with one owner each;
8. append a cardless Trace in the final Plan-reflection block for any student correction of a mistaken inference;
9. allow an empty confirmed delta without blocking Plan completion.

Profiles store no proposal status, confidence, score, rejected-item list, or retired version.

- [ ] **Step 6: Write the remaining learning-loop Skills**

`study` routes from directory state. `start-or-revise-roadmap` records observable standards/tests plus dependencies, parallelism, and student-approved reordering. `prepare-next-lesson` calls recall then `card_search` and uses `trace_search` only for cross-card evidence. `run-lesson` projects flexible blocks to Tasks and calls `trace_append` after evidence-bearing activities. `close-lesson-reflection` returns continue/adjust/pause/close authority to the student. `correct-learning-record` appends supersession and rebuilds derived text without silently changing profiles. `inspect-progress` separates Roadmap/Plan/Lesson attainment, closure, method projections, and preferences.

- [ ] **Step 7: Verify and commit**

Run: `cd highschool-study-markdown && bun test tests/contract/agent-and-skills.test.ts && claude plugin validate . --strict`
Expected: PASS.

```bash
git add highschool-study-markdown/agents highschool-study-markdown/skills highschool-study-markdown/tests
git commit -m "feat: add native recall and memory consolidation"
```

---

### Task 8: Prove the Cross-Session Learning Loop and Document Operation

**Files:**
- Create: `highschool-study-markdown/tests/e2e/markdown-learning-loop.test.ts`
- Create: `highschool-study-markdown/README.md`

**Interfaces:**
- A real MCP client proves bidirectional lookup and supersession closure.
- Fixtures prove same-Plan summary continuity and confirmed profile updates after Plan completion.
- README documents setup, layers, recall, and a manual smoke test.

- [ ] **Step 1: Write the failing E2E MCP sequence**

Create a fixture with a Roadmap, max-value Plan, two real cards, and one prepared Lesson. Assert both cards initially return `traceHistory=[]`. Append event-001 by alias, assert only the first card gains history, reverse-search it, append event-002 superseding event-001, and assert both search directions now expose only event-002. Rebuild attention and assert its primary-method source is event-002. Assert no `.db`, `-wal`, or `-shm` file exists.

- [ ] **Step 2: Run and verify incomplete integration**

Run: `cd highschool-study-markdown && bun test tests/e2e/markdown-learning-loop.test.ts`
Expected: FAIL until the four-tool server, fixtures, and projection script are connected.

- [ ] **Step 3: Add the Plan-consolidation acceptance fixture**

Use three closed Lessons, an explicit preference, conflicting teaching observations, and existing confirmed profiles. Prove every add/revise/delete row points to original evidence; unconfirmed candidates never enter profiles; confirmed learner and tutor items reach only their respective owner; student-deleted items disappear; the next Plan reads both compact profiles rather than all old Lessons. Test the input boundary, confirmation gate, and resulting files, not one exact LLM sentence.

- [ ] **Step 4: Write README and manual smoke test**

README covers the four layers, seven recall classes, absence of `study_context_get`, bidirectional relation and request-local index, Plan-gated consolidation, `STUDY_LEARNING_SET`, empty card results, and `release:check`.

```bash
cd highschool-study-markdown
bun install
bun run release:check
STUDY_LEARNING_SET="$PWD/tests/fixtures/learning-set" bun run start:mcp
```

- [ ] **Step 5: Run final verification**

```bash
cd highschool-study-markdown
bun run release:check
rg -n "study_context_get|\\[student-stated\\]" server agents skills learning-set-template .mcp.json
find . -type f \\( -name '*.db' -o -name '*-wal' -o -name '*-shm' \\)
git diff --check
```

Expected: release checks pass; `rg` and `find` print nothing; `git diff --check` exits 0.

- [ ] **Step 6: Commit**

```bash
git add highschool-study-markdown
git commit -m "test: prove markdown study learning loop"
```

## Final Acceptance Checklist

- [ ] The learning set is readable without Claude Code.
- [ ] The public MCP surface is exactly the four agreed tools.
- [ ] Every card candidate carries full active Trace or an empty array; Trace reverse-resolves deduplicated cards.
- [ ] Trace alone owns card bindings; cards contain no backlinks.
- [ ] Cardless Trace, alias-bound Trace, and supersession work.
- [ ] Native recall replaces a ContextView service.
- [ ] Later Lessons use earlier same-Plan summaries; later Plans use relevant prior-Plan summaries.
- [ ] Preparation and teaching read both compact profiles in full; only preparation reads Planner attention.
- [ ] Plan consolidation reads the whole Plan and cannot edit profiles before student confirmation.
- [ ] The student may keep, rewrite, or delete candidates; every preference has one owner and direct original sources.
- [ ] Method aggregation rebuilds from active Trace and card method roles.
- [ ] Closure, attainment, and Tasks remain separate.
- [ ] Dynamic Workflow is optional and persists no raw JSON.
- [ ] The plugin creates no database or persistent reverse index and does not read the frozen plugin.
