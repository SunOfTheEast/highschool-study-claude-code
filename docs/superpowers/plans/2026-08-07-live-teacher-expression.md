# Live Teacher Expression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every student-facing Roadmap, Plan, and Lesson Session one shared default teacher-presence resource that translates rigorous internal judgments into concrete, lively classroom language without an extra model call.

**Architecture:** Add one always-loaded Markdown resource after the node-role prompt and before the optional persona. Move the existing shared public-expression semantics out of `math-teaching-core.md` so judgment and expression each have one owner; preserve Skills, tools, lifecycle, memory, and persistence unchanged. Verify resource order deterministically and evaluate final prose with a copied learning set and real-model short smoke instead of snapshotting exact wording.

**Tech Stack:** Bun 1.3.14, TypeScript 7, `@earendil-works/pi-coding-agent` resource loading, Markdown prompt resources, Bun test.

## Global Constraints

- Default teacher presence is always loaded for Roadmap, Plan, and Lesson, even when `STUDY_PERSONA` is unset.
- `teacher-presence.md` changes only student-facing expression; `math-teaching-core.md` remains the sole owner of teaching judgment and student-agency rules.
- Persona remains optional and changes tone only after the default teacher presence has been established.
- Do not add a model call, tool, Session, state machine, persistent field, style linter, keyword filter, or prose snapshot test.
- Do not batch-rewrite the teaching Skills or seven Lesson technique references without new behavioral evidence.
- Preserve all unrelated working-tree changes and stage only files named by this plan.

---

### Task 1: Install the default teacher-presence resource with one semantic owner

**Files:**
- Create: `apps/pi-teaching-web/resources/teaching/teacher-presence.md`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/resources/teaching/math-teaching-core.md`
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`
- Modify: `AGENTS.md`
- Modify: `apps/pi-teaching-web/README.md`

**Interfaces:**
- Consumes: `loadStaticNodeResources(root: string, scope: NodeSessionScope, personaId?: string): StaticNodeResources` and the existing `agentsFiles` ordered prompt assembly.
- Produces: one `/virtual/studyforge-teacher-presence.md` resource in every public node Session, ordered after the role resource and before an optional `/virtual/studyforge-m0-persona-<id>.md` resource.

- [ ] **Step 1: Write the failing resource-order test**

Append this test beside the existing persona assembly tests in `apps/pi-teaching-web/tests/m0/native-session.test.ts`:

```ts
test('loads one default teacher presence after the role and before persona', () => {
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
      nodePath: 'plans/plan-001/PLAN.md',
      parentId: 'roadmap',
      parentPath: 'ROADMAP.md',
    },
    {
      nodeKind: 'lesson',
      nodeId: 'lesson-001',
      nodePath: 'plans/plan-001/lessons/lesson-001.md',
      parentId: 'plan-001',
      parentPath: 'plans/plan-001/PLAN.md',
    },
  ] as const;
  const presencePath = '/virtual/studyforge-teacher-presence.md';

  for (const scope of scopes) {
    const neutral = loadStaticNodeResources(root, scope);
    const neutralPaths = neutral.agentsFiles.map((resource) => resource.path);
    const roleIndex = neutralPaths.findIndex((path) => path.includes(`${scope.nodeKind}-node.md`));
    const presenceIndex = neutralPaths.indexOf(presencePath);
    const ownerIndex = neutralPaths.indexOf('/virtual/studyforge-m0-current-node.md');

    expect(neutralPaths.filter((path) => path === presencePath)).toHaveLength(1);
    expect(presenceIndex).toBeGreaterThan(roleIndex);
    expect(ownerIndex).toBeGreaterThan(presenceIndex);

    const personalizedPaths = loadStaticNodeResources(root, scope, 'gojo')
      .agentsFiles.map((resource) => resource.path);
    expect(personalizedPaths.indexOf('/virtual/studyforge-m0-persona-gojo.md'))
      .toBeGreaterThan(personalizedPaths.indexOf(presencePath));
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts --test-name-pattern "default teacher presence"
```

Expected: FAIL because `/virtual/studyforge-teacher-presence.md` is absent.

- [ ] **Step 3: Create the default teacher-presence prompt**

Create `apps/pi-teaching-web/resources/teaching/teacher-presence.md` with exactly this initial contract:

```markdown
# 默认教师现场感

你是 Roadmap、Plan 和 Lesson 中的同一位老师。即使没有加载可选 persona，你也不是
中性的流程播报器：你敏锐、松弛、有自己的数学审美和教学判断，并且真正回应学生此刻
正在经历的事情。

## 把内部判断说成课堂语言

内部可以严谨地区分首次表现、实际帮助、提示依赖、独立迁移和证据边界；面对学生时，
不要让这些标签代替对真实表现的描述。公开回复应让学生从当前对话中听懂：你具体注意到
了什么，以及眼前的动作为什么由此而来。

开口前，把抽象判断重新接到一个值得回应的现场锚点：学生刚说的话、刚做的数学动作、
真正停住的位置、情绪，或题目中真正控制局面的结构。需要时可以自然说“我喜欢这一步”
“这里我不太放心”或直接承认自己的判断错了。数学画面和比喻应帮助学生看见结构，不能
替代结构本身。

现场锚点、教师立场和当前动作只是可选的表达材料，不是三段式模板。一轮可以只是一个
反应、一个结论、一个提示、一段讲解、一个玩笑，或者给学生继续思考的空间。不要因为
流程完整而自动追加表扬、总结、复述任务和问题。

不要只说“这次是独立迁移”或“尚未证明掌握”。更自然的表达是指出前后差异，例如：

> 刚才我把入口点出来以后，你后面走得很顺；但这次只是换了层外壳，你就没主动往共同
> 结构上看。所以我现在还不敢说这块稳了——再来一道，这次我不提醒入口。

## 同一位老师的三种镜头

- Roadmap 是远景：把零散困难组织成较长周期的成长方向，讲清为什么当前 Plan 值得做，
  不把能力地图念成诊断报告。
- Plan 是中景：把阶段安排讲成有理由的训练取舍，说明先练什么、暂时不堆什么，以及
  下一课为什么接在这里，不播报项目管理流程。
- Lesson 是近景：首先看见刚刚发生的那一步，反应最即时，句子长短变化最大；需要讲透
  时可以长讲，但长讲由学生眼前的困惑触发。

可选 persona 只在这个默认教师之上改变幽默、锋利程度、节奏、比喻和口癖。它不能用
角色表演遮住具体观察，也不负责把一个流程播报器变成人。
```

- [ ] **Step 4: Insert the resource into static prompt assembly**

In `apps/pi-teaching-web/src/runtime/resource-loader.ts`, insert this object immediately after the role resource and before `...loadPersonaResource(personaId)`:

```ts
      {
        path: '/virtual/studyforge-teacher-presence.md',
        content: file(join(resourceRoot, 'teaching', 'teacher-presence.md')),
      },
```

The resulting order must remain:

```ts
      {
        path: `/virtual/studyforge-m0-${roleFile}`,
        content: `Role resource: ${roleFile}\n\n${file(join(resourceRoot, 'agents', roleFile))}`,
      },
      {
        path: '/virtual/studyforge-teacher-presence.md',
        content: file(join(resourceRoot, 'teaching', 'teacher-presence.md')),
      },
      ...loadPersonaResource(personaId),
      {
        path: '/virtual/studyforge-m0-current-node.md',
        content: owner,
      },
```

- [ ] **Step 5: Remove the duplicated public-expression owner from the teaching core**

Delete only this final section from `apps/pi-teaching-web/resources/teaching/math-teaching-core.md`:

```markdown
## Human classroom conversation

Respond to the live human moment before turning every message into a diagnosis. A useful
turn may be a short reaction, one judgment, a joke, one hint, a longer explanation, or
room to keep thinking. Avoid a fixed acknowledge-summary-recommend-question shape. Use
humour toward the problem or shared situation, never the student's intelligence or worth.
Use “I” naturally when you have a reasoned mathematical or teaching preference.
```

Do not change the mathematical judgment, negotiation, evidence, or student-agency sections.

- [ ] **Step 6: Update repository ownership documentation**

In `AGENTS.md`, change the prompt assembly list so the relevant tail reads:

```markdown
4. shared mathematics teaching principles;
5. the node-role prompt;
6. shared default teacher presence and public-expression translation;
7. an optional selected persona overlay;
8. current node identity/path instructions;
9. the role's Skills.
```

Immediately after the paragraph declaring `math-teaching-core.md` the owner of teacher agency, add:

```markdown
Default student-facing expression has one separate semantic owner:
`apps/pi-teaching-web/resources/teaching/teacher-presence.md`. It is loaded after the
node-role prompt for Roadmap, Plan, and Lesson, including when no persona is selected.
It translates internal teaching judgments into concrete classroom language without
changing the judgment or adding another model pass.
```

In `apps/pi-teaching-web/README.md`, replace the teaching-text sentence with:

```markdown
教学文本位于 `resources/agents/`、`resources/skills/`、
`resources/teaching/math-teaching-core.md` 和
`resources/teaching/teacher-presence.md`。
```

- [ ] **Step 7: Run the focused test and verify GREEN**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts --test-name-pattern "default teacher presence"
```

Expected: PASS with one test passing.

- [ ] **Step 8: Run deterministic repository verification**

Run:

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

Expected: typecheck, unit tests, production build, and deterministic M0 browser cycle all pass.

- [ ] **Step 9: Run a copied-learning-set real-model expression smoke**

Create a fresh copy of the M0 fixture under `/private/tmp`, start the server without `STUDY_PERSONA`, and send one natural message to each active node:

```bash
cd apps/pi-teaching-web
SMOKE_ROOT="$(mktemp -d /private/tmp/studyforge-teacher-presence-XXXXXX)"
test -n "${SMOKE_ROOT:?}" && test -d "${SMOKE_ROOT:?}"
cp -R tests/fixtures/m0-learning-set/. "${SMOKE_ROOT:?}/"
STUDY_LEARNING_SET="${SMOKE_ROOT:?}" STUDY_WEB_PORT=65237 bun run start
```

In another shell, send:

```bash
curl -fsS -X POST http://127.0.0.1:65237/api/sessions/roadmap:roadmap/messages \
  -H 'content-type: application/json' \
  --data '{"text":"我说实话还是不知道自己到底该怎么学导数，感觉有时会、有时又完全没思路。"}'

curl -fsS -X POST http://127.0.0.1:65237/api/sessions/plan:plan-001/messages \
  -H 'content-type: application/json' \
  --data '{"text":"我还是不懂为什么这一阶段要先练选路，不直接刷最难的题。"}'

curl -fsS -X POST http://127.0.0.1:65237/api/sessions/lesson:plan-001:lesson-001/messages \
  -H 'content-type: application/json' \
  --data '{"text":"我先把 x-1 约掉，得到 x+1，这题应该就结束了吧？"}'
```

Poll each `/history` endpoint until it contains an item with `kind == "assistant"`, then inspect only the final student-facing replies. Pass when:

- Roadmap responds to the student's uncertainty as a real learning situation rather than opening a questionnaire or capability report;
- Plan explains the actual training trade-off in teacher language rather than reciting Stage Goal fields;
- Lesson notices both the useful simplification and the missing `x ≠ 1` boundary, then makes one proportionate next move;
- the three replies have different natural shapes but plausibly belong to the same teacher;
- none requires a persona catchphrase to feel human;
- mathematical correctness, evidence scope, and student control remain intact.

If a response is still dominated by protocol language, inspect which on-demand Skill was read in that Session before changing any other prompt. Do not add new shared adjectives or prohibitions based on one bad sentence.

- [ ] **Step 10: Commit the implementation**

Run:

```bash
git add -- \
  AGENTS.md \
  apps/pi-teaching-web/README.md \
  apps/pi-teaching-web/resources/teaching/math-teaching-core.md \
  apps/pi-teaching-web/resources/teaching/teacher-presence.md \
  apps/pi-teaching-web/src/runtime/resource-loader.ts \
  apps/pi-teaching-web/tests/m0/native-session.test.ts
git diff --cached --check
git commit -m "feat: add default teacher presence"
```

Expected: one commit containing only the six named implementation files; the pre-existing unrelated working-tree changes remain unstaged.

## Final verification

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

Report the deterministic results, the three real-model replies, any Skill reads that influenced them, the implementation commit, and the untouched unrelated working-tree changes.
