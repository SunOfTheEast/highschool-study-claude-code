# Teaching Skill and Tool Schema Authority Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move each teaching rule to one appropriate authority layer so Pi and the Claude Code plugin keep their teaching judgment while Skills stop carrying tool-field tutorials, receipt protocols, runtime error branches, and accumulated one-off wording patches.

**Architecture:** Work from the bottom up. First make the Pi and public MCP tool contracts self-explanatory and tighten the one machine-driving input that is still open-ended; then rewrite Tutor and Coach guidance around observable classroom events and decisions; finally reduce repository guidance to an authority map. Persistent Markdown facts and runtime enforcement remain unchanged.

**Tech Stack:** TypeScript 7, Bun 1.3.14, TypeBox 1.3.6, Zod 4.4.3, MCP SDK 1.29.0, Markdown-based Pi/Claude Skills.

## Global Constraints

- Implement against `/Users/yangrundong/.codex/worktrees/highschool-study-main-final`.
- Use the approved design at `docs/superpowers/specs/2026-07-24-teaching-skill-tool-schema-authority-design.md`.
- Preserve the existing user changes in `apps/pi-teaching-web/src/study/write-workspace.ts` and `apps/pi-teaching-web/tests/study/write-workspace.test.ts`; do not edit, stage, revert, or reformat them.
- Do not change the persistent Roadmap, Plan, Lesson, Trace, card, graph, alternative, profile, or planner-attention schemas.
- Do not add an Agent, judge, rule engine, background workflow, database, index, compatibility layer, dependency, public MCP tool, or Pi reference loader.
- Keep the public MCP surface exactly `card_search`, `trace_search`, `trace_append`, and `source_resolve`.
- Keep all existing tool names, return payloads, runtime validation, ownership rules, and write behavior unchanged.
- The only executable input change is `lesson_prepare.primaryTemplate`, which must accept exactly `diagnostic | concept | deliberate-practice | remediation | assessment | review`.
- Tool schemas own parameter names, local parameter meaning, immediate preconditions, scope, and result semantics.
- Agent prompts own role, Session boundary, tool visibility, and student-facing privacy.
- Skills own teaching judgment, student control, and event-triggered decisions; they must not reproduce complete tool signatures, receipt field lists, runtime error codes, or deterministic Markdown transforms.
- Pi Coach and Tutor Skills remain self-contained because the current Pi loader directly loads `SKILL.md`.
- Claude plugin Skills use only their existing one-level references; do not create another reference layer.
- `apps/pi-teaching-web/resources/skills/deep-workflow/SKILL.md` remains the sole owner of Evidence Scout `tokenLimit`, `timeoutMs`, mode, and task-role mechanics.
- Do not add automated tests for Skill or Agent prose, exact phrases, headings, word lists, token counts, or spoiler blacklists. Existing real-course failures are the behavioral baseline.
- Add or change tests only for executable schema/tool/runtime behavior. Metadata-only description edits use existing contract tests as regressions.
- Treat the word-count targets as review signals, not gates: Pi Tutor about 350–450 English words, Pi Coach about 300–400, plugin `run-lesson` about 250–350, and plugin `prepare-next-lesson` about 350–450.
- Run real-model acceptance only against a copied learning set.

## File and Authority Map

| Surface | Files | Responsibility after this plan |
|---|---|---|
| Pi schema and tool contracts | `apps/pi-teaching-web/src/runtime/*.ts` listed in Tasks 1–2 | Machine input shape, local field meaning, immediate call preconditions, Session-bound scope, compact result meaning |
| Public MCP contracts | `plugins/highschool-study/server/src/mcp/register-tools.ts` | The same contract quality for the four public tools without changing their shapes |
| Pi Tutor | `apps/pi-teaching-web/resources/agents/tutor.md`, `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md` | Lesson role plus event-oriented teaching judgment |
| Pi Coach | `apps/pi-teaching-web/resources/agents/coach.md`, `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md` | Plan role plus evidence, preparation, source, and Plan-decision judgment |
| Plugin classroom | `plugins/highschool-study/skills/run-lesson/**`, `plugins/highschool-study/skills/close-lesson-reflection/SKILL.md` | Classroom orchestration plus one canonical evidence reference |
| Plugin preparation | `plugins/highschool-study/skills/prepare-next-lesson/**`, `plugins/highschool-study/agents/lesson-designer.md` | Preparation orchestration, positive reveal contracts, and source-grounded internal drafting |
| Repository governance | `AGENTS.md` | Pointers to authorities and change discipline, not a second copy of teaching protocols |

---

### Task 1: Make the classroom template ID an executable Pi contract

**Files:**
- Modify: `apps/pi-teaching-web/src/runtime/lesson-prepare.ts`
- Test: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`

**Interfaces:**
- Consumes: `createLessonPrepareTool(root, ownerId, ownerPath)` and its existing TypeBox `parameters`.
- Produces: the same `lesson_prepare` tool and receipt, with `primaryTemplate` constrained to the six canonical template IDs.
- Preserves: `LessonBlueprint`, rendered Lesson Markdown, Plan indexing, ownership, and all runtime validation.

- [ ] **Step 1: Add the executable schema test**

Append this test immediately after `prepares and rereads one Lesson with Plan authority bound by the Coach Session`:

```ts
test('accepts only the six canonical classroom template IDs', () => {
  const tool = createLessonPrepareTool(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
  );
  const input = {
    lessonId: 'lesson-template-contract',
    title: 'Template contract',
    planContext: 'Current Plan context.',
    capabilityTarget: 'Produce one observable response.',
    primaryTemplate: 'assessment',
    templateReason: 'Use one independent attempt.',
    adjustments: [],
    cards: [],
    sources: [],
    blocks: [{
      id: 'reflection',
      kind: 'reflection',
      required: true,
      dependsOn: [],
      uses: [],
      studentView: '回顾本节证据。',
      teacherControl: '只使用已经形成的课堂证据。',
    }],
  };
  const canonical = [
    'diagnostic',
    'concept',
    'deliberate-practice',
    'remediation',
    'assessment',
    'review',
  ] as const;

  for (const primaryTemplate of canonical) {
    expect(Check(tool.parameters, { ...input, primaryTemplate })).toBeTrue();
  }
  expect(Check(tool.parameters, {
    ...input,
    primaryTemplate: 'practice',
  })).toBeFalse();
});
```

- [ ] **Step 2: Run the new test and verify the open string fails it**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts --test-name-pattern "six canonical classroom template IDs"
```

Expected: FAIL because the current `nonempty` string accepts `practice`.

- [ ] **Step 3: Replace the open template string and make the Blueprint fields locally self-describing**

In `apps/pi-teaching-web/src/runtime/lesson-prepare.ts`, add this schema beside `nonempty`:

```ts
const classroomTemplate = Type.Union([
  Type.Literal('diagnostic'),
  Type.Literal('concept'),
  Type.Literal('deliberate-practice'),
  Type.Literal('remediation'),
  Type.Literal('assessment'),
  Type.Literal('review'),
], {
  description: 'Canonical classroom template selected for this Lesson. The ID chooses template defaults; adjustments record deliberate deviations.',
});
```

Replace the current `block` schema with:

```ts
const block = Type.Object({
  id: Type.String({
    minLength: 1,
    description: 'Lesson-local Block ID used by dependencies and later classroom tools.',
  }),
  kind: Type.Union([
    Type.Literal('dialogue'),
    Type.Literal('problem'),
    Type.Literal('material'),
    Type.Literal('reflection'),
  ], {
    description: 'Activity kind. A problem produces one independently assessed response; the Lesson must contain exactly one reflection Block.',
  }),
  required: Type.Boolean({
    description: 'Whether the Lesson cannot complete normally without traversing this Block.',
  }),
  dependsOn: Type.Array(nonempty, {
    description: 'Earlier Block IDs that must be resolved before this Block can activate.',
  }),
  uses: Type.Array(nonempty, {
    description: 'Lesson-local aliases used by this Block. A problem Block must use exactly one authentic problem-card alias.',
  }),
  studentView: Type.String({
    minLength: 1,
    description: 'Content that may be shown when this Block is active.',
  }),
  teacherControl: Type.String({
    minLength: 1,
    description: 'Private role, source references, reveal mode, evidence target, and ordered teaching support for this Block.',
  }),
}, {
  description: 'One adjustable Lesson activity. Put separately judged responses, including separately judged parts of one card, in separate problem Blocks.',
});
```

Replace the tool `description` and `parameters` with:

```ts
description: 'Compile one source-grounded Blueprint into canonical Lesson Markdown and register it under the Coach Session-owned Plan. Call after selecting a canonical template, authentic card paths, and a complete Block graph; revise only a same-Plan Lesson that is still prepared. The runtime binds Plan ownership, validates sources and aliases, writes initial state and Plan links, and returns the prepared Lesson path and block count.',
parameters: Type.Object({
  lessonId: Type.String({
    minLength: 1,
    description: 'New Lesson ID and lessons/<lessonId>.md filename stem.',
  }),
  title: Type.String({
    minLength: 1,
    description: 'Student-visible Lesson title appropriate to the selected reveal policy.',
  }),
  planContext: Type.String({
    minLength: 1,
    description: 'Brief source-linked account of where this Lesson sits in the current Plan.',
  }),
  capabilityTarget: Type.String({
    minLength: 1,
    description: 'Observable capability this Lesson teaches or checks; it does not assert attainment.',
  }),
  primaryTemplate: classroomTemplate,
  templateReason: Type.String({
    minLength: 1,
    description: 'Why this template fits the current evidence and capability target.',
  }),
  adjustments: Type.Array(nonempty, {
    description: 'Deliberate changes from the selected template defaults.',
  }),
  cards: Type.Array(Type.Object({
    alias: Type.String({
      minLength: 1,
      description: 'Lesson-local short name referenced by Block uses.',
    }),
    cardPath: Type.String({
      minLength: 1,
      description: 'Exact learning-set-relative path returned by authentic card retrieval.',
    }),
    role: Type.String({
      minLength: 1,
      description: 'Instructional role this card serves in the Lesson.',
    }),
  }), {
    description: 'Authentic problem cards available to this Lesson.',
  }),
  sources: Type.Array(Type.Object({
    label: Type.String({
      minLength: 1,
      description: 'Readable name for the material source.',
    }),
    target: Type.String({
      minLength: 1,
      description: 'Learning-set-local source target or source fragment.',
    }),
    note: Type.String({
      minLength: 1,
      description: 'What this source supports in the Lesson.',
    }),
  }), {
    description: 'Non-card materials cited by the Lesson.',
  }),
  blocks: Type.Array(block, {
    minItems: 1,
    description: 'Ordered, dependency-aware activity graph compiled into the Lesson.',
  }),
}),
```

- [ ] **Step 4: Run the focused schema and preparation regressions**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts --test-name-pattern "canonical classroom template IDs|prepares and rereads one Lesson|rejects a nonexistent card"
bun run typecheck
```

Expected: all selected tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit the executable contract**

```bash
git add apps/pi-teaching-web/src/runtime/lesson-prepare.ts apps/pi-teaching-web/tests/runtime/study-tools.test.ts
git commit -m "refactor: constrain lesson preparation templates"
```

---

### Task 2: Make every Pi study tool self-explanatory

**Files:**
- Modify: `apps/pi-teaching-web/src/runtime/study-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/classroom-update.ts`
- Modify: `apps/pi-teaching-web/src/runtime/card-alternative-append.ts`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-close.ts`
- Modify: `apps/pi-teaching-web/src/runtime/plan-update.ts`
- Modify: `apps/pi-teaching-web/src/runtime/plan-register.ts`
- Test: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts` (existing regression only)

**Interfaces:**
- Consumes: the current tool names, TypeBox shapes, Session-bound closures, and runtime execute functions.
- Produces: descriptions that state outcome, call timing, bound scope, local parameter meaning, and useful result semantics without changing executable behavior.
- Preserves: all execute implementations and return objects byte-for-byte.

There is no prose RED test for this task. Exact-description tests are forbidden by the repository contract; the executable suite protects tool count, schemas, validation, writes, and receipts.

- [ ] **Step 1: Expand the three Pi read-tool contracts**

In `apps/pi-teaching-web/src/runtime/study-tools.ts`, replace only the `description` and `parameters` of `card_search`, `trace_search`, and `source_resolve` with:

```ts
description: 'Search only real problem cards in the current learning set. Use for preparation or private route verification, not to manufacture a missing exercise. Every returned card includes its complete active Trace history; an empty cards array is a valid result.',
parameters: Type.Object({
  query: Type.String({
    description: 'Natural-language topic, method, goal, title, or source text used to rank authentic cards.',
  }),
  limit: Type.Integer({
    minimum: 1,
    maximum: 20,
    description: 'Maximum number of card candidates; it never truncates one returned card\'s active Trace history.',
  }),
}),
```

```ts
description: 'Search active, non-superseded classroom Trace and reverse-resolve the unique real cards it cites. Use when the evidence question starts from a Plan, Lesson, card, or remembered classroom detail; combine optional scopes to narrow the result.',
parameters: Type.Object({
  query: Type.Optional(Type.String({
    description: 'Optional text matched against active Trace evidence.',
  })),
  planId: Type.Optional(Type.String({
    description: 'Optional exact Plan ID scope.',
  })),
  lessonId: Type.Optional(Type.String({
    description: 'Optional exact Lesson ID scope.',
  })),
  cardPath: Type.Optional(Type.String({
    description: 'Optional exact learning-set-relative card path for card-to-Trace lookup.',
  })),
  limit: Type.Integer({
    minimum: 1,
    maximum: 100,
    description: 'Maximum number of active Trace records returned.',
  }),
}),
```

```ts
description: 'Resolve and verify one learning-set-local source reference, optionally including a fragment. Use before relying on a relative file, heading, or card-step citation. The result reports the canonical path, fragment, and validity without changing files.',
parameters: Type.Object({
  fromPath: Type.String({
    description: 'Learning-set-relative path of the file that contains or is making the reference.',
  }),
  target: Type.String({
    description: 'Relative or learning-set-local source target, optionally followed by a fragment.',
  }),
}),
```

- [ ] **Step 2: Expand the Pi `trace_append` contract without changing its schema**

Change the `methodName` declaration inside `createStudyTools` to:

```ts
const methodName = Type.Enum(listCanonicalMethodNames(root), {
  description: 'Exact canonical method name from the current learning-set graph.',
});
```

Replace only `trace_append`'s `description` and `parameters` with:

```ts
description: 'Append or supersede one validated classroom-evidence Trace for the current Tutor Session-owned Lesson. Call when an evidence-bearing response, later completion, accepted correction, repeat, or student-confirmed method changes the active record for one Block attempt. The runtime derives Lesson and problem-card identity from the Session and Block, rejects parallel active attempts, refreshes projections, and returns the persisted fact receipt.',
parameters: Type.Object({
  blockId: Type.String({
    description: 'Exact current Lesson Block ID whose activity produced this evidence. For a problem Block, the runtime derives its one card alias from Uses.',
  }),
  materialPath: Type.Optional(Type.String({
    description: 'Learning-set-relative source path when the evidence came from material rather than the Block\'s problem card.',
  })),
  methodStatus: Type.Union([
    Type.Literal('unmapped'),
    Type.Literal('student_confirmed'),
  ], {
    description: 'Use student_confirmed only after the student explicitly accepts one exact canonical node for this route; otherwise preserve the route as unmapped.',
  }),
  methodRoute: Type.String({
    minLength: 1,
    description: 'Plain-language account of the decisive route the student actually used, independent of any canonical label.',
  }),
  methodPrimary: Type.Optional(methodName),
  methodSecondary: Type.Optional(Type.Array(methodName, {
    description: 'Additional student-confirmed canonical nodes actually used by this route.',
  })),
  methodDecisiveStep: Type.Optional(Type.String({
    minLength: 1,
    description: 'Student-produced step that justifies the confirmed canonical method binding.',
  })),
  methodConfirmation: Type.Optional(Type.String({
    minLength: 1,
    description: 'Brief record of the student turn that confirmed the canonical method binding.',
  })),
  assessment: Type.Union([
    Type.Literal('correct'),
    Type.Literal('partially_correct'),
    Type.Literal('incorrect'),
    Type.Literal('incomplete'),
  ], {
    description: 'Mathematical completeness of the student\'s own frozen work. Missing decisive reasoning is incomplete; Tutor-generated completion cannot make the same attempt correct.',
  }),
  support: Type.Union([
    Type.Literal('none'),
    Type.Literal('tutor'),
    Type.Literal('external'),
  ], {
    description: 'Help actually used in the final route: none for independent work, tutor when Tutor-origin decisive content shaped the route, and external for other used help. Mere exposure or unused repetition is not dependence.',
  }),
  note: Type.String({
    description: 'Concise source-linked evidence note describing what the student supplied and what remains unresolved.',
  }),
  supersedes: Type.Optional(Type.String({
    description: 'Exact active event ID replaced by a completion, correction, repeat, or method confirmation for this same Block attempt. A different independently judged question requires a different problem Block.',
  })),
}),
```

- [ ] **Step 3: Clarify classroom state actions**

In `apps/pi-teaching-web/src/runtime/classroom-update.ts`, replace `action` with:

```ts
const action = Type.Union([
  Type.Literal('activate'),
  Type.Literal('complete'),
  Type.Literal('skip'),
  Type.Literal('route'),
  Type.Literal('pause'),
], {
  description: 'activate opens one Block; complete or skip resolves one Block; route records an insertion, skip, move, or repeat decision; pause marks the Lesson paused.',
});
```

Replace only the tool `description` and `parameters` with:

```ts
description: 'Persist one classroom navigation change in the current Tutor Session-owned Lesson. Use ordinary Block actions for traversal, route for an explicit adaptive route decision, and pause for a student-requested pause. The runtime owns the Lesson path and returns the applied action.',
parameters: Type.Object({
  action,
  blockId: Type.Optional(Type.String({
    description: 'Exact Lesson Block ID. Required for activate, complete, skip, and route; omitted only for pause.',
  })),
  routeAction: Type.Optional(Type.Union([
    Type.Literal('insert'),
    Type.Literal('skip'),
    Type.Literal('move'),
    Type.Literal('repeat'),
  ], {
    description: 'Kind of adaptive route change; required only when action is route.',
  })),
  before: Type.Optional(Type.String({
    description: 'Optional Block ID before which the route target is placed.',
  })),
  after: Type.Optional(Type.String({
    description: 'Optional Block ID after which the route target is placed.',
  })),
  reason: Type.Optional(Type.String({
    description: 'Student-facing instructional reason for a route change; required when action is route.',
  })),
  source: Type.Optional(Type.String({
    description: 'Evidence or student request that prompted the route change; required when action is route.',
  })),
}),
```

- [ ] **Step 4: Clarify alternative, closure, and Plan write contracts**

In `apps/pi-teaching-web/src/runtime/card-alternative-append.ts`, give `methodName` a local description and replace the tool contract:

```ts
const methodName = Type.Enum(listCanonicalMethodNames(root), {
  description: 'Exact canonical method name from the current learning-set graph.',
});
```

```ts
description: 'Persist one verified genuinely different complete route beside its real problem card. Call only after the current Lesson has a correct active Trace for the route and the whole changed question or part has been checked against the reference and stored alternatives. The runtime binds the Lesson and source card and returns the stored alternative.',
parameters: Type.Object({
  sourceTraceId: Type.String({
    minLength: 1,
    description: 'Event ID of the correct active Trace that proves this route occurred in the current Lesson.',
  }),
  question: Type.String({
    minLength: 1,
    description: 'Exact scope whose complete route differs: use `整题` for a card without parts, otherwise the exact changed part label rather than the stem.',
  }),
  solution: Type.String({
    minLength: 1,
    description: 'Complete entry, decisive reasoning, and closing chain of the verified alternative route.',
  }),
  method: Type.Union([methodName, Type.Null()], {
    description: 'One student-confirmed exact canonical node for the alternative, or null after rejection, deferral, or no exact match.',
  }),
  support: Type.Union([
    Type.Literal('none'),
    Type.Literal('tutor'),
    Type.Literal('external'),
  ], {
    description: 'Help actually used in this alternative route, using the same dependence meaning as classroom Trace.',
  }),
}),
```

In `apps/pi-teaching-web/src/runtime/lesson-close.ts`, replace only the contract with:

```ts
description: 'Atomically finish the current Tutor Session-owned Lesson after the student has explicitly chosen to close it. Call with a reflection and summary derived from existing active evidence; the tool completes the active reflection Block and closes the Lesson, then returns closed status.',
parameters: Type.Object({
  reflection: Type.String({
    minLength: 1,
    description: 'Source-linked account of what the Lesson established, what remains uncertain, and what support was actually used.',
  }),
  summary: Type.String({
    minLength: 1,
    description: 'Compact Lesson handoff for the Coach, grounded in active Trace and direct sources.',
  }),
}),
```

In `apps/pi-teaching-web/src/runtime/plan-update.ts`, replace only the contract with:

```ts
description: 'Persist the Coach\'s final audit of the current Session-owned Plan. Call after reviewing active evidence and obtaining any student choice required for completion or replanning. The runtime rebuilds Lesson Index and Roadmap status from real files; reread the Plan before reporting the result.',
parameters: Type.Object({
  decision: Type.Union([
    Type.Literal('active'),
    Type.Literal('complete'),
    Type.Literal('replan'),
  ], {
    description: 'Final Plan decision: continue active, complete with student agreement, or reactivate around a revised route.',
  }),
  currentPosition: Type.String({
    minLength: 1,
    description: 'Source-linked account of met, unmet, and conflicting capability evidence.',
  }),
  nextLessonCandidate: Type.String({
    minLength: 1,
    description: 'Grounded next-Lesson direction, or an explicit statement that no next Lesson is currently proposed.',
  }),
  planSummary: Type.String({
    minLength: 1,
    description: 'Compact Plan-level synthesis of active evidence, decision, and unresolved work.',
  }),
}),
```

In `apps/pi-teaching-web/src/runtime/plan-register.ts`, replace only the contract with:

```ts
description: 'Validate an already written Plan file and register it idempotently in ROADMAP.md. Call after the Plan content exists; this tool does not author the Plan. It verifies the canonical Plan, repairs a foreign Coach Session link when necessary, and returns the registered Plan receipt.',
parameters: Type.Object({
  planId: Type.String({
    minLength: 1,
    description: 'Exact ID from the Plan frontmatter and plans/<planId>.md filename stem.',
  }),
}),
```

- [ ] **Step 5: Run existing Pi tool regressions**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts
bun run typecheck
```

Expected: zero failures; tool names, writes, ownership, receipts, alternative persistence, closure, and Plan updates remain unchanged.

- [ ] **Step 6: Commit the Pi contract metadata**

```bash
git add apps/pi-teaching-web/src/runtime/study-tools.ts apps/pi-teaching-web/src/runtime/classroom-update.ts apps/pi-teaching-web/src/runtime/card-alternative-append.ts apps/pi-teaching-web/src/runtime/lesson-close.ts apps/pi-teaching-web/src/runtime/plan-update.ts apps/pi-teaching-web/src/runtime/plan-register.ts
git commit -m "refactor: clarify pi teaching tool contracts"
```

---

### Task 3: Give the four public MCP tools equivalent contract quality

**Files:**
- Modify: `plugins/highschool-study/server/src/mcp/register-tools.ts`
- Test: `plugins/highschool-study/tests/contract/mcp-tools.test.ts` (existing regression only)

**Interfaces:**
- Consumes: the four existing Zod input objects and `registerStudyTools`.
- Produces: richer MCP tool descriptions and per-field Zod descriptions.
- Preserves: names, required/optional/nullability semantics, `.strict()`, outputs, and tool count.

There is no new description-text assertion. The existing in-memory MCP test remains the executable contract for discovery, invocation, return parity, Trace append, reverse lookup, and source resolution.

- [ ] **Step 1: Replace the four Zod input declarations**

Use these exact schemas in `plugins/highschool-study/server/src/mcp/register-tools.ts`:

```ts
const cardSearchInput = z.object({
  query: z.string().describe(
    'Natural-language topic, method, goal, title, or source text used to rank authentic cards.',
  ),
  limit: z.number().int().min(1).max(20).describe(
    'Maximum card candidates; one returned card still includes its complete active Trace history.',
  ),
}).strict();

const traceSearchInput = z.object({
  query: z.string().optional().describe(
    'Optional text matched against active, non-superseded Trace.',
  ),
  planId: z.string().optional().describe('Optional exact Plan ID scope.'),
  lessonId: z.string().optional().describe('Optional exact Lesson ID scope.'),
  cardPath: z.string().optional().describe(
    'Optional exact learning-set-relative card path for card-to-Trace lookup.',
  ),
  limit: z.number().int().min(1).max(100).describe(
    'Maximum number of active Trace records returned.',
  ),
}).strict();

const traceAppendInput = z.object({
  lessonPath: z.string().describe(
    'Exact learning-set-relative Lesson path that owns this classroom event.',
  ),
  blockId: z.string().describe(
    'Exact Lesson Block ID whose activity produced the evidence.',
  ),
  cardAlias: z.string().nullable().describe(
    'Exact alias declared by that Lesson, or null only for evidence not bound to a problem card.',
  ),
  cardStepId: z.string().nullable().describe(
    'Exact stable step ID on the resolved card, or null when the event is not step-specific.',
  ),
  materialPath: z.string().nullable().describe(
    'Learning-set-relative material source for non-card evidence, otherwise null.',
  ),
  assessment: z.enum([
    'correct',
    'partially_correct',
    'incorrect',
    'incomplete',
  ]).describe(
    'Completeness of the student-authored evidence; Tutor-generated work cannot upgrade the same attempt.',
  ),
  support: z.enum(['none', 'tutor', 'external']).describe(
    'Help actually used in the final route, not mere exposure to a hint.',
  ),
  methods: z.object({
    primary: z.string().describe(
      'Student-confirmed canonical primary method actually used.',
    ),
    secondary: z.array(z.string()).optional().describe(
      'Student-confirmed canonical secondary methods actually used.',
    ),
  }).strict().optional().describe(
    'Confirmed method evidence; omit when no exact canonical binding has been confirmed.',
  ),
  note: z.string().describe(
    'Concise source-linked account of the evidence and unresolved obligations.',
  ),
  supersedes: z.string().nullable().describe(
    'Exact earlier event ID corrected or replaced within the same Lesson, otherwise null.',
  ),
}).strict();

const sourceResolveInput = z.object({
  fromPath: z.string().describe(
    'Learning-set-relative path of the file making the reference.',
  ),
  target: z.string().describe(
    'Relative or learning-set-local source target, optionally including a fragment.',
  ),
}).strict();
```

- [ ] **Step 2: Replace the four MCP tool descriptions**

Use:

```ts
description: 'Search only real problem cards in the current learning set. Use for preparation or private route verification. Every card includes its complete active Trace history; an empty result is valid and must not be replaced with an invented card.',
```

```ts
description: 'Search active, non-superseded classroom Trace by optional Plan, Lesson, card, and text scopes, then reverse-resolve the unique authentic cards cited by the result.',
```

```ts
description: 'Append one validated evidence Trace to an explicit real Lesson. Use for an evidence-bearing activity or a later correction that supersedes an earlier event; runtime validation checks Lesson, Block, aliases, card steps, and provenance before returning the persisted fact.',
```

```ts
description: 'Resolve and verify one learning-set-local source target or fragment relative to the file that cites it. This is read-only and returns canonical validity information.',
```

- [ ] **Step 3: Run the public MCP contract**

Run:

```bash
cd plugins/highschool-study
bun test tests/contract/mcp-tools.test.ts
bun run typecheck
```

Expected: the in-memory client lists exactly four tools and all calls pass with unchanged outputs.

- [ ] **Step 4: Commit the public tool metadata**

```bash
git add plugins/highschool-study/server/src/mcp/register-tools.ts
git commit -m "refactor: clarify public study tool contracts"
```

---

### Task 4: Rewrite Pi Tutor around five observable classroom events

**Files:**
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/agents/tutor.md`

**Interfaces:**
- Consumes: the enriched `trace_append`, `classroom_update`, `card_alternative_append`, and `lesson_close` contracts from Tasks 1–2.
- Produces: a self-contained Tutor Skill that decides what the current classroom event means without teaching tool fields.
- Preserves: student control, evidence freeze, actual support dependence, one-Block attempt identity, accepted corrections, method confirmation, genuine-alternative criteria, and student-confirmed closure.

No automated prose test is added. The existing real-course failures are the RED evidence; Task 9 performs the forward observation.

- [ ] **Step 1: Replace `tutor-lesson/SKILL.md` with the event-oriented Skill**

```markdown
---
name: tutor-lesson
description: Use when running, adapting, pausing, resuming, or closing one Lesson with a student.
---

# Tutor Lesson

Teach the active Block of the Session-owned Lesson as a conversation. Let the student's current intent decide what happens next.

## Student control

Honor pause, continued-thinking, help, transition, and close requests before the planned flow. Continued thinking means wait, not hint. An explicit close request ends new teaching and reflection questions; resolve only accepted corrections and facts required for closure. Close only after the student's explicit choice. Lesson closure does not complete its Plan.

## Evidence-bearing attempt

Freeze the student's mathematical content before adding Tutor reasoning. Judge completeness, actual help dependence, and actual route separately.

Missing decisive reasoning is `incomplete`; a substantive error in the student's chain may be partially correct or incorrect. Tutor-generated work cannot upgrade that frozen attempt. Support records help used in the final route: a decisive Tutor contribution that shapes it is Tutor support, while exposure, repetition, or unused help is not.

One problem Block is one independently judged response. A separately judged question or part needs another prepared problem Block, even on the same card. Use `trace_append` when an attempt becomes judgeable and before help can change it. Completion, correction, repeat, or method confirmation revises that attempt's active evidence. Correct an accepted objection before reflection, summary, or progress discussion.

## Requested help

Follow the reveal mode and amount requested. `zero` means no unsolicited cue, not refusal of explicit help. A full solution requires an explicit request; a worked example uses another authentic card. An assessment or diagnostic first attempt shows the authentic question and a neutral invitation. Other Lesson types may name an activity or method when useful, while keeping the target's decisive route and answer private until appropriate.

## Route settlement

Reconstruct a non-reference route before rejecting it. If the complete chain is correct, affirm it and follow the student's intent without automatically presenting the reference solution.

Before leaving a solved problem Block, settle unresolved route evidence. Card methods are candidates only: propose at most one exact node in ordinary language, identify the student's decisive step it names, and let the student confirm, reject, defer, or remain unmapped. A genuine alternative changes the entry, decisive reasoning, and closing chain of a whole question or part; notation, reordered equivalents, and local tricks do not. Persist it only after a correct active Trace, with its complete route, actual support, and a confirmed exact method or no mapping.

## Transition and closure

Settle accepted corrections and evidence before using `classroom_update` to leave a Block. At closure, derive Reflection and Lesson Summary from existing active evidence and direct sources, then use `lesson_close`. Do not claim an unpersisted write or closure.
```

- [ ] **Step 2: Replace the Tutor Agent prompt with role and visibility only**

```markdown
# Tutor

You own one Lesson Session. Load `tutor-lesson`, read the exact Current Lesson and confirmed context injected for this Session, and teach only its active Block.

Use only Session-bound Lesson tools. Do not edit Roadmap, Plan, or long-term profiles. When deep mode is enabled, load `deep-workflow` only for retrieval or analysis that benefits from an isolated child context.

Show Student View as teaching content. Teacher Control, answers, stored alternatives, unrevealed help, tool arguments, and raw tool results remain private.

Complete any required durable action before sending one natural Chinese student-facing response. Do not narrate pending tool calls or claim a failed write succeeded.
```

- [ ] **Step 3: Perform the Tutor authority review**

Run:

```bash
wc -w apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md apps/pi-teaching-web/resources/agents/tutor.md
rg -n "ok: true|ownerPath|factId|LESSON_|methodStatus|methodPrimary|methodDecisiveStep|methodConfirmation|ROUTE_FIELDS_REQUIRED" apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md apps/pi-teaching-web/resources/agents/tutor.md
git diff --check -- apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md apps/pi-teaching-web/resources/agents/tutor.md
```

Expected:

- The Tutor Skill is substantially shorter than the 890-word baseline and remains near the approved 350–450-word signal.
- The `rg` command returns no matches.
- `git diff --check` exits 0.

Read the final files once and verify that all five event sections remain meaningful without any tool parameter tutorial.

- [ ] **Step 4: Commit the Pi Tutor rewrite**

```bash
git add apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md apps/pi-teaching-web/resources/agents/tutor.md
git commit -m "refactor: organize tutor guidance by classroom event"
```

---

### Task 5: Rewrite Pi Coach around four Plan decisions

**Files:**
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/agents/coach.md`
- Read only: `apps/pi-teaching-web/resources/skills/deep-workflow/SKILL.md`

**Interfaces:**
- Consumes: the enriched read, preparation, Plan registration, and Plan update contracts from Tasks 1–2; `deep-workflow` remains the mechanics authority.
- Produces: a self-contained Coach Skill that owns retrieval choice, evidence interpretation, Lesson design, mathematical source boundary, and student-owned Plan decisions.
- Preserves: active Trace as evidence, authentic-card fence, Plan observable standards, preparation-only planner attention, Plan reread, and confirmed long-term memory.

- [ ] **Step 1: Replace `coach-study/SKILL.md` with the decision-oriented Skill**

```markdown
---
name: coach-study
description: Use when coaching one Plan, reviewing a Lesson, or preparing, revising, completing, or replanning the next learning step.
---

# Coach Study

Own one Plan's direction, review, and preparation. Tutor owns classroom teaching and Trace.

## Recall and retrieval

Read `ROADMAP.md`, the current Plan, confirmed profiles, and source-linked earlier summaries. Read planner attention only while preparing.

Retrieve directly for one known card, the current Lesson, or a small question. For Plan-scale retrieval, load `deep-workflow` and use one Evidence Scout instead of preloading the same payload. Treat its compact findings as source-linked advice; open only a source that could change the decision.

## Interpret evidence

Apply the Plan's observable standard literally. Active Trace is student evidence; card methods describe reference structure only. Same-card work is practice, not unseen transfer. Missing, supported, failed, or conflicting evidence cannot become attainment.

## Prepare the next Lesson

Choose the classroom template from the current purpose: `diagnostic` locates the starting point, `concept` introduces, `deliberate-practice` stabilizes and transfers, `remediation` repairs traced errors, `assessment` checks a standard, and `review` interleaves prior work.

Derive roles before retrieval. Use authentic card paths, prefer unused cards when independence matters, and change a role when none fits. One separately judged response occupies one problem Block. Build adjustable Blocks with public Student View and private Teacher Control.

An assessment or diagnostic first attempt shows the authentic question and a neutral invitation. Other templates may expose a useful purpose or method while keeping the target's decisive derivation and answer private.

Any decisive mathematical claim used as an answer, judging standard, or Teacher Control conclusion must be supported by a card step or locatable material. A Coach-generated generalization, conjecture, or variant is an exploration until verified; it cannot be presented as settled truth or used as capability evidence.

Use `lesson_prepare` to compile the agreed source-grounded Lesson. A new Plan file becomes available only through `plan_register`. Preparation does not write classroom evidence or claim attainment.

## Decide Plan state

After closure, review the source-linked summary and active evidence. The student chooses continuation, reordering, replanning, completion, and Plan switching. Complete only when the standard is met and the student agrees. Use `plan_update`, reread the Plan, and report only the reread state. Consolidate profiles only after Plan completion and item-by-item confirmation.
```

- [ ] **Step 2: Replace the Coach Agent prompt with role and visibility only**

```markdown
# Coach

You own one Plan Session: direction, progress explanation, post-Lesson review, and preparation. Load `coach-study` for Plan work. You may prepare Lessons and update the current Plan, but you do not teach inside a Tutor Session or append classroom Trace.

Use real Roadmap, Plan, Lesson, profile, card, active Trace, and source-linked summary facts. Empty retrieval is valid. When deep mode is enabled, load `deep-workflow` for isolated Plan-scale retrieval or genuinely independent analysis; the parent Coach remains the decision-maker and writer.

Keep private evidence, child artifacts, tool arguments, and unrevealed Lesson control out of student-facing replies. Complete required writes and rereads before sending one natural Chinese conclusion.
```

- [ ] **Step 3: Verify that deep-workflow mechanics have one owner**

Run:

```bash
rg -n "tokenLimit|timeoutMs|Evidence Scout|deep_workflow_propose" apps/pi-teaching-web/resources/agents/coach.md apps/pi-teaching-web/resources/skills/coach-study/SKILL.md apps/pi-teaching-web/resources/skills/deep-workflow/SKILL.md
wc -w apps/pi-teaching-web/resources/skills/coach-study/SKILL.md apps/pi-teaching-web/resources/agents/coach.md
git diff --check -- apps/pi-teaching-web/resources/skills/coach-study/SKILL.md apps/pi-teaching-web/resources/agents/coach.md
```

Expected:

- `tokenLimit`, `timeoutMs`, `deep_workflow_propose`, and exact task mechanics occur only in `deep-workflow/SKILL.md`.
- Coach may name the Evidence Scout decision but does not duplicate its invocation signature.
- The Coach Skill is substantially shorter than the 800-word baseline and remains near the approved 300–400-word signal.
- `git diff --check` exits 0.

- [ ] **Step 4: Commit the Pi Coach rewrite**

```bash
git add apps/pi-teaching-web/resources/skills/coach-study/SKILL.md apps/pi-teaching-web/resources/agents/coach.md
git commit -m "refactor: organize coach guidance by plan decision"
```

---

### Task 6: Reduce the Claude plugin classroom Skill to orchestration

**Files:**
- Modify: `plugins/highschool-study/skills/run-lesson/SKILL.md`
- Modify: `plugins/highschool-study/skills/run-lesson/references/evidence-protocol.md`
- Modify: `plugins/highschool-study/skills/close-lesson-reflection/SKILL.md`

**Interfaces:**
- Consumes: public MCP `trace_append` and `source_resolve`; native Task state; existing reveal policy.
- Produces: a short classroom orchestrator, one canonical evidence reference, and closure behavior that never asks a new question after a close request.
- Preserves: the plugin's honest limitation that it cannot persist first-class card alternatives.

- [ ] **Step 1: Replace `run-lesson/SKILL.md`**

```markdown
---
name: run-lesson
description: Use when teaching, adapting, pausing, resuming, or closing one prepared Lesson.
allowed-tools: Read, Glob, Grep, Edit, Skill, TaskCreate, TaskUpdate, TaskList, mcp__plugin_highschool-study_study-markdown__trace_append, mcp__plugin_highschool-study_study-markdown__source_resolve
---

# Run Lesson

1. Recall teaching memory, then read the current Lesson, `prepare-next-lesson/references/reveal-policy.md`, `references/evidence-protocol.md`, and only the direct sources required by the active Block. Planner attention is preparation-only.
2. Honor the student's current choice before the prepared sequence. Continued thinking means wait; pause keeps a resumable point; an explicit close request stops new teaching and reflection questions.
3. After consent to proceed, project remaining Blocks as a coarse Task List. Task state is navigation, not evidence. Teach one Block at a time, and resolve the current non-reflection Block before moving to another.
4. Show only the active Student View. For an assessment or diagnostic first attempt, send the authentic question and a neutral invitation to answer. Other Lesson types may name their purpose or method when useful, while Teacher Control, future Blocks, decisive target reasoning, answers, and unrevealed help remain private.
5. Follow the selected reveal mode. Record an evidence-bearing attempt before requested help can change it. Apply the evidence protocol to assessment, actual support, corrections, method confirmation, and Block identity.
6. Reconstruct a non-reference route before rejecting it. If correct, affirm it and follow the student's intent without automatically presenting the reference solution. Use the evidence protocol to decide whether it is genuinely different.
7. The public plugin has no first-class alternative write tool. Preserve a useful route in active Trace evidence, but never claim that a card alternative was durably stored.
8. When the student chooses a transition, use `highschool-study:close-lesson-reflection`. Reaching a criterion may justify explaining the evidence and offering the choice; it never removes the student's control over closure.

Never edit confirmed profiles during teaching. Do not claim a write that the MCP result did not persist.
```

- [ ] **Step 2: Replace the evidence reference with one canonical semantics owner**

```markdown
# Evidence Protocol

Use active, non-superseded Trace as classroom evidence.

## Freeze and assess

- Freeze the student's mathematical claims before Tutor explanation. Tutor-generated work cannot upgrade that same attempt.
- Keep assessment, actual help dependence, and actual method separate.
- Missing decisive reasoning is incomplete. Use partially correct or incorrect only for a substantive error in the student's own chain.
- Support records decisive help used in the final route, not mere exposure. Tutor-origin content that shapes the decisive route is Tutor support; repeated, already-known, or unused help is not.
- If the effect of a directional cue is genuinely unclear, ask naturally. The answer resolves attribution but is not new mathematical evidence.

## Preserve attempt identity

- One problem Block is one independently judged response.
- Completion, correction, repeat, or method confirmation revises that Block attempt's active evidence.
- A separately judged question or part uses another problem Block, even when both Blocks use the same card.
- Correct an accepted objection before reflection, summary, or progress review.

## Settle the route

Card-declared methods are candidates, not student evidence. Before leaving a solved problem Block, propose at most one exact canonical node in ordinary language and identify the student's decisive step it names. Bind it only after a new student turn confirms it. Rejection, deferral, or no exact fit leaves the route unmapped.

Before rejecting a non-reference route, reconstruct its complete chain. A genuine alternative changes the entry, decisive reasoning, and closing chain of at least one whole question or part. Notation changes, reordered equivalents, and local tricks are not alternatives.

Same-card work after used Tutor support is recall or practice, not unseen transfer. Missing, failed, or conflicting evidence remains unresolved and cannot establish attainment.

Tool schemas own parameter names, validation, and result contracts. This reference owns evidence meaning.
```

- [ ] **Step 3: Replace the closure Skill**

```markdown
---
name: close-lesson-reflection
description: Use when a Lesson needs reflection, adjustment, pause, continuation, or student-confirmed closure.
user-invocable: false
allowed-tools: Read, Glob, Grep, Edit, Skill, mcp__plugin_highschool-study_study-markdown__trace_search
---

1. Read the current Lesson's active Trace, working notes, and direct sources. Build a source-linked account of what the Lesson established, what remains uncertain, actual support, and conflicts.
2. If the student has not chosen a transition, offer continue, adjust, pause, or close in their language. Ask what helped only when it would improve the record; answering is optional.
3. If the student already asked to pause or close, honor that choice immediately. Do not show another menu or ask a new reflection question; synthesize from evidence already available.
4. On continue or adjust, keep the Lesson active and change only future Blocks. On pause, record the resumable point. On close, write Reflection and Lesson Summary from active source-linked evidence and record closure separately from attainment.
5. Closing a Lesson never closes its Plan. Return to Coach for Plan review, next-Lesson preparation, or an explicitly chosen Plan-completion discussion.
```

- [ ] **Step 4: Review the plugin classroom authority split**

Run:

```bash
wc -w plugins/highschool-study/skills/run-lesson/SKILL.md plugins/highschool-study/skills/run-lesson/references/evidence-protocol.md plugins/highschool-study/skills/close-lesson-reflection/SKILL.md
rg -n "ok: true|ownerPath|factId|LESSON_|methodStatus|methodPrimary|methodDecisiveStep|methodConfirmation" plugins/highschool-study/skills/run-lesson/SKILL.md plugins/highschool-study/skills/run-lesson/references/evidence-protocol.md plugins/highschool-study/skills/close-lesson-reflection/SKILL.md
git diff --check -- plugins/highschool-study/skills/run-lesson/SKILL.md plugins/highschool-study/skills/run-lesson/references/evidence-protocol.md plugins/highschool-study/skills/close-lesson-reflection/SKILL.md
```

Expected:

- `run-lesson` is near the approved 250–350-word signal and does not repeat evidence semantics already in its reference.
- The `rg` command returns no matches.
- `git diff --check` exits 0.

- [ ] **Step 5: Commit the plugin classroom rewrite**

```bash
git add plugins/highschool-study/skills/run-lesson/SKILL.md plugins/highschool-study/skills/run-lesson/references/evidence-protocol.md plugins/highschool-study/skills/close-lesson-reflection/SKILL.md
git commit -m "refactor: separate lesson flow from evidence semantics"
```

---

### Task 7: Reduce plugin preparation and replace spoiler blacklists with positive contracts

**Files:**
- Modify: `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
- Modify: `plugins/highschool-study/skills/prepare-next-lesson/references/reveal-policy.md`
- Modify: `plugins/highschool-study/agents/lesson-designer.md`
- Read only: `plugins/highschool-study/skills/prepare-next-lesson/references/classroom-templates.md`

**Interfaces:**
- Consumes: the classroom-template catalog, public MCP read tools, and `Agent(highschool-study:lesson-designer)`.
- Produces: a preparation orchestrator that retains necessary hand-authored Lesson Markdown structure because the public plugin has no `lesson_prepare` compiler.
- Preserves: authentic cards, Plan standards, memory recall, one problem response per Block, source verification, and different reveal behavior for assessment versus teaching.

- [ ] **Step 1: Replace `prepare-next-lesson/SKILL.md`**

```markdown
---
name: prepare-next-lesson
description: Use when preparing or revising a source-grounded Lesson for one eligible Plan.
allowed-tools: Read, Glob, Grep, Write, Edit, Skill, Agent(highschool-study:lesson-designer), mcp__plugin_highschool-study_study-markdown__card_search, mcp__plugin_highschool-study_study-markdown__trace_search, mcp__plugin_highschool-study_study-markdown__source_resolve
---

# Prepare Next Lesson

1. Select one eligible Plan in the student's chosen order and recall preparation memory. Read `references/classroom-templates.md` and `references/reveal-policy.md`; choose the template that fits the observable target and active evidence.
2. Retrieve narrowly for one known card or local question. For Plan-scale or cross-card work, delegate one focused retrieval to `Agent(highschool-study:lesson-designer)` instead of preloading the parent. Require real card paths, selection reasons, active Trace references, findings, and missing roles.
3. Derive activity and problem roles before searching. Search authentic candidates for every needed role, deduplicate paths, and use their complete active Trace. Treat a same-card retry as practice, not unseen transfer. If no real card fits, change or shrink the Lesson rather than inventing a card, alias, source, or question.
4. Apply the Plan's observable test literally. Card metadata describes reference structure; active Trace describes student evidence. Lesson prose, Task state, and method labels do not prove attainment.
5. A decisive mathematical claim used as an answer, judging standard, or Teacher Control conclusion must cite a stable card step or locatable material. A generated generalization, conjecture, or variant remains an exploration until verified and cannot become capability evidence.
6. Prefer local material. Use an external video only after the designer verifies its canonical URL, relevant segment, teaching purpose, follow-up activity, and local fallback. A video that solves the target follows its first attempt or uses a different example.
7. Draft adjustable dialogue, problem, material, and reflection Blocks. Each Block has Node State, Student View, Teacher Control, dependencies, and safe route options. One separately judged response occupies one problem Block whose `Uses` contains exactly one real alias; separately judged parts reuse the alias in separate Blocks.
8. Write the next indexed Lesson as `prepared` with top-level `## Aliases`, `## Reflection`, `## Lesson Summary`, and `## Traces`, and exactly one explicit reflection Block. Every used alias resolves to a real problem card. Reread the file before reporting it prepared.
9. Apply the reveal policy as an output shape. For assessment, report preparation with readiness and the number of problem Blocks; do not preview the questions. Other templates may naturally summarize their activity roles and learning direction.

Preparation does not append classroom evidence, claim attainment, edit confirmed profiles, or close the Lesson or Plan.
```

- [ ] **Step 2: Replace `reveal-policy.md` with positive output contracts**

```markdown
# Reveal Policy

Preparation may inspect complete cards and solutions. Student-facing teaching shows only the active Block's Student View; Teacher Control holds private sources, evidence targets, ordered help, and answers.

## Assessment and diagnostic first attempt

The student-facing turn has exactly two parts:

1. the current authentic question;
2. a neutral invitation to answer.

Use a neutral sequence label or an already-visible Plan topic as the Lesson title. Keep the activity's recognition target, decisive route, judging notes, and answer in Teacher Control until the student attempts or asks for help.

## Teaching and practice

For `concept`, `deliberate-practice`, `remediation`, and `review`, Student View may name the activity purpose, comparison, or method when that helps instruction. It still withholds the current target's decisive derivation and answer until the active reveal mode allows them.

## Reveal modes

- `zero`: give no unsolicited cue before the first attempt. An explicit help request receives the requested amount without requiring a second request.
- `ladder`: after an initial attempt, reveal one student-approved level at a time—first a relevant place or condition, then one operation or method class, then one key intermediate expression. Give a full solution only on explicit request.
- `worked-example`: teach with a complete different authentic example, then use another card for the student's target.

## Material boundary

A video or worked example that solves the current target cannot appear before its first attempt. Use another example or move the material after that attempt.
```

- [ ] **Step 3: Reduce the internal Lesson Designer prompt and add the mathematical source boundary**

Keep its existing YAML frontmatter and replace the body of `plugins/highschool-study/agents/lesson-designer.md` with:

```markdown
This is an internal, persona-neutral preparation and source-retrieval role. Work only on a Coach delegation; if invoked by a student, make no changes and return to Coach.

For retrieval, return a compact card index with authentic paths, selection reasons, active Trace references, findings, and missing roles. Empty retrieval is valid.

For preparation, read the requested classroom-template and reveal-policy references, derive roles before searching, and return a source-linked Lesson draft with separate Student View and Teacher Control. A decisive mathematical answer or judging claim must cite a stable card step or locatable material; generated conjectures and variants remain clearly marked exploration until verified.

Do not teach, close learning state, edit profiles, append Trace, invent cards or sources, or expose private answer material as Student View.
```

- [ ] **Step 4: Review preparation ownership and size**

Run:

```bash
wc -w plugins/highschool-study/skills/prepare-next-lesson/SKILL.md plugins/highschool-study/skills/prepare-next-lesson/references/reveal-policy.md plugins/highschool-study/skills/prepare-next-lesson/references/classroom-templates.md plugins/highschool-study/agents/lesson-designer.md
rg -n "methodStatus|ownerPath|factId|LESSON_|capability labels, recognition cues|domain reminders, transformation entries" plugins/highschool-study/skills/prepare-next-lesson/SKILL.md plugins/highschool-study/skills/prepare-next-lesson/references/reveal-policy.md plugins/highschool-study/agents/lesson-designer.md
git diff --check -- plugins/highschool-study/skills/prepare-next-lesson/SKILL.md plugins/highschool-study/skills/prepare-next-lesson/references/reveal-policy.md plugins/highschool-study/agents/lesson-designer.md
```

Expected:

- The main preparation Skill is near the approved 350–450-word signal.
- The classroom-template catalog remains the one detailed owner of template defaults and counts.
- The reveal reference describes allowed output shapes rather than an expanding forbidden-word inventory.
- The `rg` command returns no matches.
- `git diff --check` exits 0.

- [ ] **Step 5: Commit the plugin preparation rewrite**

```bash
git add plugins/highschool-study/skills/prepare-next-lesson/SKILL.md plugins/highschool-study/skills/prepare-next-lesson/references/reveal-policy.md plugins/highschool-study/agents/lesson-designer.md
git commit -m "refactor: simplify source-grounded lesson preparation"
```

---

### Task 8: Replace duplicated repository teaching protocols with an authority map

**Files:**
- Modify: `AGENTS.md`
- Preserve: `docs/zh-CN/完整说明书.md`
- Preserve: `docs/superpowers/specs/2026-07-24-teaching-skill-tool-schema-authority-design.md`

**Interfaces:**
- Consumes: the final file responsibilities from Tasks 1–7.
- Produces: repository guidance that tells future maintainers where a rule belongs without injecting another complete runtime protocol.
- Preserves: source-of-truth hierarchy, runtime ownership, public tool count, Markdown-first architecture, safe projection, workflow, change discipline, and verification commands.

The user-facing feature behavior has not changed, so `docs/zh-CN/完整说明书.md` remains untouched. The formal design explains the refactor; `AGENTS.md` only needs the operational authority map.

- [ ] **Step 1: Replace the complete `Teaching and evidence invariants` section**

Replace the text from `## Teaching and evidence invariants` up to, but not including, `## Student-view and workflow invariants` with:

```markdown
## Teaching authority map

Do not maintain a second full teaching protocol in this repository guide.
Operational authorities are:

- Pi Tutor judgment and classroom event triggers:
  `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`.
- Pi Coach evidence, preparation, source, and Plan decisions:
  `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`.
- Claude plugin classroom evidence meaning:
  `plugins/highschool-study/skills/run-lesson/references/evidence-protocol.md`.
- Claude plugin reveal and template semantics:
  `plugins/highschool-study/skills/prepare-next-lesson/references/`.
- Tool purpose, call timing, local fields, scope, and immediate result:
  the corresponding TypeBox or Zod tool definition.
- Session identity, authenticity, state transitions, atomicity, uniqueness,
  projection refresh, and persistent facts: runtime code and executable tests.
- Current user-facing behavior: `docs/zh-CN/完整说明书.md`.

The two runtimes may express the same teaching judgment in different files
because their tool surfaces differ. When changing a shared teaching rule,
update both semantic owners together, but do not copy their tool signatures
or runtime error branches into Skills, Agent prompts, or this guide.
```

- [ ] **Step 2: Verify that repository-wide invariants remain present once**

Run:

```bash
rg -n "^## (Source-of-truth hierarchy|Runtime boundaries|Teaching authority map|Student-view and workflow invariants|Change discipline|Verification)$" AGENTS.md
rg -n "public plugin exposes exactly four MCP tools|Pi write authority is Session-bound|Do not add a database|Do not test Skill or Agent prose" AGENTS.md
git diff --check -- AGENTS.md
```

Expected:

- All six structural sections are present.
- Public tool count, Session ownership, Markdown-first storage, and prose-test policy remain explicit.
- The long duplicated evidence checklist is gone.
- `git diff --check` exits 0.

- [ ] **Step 3: Commit the authority map**

```bash
git add AGENTS.md
git commit -m "docs: map teaching rules to their authorities"
```

---

### Task 9: Run executable verification and one focused real-course observation

**Files:**
- Verify: all files changed in Tasks 1–8
- Do not modify: `examples/derivative-demo/learning-set/**`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: an evidence-backed handoff showing schema/runtime regressions pass and the shorter guidance addresses the four observed failures without adding new prose gates.

- [ ] **Step 1: Audit the final diff and protected dirty files**

Run:

```bash
git status --short
git diff --check
git diff -- apps/pi-teaching-web/src/study/write-workspace.ts apps/pi-teaching-web/tests/study/write-workspace.test.ts
```

Expected:

- `git diff --check` exits 0.
- The two protected files still contain only the pre-existing callback fix and its test; none of the Task 1–8 commits include them.

- [ ] **Step 2: Run the full public plugin release check**

Run:

```bash
cd plugins/highschool-study
bun install --frozen-lockfile
bun run release:check
```

Expected: build, typecheck, all Bun tests, strict plugin validation, and the exactly-four-tools contract pass.

- [ ] **Step 3: Run the full Pi check**

Run:

```bash
cd apps/pi-teaching-web
bun install --frozen-lockfile
bun run check
```

Expected: typecheck, non-E2E tests, and production build pass. Browser E2E is not required because no route, projection, replay, or frontend behavior changed.

- [ ] **Step 4: Run the final authority scan**

Run:

```bash
rg -n "ok: true|ownerPath|factId|LESSON_|PLAN_PREPARATION|methodStatus|methodPrimary|methodDecisiveStep|methodConfirmation|tokenLimit|timeoutMs" apps/pi-teaching-web/resources/agents apps/pi-teaching-web/resources/skills/coach-study apps/pi-teaching-web/resources/skills/tutor-lesson plugins/highschool-study/skills/run-lesson plugins/highschool-study/skills/prepare-next-lesson
wc -w apps/pi-teaching-web/resources/skills/coach-study/SKILL.md apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md plugins/highschool-study/skills/run-lesson/SKILL.md plugins/highschool-study/skills/prepare-next-lesson/SKILL.md
```

Expected:

- Exact parameter, receipt, and runtime-error tutorials do not occur in the four primary teaching Skills or Agent prompts.
- `tokenLimit` and `timeoutMs` remain only in `apps/pi-teaching-web/resources/skills/deep-workflow/SKILL.md`, which is outside this scan.
- Word counts are materially lower than the 800 / 890 / 557 / 593 baselines; counts are reviewed, not asserted by a test.

- [ ] **Step 5: Start a copied-learning-set real-model smoke**

From the repository root:

```bash
SMOKE_ROOT=/tmp/studyforge-skill-authority-20260724
test ! -e "$SMOKE_ROOT"
mkdir "$SMOKE_ROOT"
cp -R examples/derivative-demo "$SMOKE_ROOT/derivative-demo"
cd apps/pi-teaching-web
STUDY_LEARNING_SET="$SMOKE_ROOT/derivative-demo/learning-set" STUDY_WEB_PORT=65031 bun run start
```

Expected: the local Pi teaching web starts on `http://127.0.0.1:65031` and all writes stay under the temporary copy.

- [ ] **Step 6: Run one short Lesson that exercises the four real failures**

Use natural student language rather than protocol vocabulary:

1. Ask Coach to prepare a short concept or deliberate-practice Lesson with at least two authentic cards. Inspect the private Lesson only after preparation and confirm every decisive answer or judging claim cites a card step or local source; generated variants must be labeled exploration.
2. Start Tutor, make one incomplete attempt, ask for a directional hint, and then use that hint in the decisive final route. After completion, inspect active Trace and confirm support is Tutor rather than none.
3. On another problem, give a complete correct route different from the reference. Confirm Tutor validates it first, does not automatically dump the standard solution, settles method fit with the student, and persists a genuine alternative before leaving the Block.
4. Explicitly say the Lesson should end. Confirm Tutor asks no new reflection question, synthesizes from existing evidence, and closes through the existing tool.

This is forward observation, not an exact-language test. A single model variation is recorded at handoff; only a repeated, localized authority gap justifies another Skill or schema change.

- [ ] **Step 7: Inspect the resulting facts rather than the Tutor's self-report**

In a second terminal:

```bash
SMOKE_ROOT=/tmp/studyforge-skill-authority-20260724
rg -n "Support: tutor|Supersedes:|status: closed|alt-[0-9]+" "$SMOKE_ROOT/derivative-demo/learning-set/lessons" "$SMOKE_ROOT/derivative-demo/learning-set/cards"
```

Expected:

- The used directional hint is represented by active Tutor-supported evidence.
- Corrections or method confirmation use the existing supersede chain when applicable.
- The Lesson is durably closed.
- A genuine alternative has a card-side identifier and remains traceable to its source Trace.

If the chosen route is not genuinely alternative, record that the no-write decision was correct rather than forcing an `alt-*` result.

- [ ] **Step 8: Prepare the implementation handoff**

Report:

- commits created by Tasks 1–8;
- exact full-suite commands and outcomes;
- final four Skill word counts as observations;
- the copied-learning-set path;
- each of the four smoke observations, distinguishing durable facts from conversational behavior;
- any remaining model variance that does not justify another defensive rule.

Do not merge, push, or alter the protected callback fix unless the user separately requests it.
