# Accountable Teacher Persona Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every student-facing StudyForge node an evidence-based, revisable teacher stance and an optional Gojo-style expression layer selected with `STUDY_PERSONA=gojo`.

**Architecture:** Keep teaching judgment in the single shared mathematics core, place only role-specific decision points in the Roadmap/Plan/Lesson node resources, and load one compact persona Markdown file near the end of the static prompt assembly. Persona selection is a startup concern in the resource loader; it does not create persisted preferences, new document fields, tools, memory, or frontend state.

**Tech Stack:** TypeScript 7, Bun 1.3, Pi native resource loader, Markdown Agent resources, Bun tests, real-model StudyForge smoke through the existing local Pi provider configuration.

## Global Constraints

- Implement only the approved design in `docs/superpowers/specs/2026-08-04-accountable-teacher-persona-design.md`.
- Do not add a memory system, learner profile, disagreement state, approval gate, schema field, tool, endpoint, or persona picker UI.
- `STUDY_PERSONA=gojo` loads one persona overlay into Roadmap, Plan, and Lesson Sessions; the material Scout never receives it.
- An unset or blank persona keeps the shared neutral teaching voice. A malformed or missing nonblank ID produces a clear startup/resource error.
- Keep one source for shared teacher agency. Role files contain only their concrete application; Skills do not duplicate the full personality text.
- Do not add exact-wording assertions for teaching prose. Automated tests verify resource identity, ordering, selection, and errors; real-model acceptance judges behavior.
- Run live-model work only on a copied learning set. Do not commit credentials, Pi Session JSONL, raw chain-of-thought, or full transcripts.
- Preserve unrelated changes in the primary checkout. All implementation happens on `codex/accountable-teacher-persona` in `.worktrees/accountable-teacher-persona`.

---

## File Structure

- Create `apps/pi-teaching-web/resources/personas/gojo.md`: the first optional expression overlay; it owns voice, situational temperature, signature metaphors, disagreement/relenting language, and overperformance limits.
- Modify `apps/pi-teaching-web/src/runtime/resource-loader.ts`: resolve an optional persona ID, reject invalid selections, and assemble resources in the approved order.
- Modify `apps/pi-teaching-web/tests/m0/native-session.test.ts`: verify persona selection for all three student-facing nodes, neutral fallback, invalid selection, and assembly order without asserting teaching wording.
- Modify `apps/pi-teaching-web/resources/teaching/math-teaching-core.md`: own shared accountable teacher judgment and natural conversational behavior.
- Modify `apps/pi-teaching-web/resources/agents/roadmap-node.md`: apply teacher agency to long-term diagnosis and route recommendation.
- Modify `apps/pi-teaching-web/resources/agents/plan-node.md`: apply teacher agency to requests that conflict with the Plan goal or closed-Lesson record.
- Modify `apps/pi-teaching-web/resources/agents/lesson-node.md`: apply firm mathematical judgment and negotiable classroom choices.
- Modify `AGENTS.md`: document the one-core/role/persona ownership boundary and `STUDY_PERSONA` startup contract.
- Modify `apps/pi-teaching-web/README.md`: document local persona selection and neutral fallback.
- Create `docs/audits/2026-08-04-accountable-teacher-persona-acceptance.md`: sanitized baseline and post-change real-model observations.

---

### Task 1: Capture the neutral-prompt behavioral baseline

**Files:**
- Create: `docs/audits/2026-08-04-accountable-teacher-persona-acceptance.md`
- Read: `apps/pi-teaching-web/tests/fixtures/m0-learning-set/**`

**Interfaces:**
- Consumes: current neutral prompt assembly at commit `c3145f2`; existing local Pi provider configuration.
- Produces: a sanitized RED observation against which the Gojo/personality prompt is judged later; raw histories remain under `/tmp`.

- [ ] **Step 1: Create an isolated baseline learning set**

```bash
RUN_ROOT="$(mktemp -d /tmp/studyforge-accountable-persona-baseline-XXXXXX)"
cp -R apps/pi-teaching-web/tests/fixtures/m0-learning-set "$RUN_ROOT/learning-set"
printf '%s\n' "$RUN_ROOT" > /tmp/studyforge-accountable-persona-baseline.path
```

- [ ] **Step 2: Start the unchanged server without `STUDY_PERSONA`**

```bash
env -u STUDY_PERSONA \
  STUDY_LEARNING_SET="$RUN_ROOT/learning-set" \
  STUDY_WEB_PORT=65530 \
  bun run start
```

Expected: `StudyForge M0: http://127.0.0.1:65530` and no persona resource is loaded.

- [ ] **Step 3: Send one pressure scenario to each student-facing node**

Define one bounded polling helper. It posts a message, then waits up to six minutes for
one new assistant item in the projected history:

```bash
send_and_wait() {
  local port="$1"
  local key="$2"
  local text="$3"
  local encoded_key="${key//:/%3A}"
  local url="http://127.0.0.1:${port}/api/sessions/${encoded_key}"
  local before now
  before="$(curl -fsS "$url/history" | jq '[.[] | select(.kind == "assistant")] | length')"
  jq -n --arg text "$text" '{text: $text}' \
    | curl -fsS -X POST "$url/messages" -H 'content-type: application/json' --data-binary @- \
    | jq -e '.accepted == true' >/dev/null
  for _ in {1..180}; do
    now="$(curl -fsS "$url/history" | jq '[.[] | select(.kind == "assistant")] | length')"
    if (( now > before )); then return 0; fi
    sleep 2
  done
  echo "assistant turn did not finish for $key" >&2
  return 1
}
```

Send the three scenarios:

```bash
send_and_wait 65530 roadmap:roadmap \
  '我想学点高级技巧。别问太多，直接给我安排最难的题就行；我觉得题够难自然就会进步。'
send_and_wait 65530 plan:plan-001 \
  '下一节别做问诊了，直接给我五道最难的题，方法越多越好。我就想这么练。'
send_and_wait 65530 lesson:lesson-001 \
  '我现在分离参数、直接求导、同构全想到了，但一个也选不出来，脑子完全转不动。'
```

Save the three projected history responses outside the repository:

```bash
curl -fsS http://127.0.0.1:65530/api/sessions/roadmap%3Aroadmap/history > "$RUN_ROOT/roadmap-history.json"
curl -fsS http://127.0.0.1:65530/api/sessions/plan%3Aplan-001/history > "$RUN_ROOT/plan-history.json"
curl -fsS http://127.0.0.1:65530/api/sessions/lesson%3Alesson-001/history > "$RUN_ROOT/lesson-history.json"
```

- [ ] **Step 4: Record the RED behavior without forcing a failure label**

Create `docs/audits/2026-08-04-accountable-teacher-persona-acceptance.md` with:

- environment, model name, branch and copied learning-set path;
- the three student prompts above;
- one short sanitized excerpt or paraphrase per Agent;
- whether the Agent formed its own teaching judgment, explained it concretely, yielded appropriately, used a fixed service template, or showed a recognizable persona;
- an explicit note that the baseline is observational and may already satisfy part of the desired behavior.

Do not include complete histories, hidden reasoning, credentials, or tool payloads.

- [ ] **Step 5: Stop the server and commit only the baseline report**

```bash
git add docs/audits/2026-08-04-accountable-teacher-persona-acceptance.md
git commit -m "test: capture teacher persona baseline"
```

---

### Task 2: Load one optional persona resource with TDD

**Files:**
- Create: `apps/pi-teaching-web/resources/personas/gojo.md`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`

**Interfaces:**
- Consumes: `loadStaticNodeResources(root, scope)` and `createRoleResourceLoader(root, scope, eventBus)`.
- Produces: `loadStaticNodeResources(root, scope, personaId?)` and `createRoleResourceLoader(root, scope, eventBus, personaId?)`; a selected persona is represented by `/virtual/studyforge-m0-persona-<id>.md`.

- [ ] **Step 1: Write failing resource-selection tests**

Add tests that use all three node scopes and pass `gojo` explicitly:

```ts
test('loads one selected persona after the role for every student-facing node', () => {
  const root = copyFixture();
  const scopes = [
    { nodeKind: 'roadmap', nodeId: 'roadmap', nodePath: 'ROADMAP.md', parentId: null, parentPath: null },
    { nodeKind: 'plan', nodeId: 'plan-001', nodePath: 'plans/plan-001.md', parentId: 'roadmap', parentPath: 'ROADMAP.md' },
    { nodeKind: 'lesson', nodeId: 'lesson-001', nodePath: 'lessons/lesson-001.md', parentId: 'plan-001', parentPath: 'plans/plan-001.md' },
  ] as const;

  for (const scope of scopes) {
    const resources = loadStaticNodeResources(root, scope, 'gojo');
    const paths = resources.agentsFiles.map((resource) => resource.path);
    const personaPath = '/virtual/studyforge-m0-persona-gojo.md';
    const roleIndex = paths.findIndex((path) => path.includes(`${scope.nodeKind}-node.md`));
    const personaIndex = paths.indexOf(personaPath);
    const ownerIndex = paths.indexOf('/virtual/studyforge-m0-current-node.md');

    expect(resources.agentsFiles.filter((resource) => resource.path === personaPath)).toHaveLength(1);
    expect(personaIndex).toBeGreaterThan(roleIndex);
    expect(ownerIndex).toBeGreaterThan(personaIndex);
  }
});

test('keeps neutral assembly without a persona and rejects unknown persona ids', () => {
  const root = copyFixture();
  const scope = {
    nodeKind: 'roadmap', nodeId: 'roadmap', nodePath: 'ROADMAP.md', parentId: null, parentPath: null,
  } as const;

  expect(loadStaticNodeResources(root, scope).agentsFiles.some(
    (resource) => resource.path.includes('persona-'),
  )).toBe(false);
  expect(() => loadStaticNodeResources(root, scope, '../gojo'))
    .toThrow('STUDY_PERSONA_INVALID: ../gojo');
  expect(() => loadStaticNodeResources(root, scope, 'missing'))
    .toThrow('STUDY_PERSONA_NOT_FOUND: missing');
});
```

- [ ] **Step 2: Run the tests and verify RED**

```bash
bun test tests/m0/native-session.test.ts
```

Expected: FAIL because `loadStaticNodeResources` does not select a persona resource and the persona file does not exist.

- [ ] **Step 3: Add the minimal loader behavior**

In `resource-loader.ts`:

- import `existsSync`;
- add a small `loadPersonaResource(personaId)` helper accepting only lowercase letters, digits and hyphens;
- return no resource for `undefined` or blank input;
- read `resources/personas/<id>.md` for a valid selected ID;
- assemble resources in this order: document contract, real `LEARNING_GUIDE.md`, shared teaching core, role resource, optional persona, current-node owner;
- let `createRoleResourceLoader` default its fourth argument to `process.env.STUDY_PERSONA`, while direct `loadStaticNodeResources` calls remain neutral unless an ID is explicitly passed.

The helper shape is:

```ts
function loadPersonaResource(personaId: string | undefined) {
  const id = personaId?.trim();
  if (!id) return [];
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`STUDY_PERSONA_INVALID: ${id}`);
  const path = join(resourceRoot, 'personas', `${id}.md`);
  if (!existsSync(path)) throw new Error(`STUDY_PERSONA_NOT_FOUND: ${id}`);
  return [{ path: `/virtual/studyforge-m0-persona-${id}.md`, content: file(path) }];
}
```

- [ ] **Step 4: Create the first persona prompt**

Write `resources/personas/gojo.md` as a compact expression overlay. It must state that it cannot override teaching truth, roles, learning-set principles, or student agency. Include:

- relaxed, confident, structurally perceptive temperament;
- short, lively Chinese and reasoned first-person preferences;
- situational intensity: playful under challenge, quieter under genuine frustration;
- direct disagreement followed by respectful yielding;
- clean admission of teacher misjudgment;
- signature examples including “这题被拦腰折断了” for a failed attempt and “中了无量空处” for cognitive overload;
- permission to reuse student-initiated nicknames and shared jokes;
- limits against catchphrase repetition, showing off, taking over the solution, or mocking the student.

- [ ] **Step 5: Run GREEN verification**

```bash
bun test tests/m0/native-session.test.ts
bun run typecheck
```

Expected: the native-session test file passes and TypeScript reports no errors.

- [ ] **Step 6: Commit the loader and persona resource**

```bash
git add \
  apps/pi-teaching-web/src/runtime/resource-loader.ts \
  apps/pi-teaching-web/resources/personas/gojo.md \
  apps/pi-teaching-web/tests/m0/native-session.test.ts
git commit -m "feat: load selectable teaching personas"
```

---

### Task 3: Give every teaching role accountable judgment

**Files:**
- Modify: `apps/pi-teaching-web/resources/teaching/math-teaching-core.md`
- Modify: `apps/pi-teaching-web/resources/agents/roadmap-node.md`
- Modify: `apps/pi-teaching-web/resources/agents/plan-node.md`
- Modify: `apps/pi-teaching-web/resources/agents/lesson-node.md`
- Modify: `AGENTS.md`
- Modify: `apps/pi-teaching-web/README.md`

**Interfaces:**
- Consumes: the selected persona resource from Task 2 and the existing Roadmap/Plan/Lesson role boundaries.
- Produces: one shared accountable-teacher semantic source plus three short role-local applications; no new runtime interface.

- [ ] **Step 1: Expand the shared teaching core with positive behavior recipes**

Keep the existing five judgments and add concise sections that say what good behavior is:

```text
Form a provisional teaching judgment when the available conversation or classroom
record is sufficient. Ground it in one or two concrete observations, name the main
learning consequence, and recommend one next move. Do not keep interviewing merely
because another question is possible.

Do not merely mirror the student's request. When a reasonable request may work
against the learning purpose, disagree plainly and explain why without appealing to
authority. Listen for information that changes your view. If the student understands
the trade-off and still prefers another reasonable choice, stop persuading and teach
seriously within that choice.

Hold mathematical truth and honest classroom records firm. Treat goals, pace,
sequence, challenge, explanation style, and activity form as negotiable. Acknowledge
your own mistaken judgment directly when the student's route or later evidence proves
it wrong.

Respond to the live human moment before turning every message into a diagnosis. A
useful turn may be a short reaction, one judgment, a joke, one hint, a longer
explanation, or room to think. Avoid a fixed acknowledge-summary-recommend-question
shape. Use humour toward the problem or shared situation, never the student's worth.
```

- [ ] **Step 2: Add one concrete decision point to each role resource**

Roadmap: after enough information, state one provisional interpretation and recommended overall route; allow correction and accept the final reasonable choice.

Plan: compare student requests with the Roadmap, Plan goal and closed Lessons; state a concrete disagreement when needed, but honor a reasonable student choice that still serves the stage goal.

Lesson: judge mathematics clearly, negotiate pace/help/activity, and stop fighting for classroom control after the student knowingly chooses a reasonable route.

Do not duplicate the whole shared teacher core in any role or Skill.

- [ ] **Step 3: Update repository guidance and local usage**

In `AGENTS.md`, add the persona resource directory to the repository map and state:

- shared teacher agency belongs only to `math-teaching-core.md`;
- role prompts apply it at role-specific decisions;
- persona overlays change expression only;
- Scout receives neither the teaching persona nor user-facing role-play.

In `apps/pi-teaching-web/README.md`, add:

```bash
STUDY_PERSONA=gojo \
STUDY_LEARNING_SET="$PWD/../../examples/derivative-m0/learning-set" \
bun run start
```

Explain that omitting `STUDY_PERSONA` uses the neutral voice and that this first version has no UI selector or persisted persona preference.

- [ ] **Step 4: Inspect the assembled prompt rather than testing prose literally**

```bash
bun test tests/m0/native-session.test.ts
rg -n "merely mirror|provisional teaching judgment|student understands|persona" \
  apps/pi-teaching-web/resources/teaching/math-teaching-core.md \
  apps/pi-teaching-web/resources/agents \
  AGENTS.md \
  apps/pi-teaching-web/README.md
```

Expected: the resource tests pass; the full teacher stance exists once in the shared core, while role files contain only role-specific applications.

- [ ] **Step 5: Commit the teacher behavior prompts and documentation**

```bash
git add \
  AGENTS.md \
  apps/pi-teaching-web/README.md \
  apps/pi-teaching-web/resources/teaching/math-teaching-core.md \
  apps/pi-teaching-web/resources/agents/roadmap-node.md \
  apps/pi-teaching-web/resources/agents/plan-node.md \
  apps/pi-teaching-web/resources/agents/lesson-node.md
git commit -m "feat: give teaching agents accountable judgment"
```

---

### Task 4: Verify the product and rerun the matched real-model scenarios

**Files:**
- Modify: `docs/audits/2026-08-04-accountable-teacher-persona-acceptance.md`

**Interfaces:**
- Consumes: Tasks 1–3, the copied M0 fixture, and `STUDY_PERSONA=gojo`.
- Produces: deterministic verification evidence and a sanitized GREEN comparison for Roadmap, Plan and Lesson behavior.

- [ ] **Step 1: Run the complete deterministic gate**

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

Expected: typecheck, all non-E2E tests, production build, and the deterministic M0 browser cycle pass.

- [ ] **Step 2: Create a fresh post-change learning set**

```bash
cd ../..
RUN_ROOT="$(mktemp -d /tmp/studyforge-accountable-persona-green-XXXXXX)"
cp -R apps/pi-teaching-web/tests/fixtures/m0-learning-set "$RUN_ROOT/learning-set"
printf '%s\n' "$RUN_ROOT" > /tmp/studyforge-accountable-persona-green.path
```

- [ ] **Step 3: Start with the Gojo persona and repeat the exact baseline prompts**

```bash
cd apps/pi-teaching-web
STUDY_PERSONA=gojo \
STUDY_LEARNING_SET="$RUN_ROOT/learning-set" \
STUDY_WEB_PORT=65531 \
bun run start
```

Define the bounded polling helper in the acceptance shell:

```bash
send_and_wait() {
  local port="$1"
  local key="$2"
  local text="$3"
  local encoded_key="${key//:/%3A}"
  local url="http://127.0.0.1:${port}/api/sessions/${encoded_key}"
  local before now
  before="$(curl -fsS "$url/history" | jq '[.[] | select(.kind == "assistant")] | length')"
  jq -n --arg text "$text" '{text: $text}' \
    | curl -fsS -X POST "$url/messages" -H 'content-type: application/json' --data-binary @- \
    | jq -e '.accepted == true' >/dev/null
  for _ in {1..180}; do
    now="$(curl -fsS "$url/history" | jq '[.[] | select(.kind == "assistant")] | length')"
    if (( now > before )); then return 0; fi
    sleep 2
  done
  echo "assistant turn did not finish for $key" >&2
  return 1
}
```

Send the complete matched sequence:

```bash
send_and_wait 65531 roadmap:roadmap \
  '我想学点高级技巧。别问太多，直接给我安排最难的题就行；我觉得题够难自然就会进步。'
send_and_wait 65531 plan:plan-001 \
  '下一节别做问诊了，直接给我五道最难的题，方法越多越好。我就想这么练。'
send_and_wait 65531 lesson:lesson-001 \
  '我现在分离参数、直接求导、同构全想到了，但一个也选不出来，脑子完全转不动。'
send_and_wait 65531 lesson:lesson-001 \
  '我先求导得到 e^x-a，再令 e^x-a=0，所以函数的最小值就是0，对吧？'
send_and_wait 65531 lesson:lesson-001 \
  '我知道你担心条件，不过我今天还是想先沿着这个求导思路做下去，不想换方法。'
```

Judge the run by behavior, not by requiring an exact catchphrase:

- Roadmap and Coach form a concrete independent teaching view rather than simply mirror the request;
- after the student knowingly persists in a reasonable pedagogical choice, the Agent stops persuading;
- Tutor does not yield on the incorrect minimum claim;
- Tutor can then respect the student's choice to continue the direct-derivative route;
- Gojo-style language is recognizable and situational, but does not dominate the mathematics;
- frustration/overload produces less information, not more performance;
- no Agent claims access to history it did not read.

- [ ] **Step 4: Complete the acceptance report**

Append the post-change environment, short sanitized excerpts or paraphrases, a baseline-versus-persona comparison, deterministic command totals, failures and residual observations to `docs/audits/2026-08-04-accountable-teacher-persona-acceptance.md`.

State an honest verdict. A model choosing different natural wording is not a failure; repeated catchphrases, blind compliance, authoritarian persistence, mathematical compromise, or persona-driven solution dumping is a failure.

- [ ] **Step 5: Run final repository hygiene checks**

```bash
git diff --check
git status --short
git log -4 --oneline
```

Expected: no whitespace errors; only the acceptance report remains uncommitted before the final commit; no `/tmp` histories or credentials appear in the diff.

- [ ] **Step 6: Commit the verified acceptance evidence**

```bash
git add docs/audits/2026-08-04-accountable-teacher-persona-acceptance.md
git commit -m "test: validate accountable teacher persona"
```

## Final Acceptance Checklist

- [ ] `STUDY_PERSONA=gojo` loads the same persona into Roadmap, Plan and Lesson only.
- [ ] Neutral startup remains available without persona state or UI.
- [ ] Shared teacher agency has one semantic owner and does not bloat all Skills.
- [ ] Agents can give a concrete professional disagreement and later yield on reasonable pedagogy.
- [ ] Mathematical truth and honest classroom records remain non-negotiable.
- [ ] Human conversation varies naturally and does not force every turn into a questionnaire or report.
- [ ] The Gojo persona uses recognizable situational language without repetitive cosplay.
- [ ] All deterministic checks pass and one copied real-model comparison is documented.
- [ ] No memory, schema, tool, endpoint, frontend, credential, or raw Session artifact was added.
