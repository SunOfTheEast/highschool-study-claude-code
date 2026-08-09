# StudyForge M0 Canonical Document Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Roadmap, Plan, and Lesson Session one canonical, read-only Markdown persistence contract so native file tools can create parser-valid child nodes without constraining teaching prose.

**Architecture:** Add one static contract resource to the existing node resource assembly and inject it at a fixed virtual path for all three node kinds. Keep the existing strict parser as the mechanical authority, remove duplicated syntax examples from role Skills, and retain the child-first write/read/link/read sequence without adding domain tools, compatibility parsing, or safety projection.

**Tech Stack:** TypeScript 7, Bun test, Pi `DefaultResourceLoader`, Markdown resources, Playwright.

## Global Constraints

- Model-callable tools remain exactly `read`, `grep`, `find`, `ls`, `edit`, and `write`.
- Do not add Trace, Handoff, memory pools, projections, permission gates, compatibility layers, or node-creation tools.
- Treat frontmatter, required headings, Tree entries, and Block state fields as hard structure; keep teaching goals, prompts, controls, and logs as free Markdown prose.
- The contract at `/virtual/studyforge-m0-document-contract.md` is the only resource that spells out persistent node syntax.
- A parent Tree link may be added only after the complete child file exists and has been reread.
- Do not add exact-wording tests for Skill prose.

---

### Task 1: Prove every node Session receives one canonical contract

**Files:**
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`
- Create: `apps/pi-teaching-web/resources/contracts/m0-document-contract.md`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`

**Interfaces:**
- Consumes: `loadStaticNodeResources(root, scope): StaticNodeResources`.
- Produces: an `agentsFiles` entry with path `/virtual/studyforge-m0-document-contract.md` for Roadmap, Plan, and Lesson scopes.

- [x] **Step 1: Write the failing resource-assembly test**

Add a test that constructs all three `NodeSessionScope` variants and checks that each assembled resource list contains exactly one canonical contract. Assert that the content contains the exact Plan and Lesson headings, a legal Tree entry, `session_id: null`, and the child-first write order. Also assert the native tool list is unchanged.

```ts
test('injects one canonical document contract into every node session', () => {
  const root = copyFixture();
  const scopes = [
    {
      nodeKind: 'roadmap',
      nodeId: 'roadmap',
      nodePath: 'ROADMAP.md',
      parentId: null,
      parentPath: null,
    },
    {
      nodeKind: 'plan',
      nodeId: 'plan-001',
      nodePath: 'plans/plan-001.md',
      parentId: 'roadmap',
      parentPath: 'ROADMAP.md',
    },
    {
      nodeKind: 'lesson',
      nodeId: 'lesson-001',
      nodePath: 'lessons/lesson-001.md',
      parentId: 'plan-001',
      parentPath: 'plans/plan-001.md',
    },
  ] as const;

  for (const scope of scopes) {
    const resources = loadStaticNodeResources(root, scope);
    const contracts = resources.agentsFiles.filter(
      (file) => file.path === '/virtual/studyforge-m0-document-contract.md',
    );

    expect(contracts).toHaveLength(1);
    expect(contracts[0]?.content).toContain('## Stage Goal');
    expect(contracts[0]?.content).toContain('## Lesson Tree');
    expect(contracts[0]?.content).toContain('## Block block-001：活动名称');
    expect(contracts[0]?.content).toContain('session_id: null');
    expect(contracts[0]?.content).toContain('- [plan-001 | 阶段标题](plans/plan-001.md)');
    expect(contracts[0]?.content).toContain('write 完整子文件');
    expect(resources.tools).toEqual(['read', 'grep', 'find', 'ls', 'edit', 'write']);
  }
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts
```

Expected: FAIL because no resource has the virtual contract path.

- [x] **Step 3: Add the canonical Markdown contract**

Create `resources/contracts/m0-document-contract.md` with:

- legal Plan and Lesson Tree entry forms;
- a complete `prepared` Plan template with exact frontmatter and required headings;
- a complete `prepared` Lesson template with one valid pending Block;
- the allowed Plan, Lesson, Block, and activity enums;
- the rule that an empty Tree contains no placeholder text;
- the sequence `write child → read child → edit parent Tree → read parent`;
- an explicit statement that prose inside semantic sections is free and should serve the teaching decision.

Do not include legacy formats, historical failures, or optional persistent sections.

- [x] **Step 4: Inject the contract through the existing resource loader**

Add one entry to `loadStaticNodeResources(...).agentsFiles`:

```ts
{
  path: '/virtual/studyforge-m0-document-contract.md',
  content: file(join(resourceRoot, 'contracts', 'm0-document-contract.md')),
},
```

Do not alter `roleSkills`, `M0_MODEL_TOOLS`, or `DefaultResourceLoader` flags.

- [x] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts
```

Expected: all native Session tests pass.

### Task 2: Make the canonical contract the sole syntax owner

**Files:**
- Modify: `apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `docs/superpowers/specs/2026-08-02-m0-canonical-document-contract-design.md`

**Interfaces:**
- Consumes: the virtual contract injected by Task 1.
- Produces: Skills that own teaching judgment and lifecycle responsibility while referring structural writes to the canonical contract.

- [x] **Step 1: Remove duplicated Tree and Block syntax from Skills**

In `roadmap-study`, retain the Roadmap/Plan ownership boundary and the fact that future lesson ideas remain prose, but replace the exact empty-Tree formatting explanation with a direction to follow the canonical contract.

In `coach-study`, remove the fenced Block Markdown template. Retain the teaching meaning of a Block, one judged attempt per problem Block, material authenticity, and prepared-only editing. Direct structural creation and linking to the canonical contract.

Do not weaken the student-owned lifecycle or the requirement to reread affected documents.

- [x] **Step 2: Mark the approved design as confirmed**

Change the design status from `待书面确认` to `已书面确认`. Do not expand the approved scope.

- [x] **Step 3: Run resource and parser contract tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts tests/m0/markdown-domain.test.ts
```

Expected: all tests pass; strict Markdown parsing and assembled resource behavior remain intact.

### Task 3: Verify the complete M0 closure

**Files:**
- Modify if required by an existing verification break: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`
- Modify if required by an existing verification break: `apps/pi-teaching-web/tests/e2e/m0-cycle.spec.ts`

**Interfaces:**
- Consumes: the canonical resource, existing parser, and deterministic M0 browser cycle.
- Produces: fresh evidence that the change preserves the complete app contract.

- [x] **Step 1: Run the full static and unit verification**

Run:

```bash
cd apps/pi-teaching-web
bun run check
```

Expected: TypeScript passes, all non-E2E Bun tests pass, and Vite builds successfully.

- [x] **Step 2: Run the deterministic browser closure**

Run:

```bash
cd apps/pi-teaching-web
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

Expected: the Roadmap → Plan → Lesson browser cycle passes.

If the test instead finds only the intentionally empty public Demo Roadmap, decouple
the lifecycle E2E from `examples/derivative-m0`: copy the test-owned M0 fixture, set
its Plan and Lesson frontmatter to `prepared`, and use that fixture's visible titles.
Do not restore prebuilt children to the public Demo.

- [x] **Step 3: Review the final diff against the design**

Confirm:

- exactly one new runtime resource exists;
- every node kind receives it once;
- native tools remain unchanged;
- no parser compatibility was added;
- Skill prose no longer duplicates full persistent templates;
- no teaching, memory, projection, or frontend scope entered the diff.

- [x] **Step 4: Commit the implementation**

```bash
git add \
  apps/pi-teaching-web/resources/contracts/m0-document-contract.md \
  apps/pi-teaching-web/src/runtime/resource-loader.ts \
  apps/pi-teaching-web/tests/m0/native-session.test.ts \
  apps/pi-teaching-web/tests/e2e/fixture-server.ts \
  apps/pi-teaching-web/tests/e2e/m0-cycle.spec.ts \
  apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  docs/superpowers/specs/2026-08-02-m0-canonical-document-contract-design.md \
  docs/superpowers/plans/2026-08-02-m0-canonical-document-contract.md
git commit -m "feat: inject canonical M0 document contract"
```
