# Gentle Teacher Judgment and Isomorphic Longitudinal Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ordinary teacher-student negotiation converge without invented conflict, then verify the change through a short latency benchmark and one complete Roadmap → isomorphic-transformation Plan → multi-Lesson learning cycle.

**Architecture:** Keep the change prompt-only: the shared mathematics teaching core owns the decision policy, while Plan, Lesson, and Gojo resources apply it in their narrower roles. Deterministic checks protect the existing runtime; real-model acceptance uses isolated copies of learning sets and the normal HTTP/lifecycle APIs, so no test dialogue or acceptance state enters production files.

**Tech Stack:** Markdown agent resources, Bun 1.3, TypeScript 7, React/Vite, Pi native Sessions, a controlled `deepseek-v4-flash`/`deepseek-v4-pro` short comparison, `deepseek/deepseek-v4-pro` for the longitudinal cycle, curl/jq, local Markdown learning sets.

## Global Constraints

- Do not add runtime phases, schema fields, tools, memory objects, frontend guards, keyword filters, or new Agents.
- Do not modify `roadmap-node.md` or `coach-study/SKILL.md`; the measured slow turn happened before the Skill was loaded.
- Do not add fixed-wording tests for prompt prose. Use existing deterministic tests plus real-model observation.
- Preserve mathematical truth and honest classroom records as firm boundaries; only reasonable learning preferences receive the gentler negotiation policy.
- A consequential ambiguity gets one concrete clarifying question. A clear, reasonable request keeps its main intent and receives at most one small reversible adjustment. A clearly harmful request gets one concise reasoned recommendation.
- Once an informed student persists in a reasonable choice, accept it and do not reopen the argument without new evidence.
- Stop the current reasoning turn once its public action is decided; do not precompute Lesson lifecycle, material search, file writes, or hypothetical student replies.
- The long acceptance must use the normal product resources and real model. Never tell the teacher Agent which Plan, method, template, Lesson count, Block count, card, tool, or file operation to choose.
- During the long acceptance, act only as a realistic strong high-school student: state personal goals, confusion, attempts, reactions, fatigue, and choices; never instruct the teacher how to teach or audit the system.
- Use isolated learning-set copies with `session_id: null`; never mutate `examples/derivative-m0/learning-set` during real-model acceptance.
- Do not treat one taught example or one imitative success as completion. The cycle is complete only after the student has encountered the idea, worked examples or near transfer, changed-shell transfer, and an honest independent check.
- Keep all locally configured provider credentials out of commands, reports, commits, and Session excerpts.
- The main worktree contains unrelated user changes. Work in an isolated worktree and stage only files named by this plan. In particular, do not absorb the user’s uncommitted Scout-contract edits in `plan-node.md`.

---

## File Map

- Modify `docs/superpowers/specs/2026-08-04-gentle-teacher-judgment-design.md`: mark the approved design as accepted.
- Modify `apps/pi-teaching-web/resources/teaching/math-teaching-core.md`: own the shared ambiguity/reversible-adjustment/stop-condition policy.
- Modify `apps/pi-teaching-web/resources/agents/plan-node.md`: apply the policy before private preparation.
- Modify `apps/pi-teaching-web/resources/agents/lesson-node.md`: adapt ordinary classroom preferences without manufacturing a dispute.
- Modify `apps/pi-teaching-web/resources/personas/gojo.md`: keep confidence from becoming performative opposition.
- Create `docs/audits/2026-08-04-gentle-teacher-judgment-acceptance.md`: record deterministic checks and the user-requested Flash/Pro short comparison.
- Create `docs/audits/2026-08-04-isomorphic-plan-longitudinal-acceptance.md`: record the complete natural-student learning cycle and its bounded conclusions.

### Task 1: Implement the shared gentle-judgment policy

**Files:**
- Modify: `docs/superpowers/specs/2026-08-04-gentle-teacher-judgment-design.md:1-6`
- Modify: `apps/pi-teaching-web/resources/teaching/math-teaching-core.md:20-39`
- Modify: `apps/pi-teaching-web/resources/agents/plan-node.md:28-41`
- Modify: `apps/pi-teaching-web/resources/agents/lesson-node.md:17-23`
- Modify: `apps/pi-teaching-web/resources/personas/gojo.md:20-26`
- Test: `apps/pi-teaching-web/tests/m0/native-session.test.ts`

**Interfaces:**
- Consumes: the existing resource assembly order `teaching core → role → optional persona`.
- Produces: a prompt-only policy used by every student-facing native Pi Session; no TypeScript interface changes.

- [ ] **Step 1: Mark the reviewed design as approved**

Replace the status line with:

```markdown
状态：已通过讨论与书面复核，进入实施
```

- [ ] **Step 2: Replace the shared adversarial paragraph with intent recovery and bounded action**

In `math-teaching-core.md`, keep the opening paragraph under `Accountable teacher judgment`, then replace the current `Do not merely mirror...` paragraph with:

```markdown
Do not merely mirror the student's request, but do not manufacture a disagreement to
look professional. First recover the benefit the student is trying to obtain. If an
ambiguity would materially change the Lesson, ask one concrete question about that
difference and stop the turn. If the request is clear and broadly reasonable, preserve
its main intent and, when useful, fold in one small reversible adjustment rather than
turning the preference into a debate. If it would clearly work against the learning
purpose, state the practical concern and one recommendation briefly, without appealing
to authority.

Once the student understands the trade-off and still prefers another reasonable choice,
accept it, stop persuading, and teach seriously within that choice. Do not punish the
choice, reopen the same argument without new information, or later say that you warned
them. When the smallest useful action is a clarification, suggestion, or acceptance,
finish that action and stop; do not reason through future Lesson lifecycle, material
search, file writes, or hypothetical replies before the conversation reaches them.
```

Leave the following paragraph beginning `Hold mathematical truth...` intact.

- [ ] **Step 3: Make Plan negotiation concrete and local to the present turn**

Replace `plan-node.md` lines 34–41 with:

```markdown
Do not translate the student's requested lesson directly into a prepared file. Compare
it with the Roadmap's overall learning approach, this Plan's goal, and the literal
record of closed Lessons. First identify the benefit the student wants. If two plausible
meanings would produce materially different Lessons, ask one concrete question that
distinguishes them, then stop. If the request is clear and reasonably serves the Plan,
keep its main arrangement and, when useful, weave in one small reversible adjustment;
do not package an ordinary preference as a conflict merely to display expertise.
Difficulty, activity count, and method variety are means rather than proof that a
Lesson fits. Only when the arrangement would clearly undermine the Plan goal should
you briefly state the concern and one recommended change. If the student understands
and still chooses another reasonable arrangement, accept it and prepare that arrangement
seriously. Until the public arrangement is settled, do not plan material-search tasks,
Lesson lifecycle actions, document writes, or hypothetical later branches.
```

Do not alter the later material-slot or Scout schema text, even if the source branch and the user’s dirty main worktree differ there.

- [ ] **Step 4: Make Lesson preference handling adaptive rather than argumentative**

Replace `lesson-node.md` lines 17–23 with:

```markdown
Do not avoid a useful judgment merely to keep the interaction agreeable. Be clear
about mathematical correctness and honest about help used. Treat pace, amount of
practice, hint timing, explanation style, and activity form as negotiable. For a clear,
reasonable preference, adapt directly and, when useful, make one small reversible
adjustment without staging a disagreement. If the choice would materially weaken the
Lesson goal, explain the teaching reason briefly. Once the student understands and
still chooses a reasonable path, stop fighting for control and teach within it. If
their reasoning later shows that your own judgment was wrong, acknowledge that directly
and continue from their valid route.
```

- [ ] **Step 5: Stop Gojo confidence from manufacturing opposition**

Replace `gojo.md` lines 22–26 with:

```markdown
Confidence does not require manufacturing disagreement. Most of the time, understand
what the student wants and fold your judgment lightly into the next move. When a real
mathematical or teaching concern remains, state the reason plainly without turning it
into a contest of wills. Listen when the student explains. If they understand the
trade-off and still choose another reasonable path, relent without resentment and
continue seriously. If your own judgment was wrong, say so cleanly and let the
student's valid route stand.
```

- [ ] **Step 6: Run the focused deterministic check**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts
bun run typecheck
```

Expected: every native-session test passes and TypeScript exits 0. Do not add prose snapshot tests if the old text remains behaviorally untested.

- [ ] **Step 7: Inspect the scoped diff and commit**

Run:

```bash
git diff --check
git diff -- docs/superpowers/specs/2026-08-04-gentle-teacher-judgment-design.md \
  apps/pi-teaching-web/resources/teaching/math-teaching-core.md \
  apps/pi-teaching-web/resources/agents/plan-node.md \
  apps/pi-teaching-web/resources/agents/lesson-node.md \
  apps/pi-teaching-web/resources/personas/gojo.md
git add docs/superpowers/specs/2026-08-04-gentle-teacher-judgment-design.md \
  apps/pi-teaching-web/resources/teaching/math-teaching-core.md \
  apps/pi-teaching-web/resources/agents/plan-node.md \
  apps/pi-teaching-web/resources/agents/lesson-node.md \
  apps/pi-teaching-web/resources/personas/gojo.md
git commit -m "refactor: make teacher judgment gentler"
```

Expected: the commit contains only the five prompt/spec files above.

### Task 2: Verify the unchanged runtime and record the deterministic result

**Files:**
- Create: `docs/audits/2026-08-04-gentle-teacher-judgment-acceptance.md`
- Test: `apps/pi-teaching-web/tests/e2e/m0-cycle.spec.ts`

**Interfaces:**
- Consumes: Task 1 prompt resources and the existing M0 runtime.
- Produces: a reproducible deterministic acceptance record; no product API.

- [ ] **Step 1: Run the full application gate**

Run:

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

Expected: typecheck, all non-E2E tests, production build, and `m0-cycle.spec.ts` pass. Record the exact test count and any pre-existing build warning.

- [ ] **Step 2: Create the acceptance report with the verified run facts**

Create the report with these sections. The expected counts below match the current suite; if Step 1 reports a different count, write that observed count instead before committing:

```markdown
# 温和教师判断验收

日期：2026-08-04

## 变更边界

本轮只修改共享教学内核、Plan/Lesson 角色提示和五条悟人格。未增加运行时阶段、
schema、工具、Agent、前端门禁或提示词固定措辞测试。

## 确定性验证

- `bun run check`：通过（45 tests，0 fail；typecheck/build 通过）。
- `bun run test:e2e -- tests/e2e/m0-cycle.spec.ts`：通过（1 passed）。
- 构建警告：保留既有的单个前端 chunk 大于 500 kB 警告；没有新增警告。

## 五副本短回合

Task 3 完成后补入 Flash 与 Pro 两次隔离运行的模型、输入、墙钟时间、reasoning
tokens 和行为分类。本节在真实数据产生前不作通过结论。

## 结论边界

确定性检查只证明资源可装载、运行时未回归；是否减少无效复议由真实模型短回合决定。
```

- [ ] **Step 3: Commit the deterministic report**

Run:

```bash
git add docs/audits/2026-08-04-gentle-teacher-judgment-acceptance.md
git commit -m "docs: record gentle judgment deterministic checks"
```

Expected: one documentation-only commit.

### Task 3: Compare Flash and Pro on the same short negotiation

**Files:**
- Modify: `docs/audits/2026-08-04-gentle-teacher-judgment-acceptance.md`
- Read only: `apps/pi-teaching-web/tests/fixtures/m0-learning-set/**`
- Runtime artifacts: `/tmp/studyforge-gentle-judge-*/learning-set`, isolated Pi configuration, and native Pi JSONL files.

**Interfaces:**
- Consumes: `POST /api/sessions/:key/messages`, `GET /api/sessions/:key/history`, `STUDY_PERSONA=gojo`, and isolated configs selecting `deepseek-v4-flash` or `deepseek-v4-pro` at high thinking.
- Produces: one Flash and one Pro sample with first-visible latency, parent reasoning, teacher action, and premature-future-branch classification.

- [ ] **Step 1: Build once and create two clean fixture copies**

Run from `apps/pi-teaching-web`:

```bash
bun run build
for index in flash pro; do
  root="$(mktemp -d /tmp/studyforge-gentle-judge-${index}-XXXXXX)"
  mkdir -p "$root/learning-set"
  cp -R tests/fixtures/m0-learning-set/. "$root/learning-set/"
  perl -0pi -e 's/session_id: .*/session_id: null/g' \
    "$root/learning-set/ROADMAP.md" \
    "$root/learning-set/plans/plan-001.md" \
    "$root/learning-set/lessons/lesson-001.md"
done
```

Expected: two distinct roots; each node has `session_id: null`.

- [ ] **Step 2: Run the unchanged Flash sample to natural completion**

Use the existing local default config and send exactly:

```text
下一节别做问诊了，直接给我五道最难的题，方法越多越好。我就想这么练。
```

Let the first turn complete even if it launches material search. Record time to first visible reply, full parent reasoning/output, tool count, child-Scout use, final public action, and whether the Coach asked about the material ambiguity.

- [ ] **Step 3: Create a credential-safe isolated Pro configuration**

Create a temporary `PI_CODING_AGENT_DIR`, copy only the local `auth.json` and model catalog needed to use the already configured provider, and derive `settings.json` with:

```json
{"defaultProvider":"deepseek","defaultModel":"deepseek-v4-pro","packages":[]}
```

Preserve every unrelated setting outside those three keys, chmod the temporary directory to `700`, chmod credentials to `600`, and never print or commit credential values.

- [ ] **Step 4: Run Pro with the identical product state and input**

Start the second copy with `PI_CODING_AGENT_DIR` pointing to the isolated Pro config. Confirm the new native Session records:

```text
model_change: deepseek/deepseek-v4-pro
thinking_level_change: high
```

Send the same student sentence. Stop after the first visible teacher reply and the immediately adjacent tool action; this comparison asks whether the larger model resolves the judgment quickly, not whether five Scouts can finish. Record the same parent metrics as the Flash run.

- [ ] **Step 5: Finish the model-comparison report**

Add:

- one row per model with Session ID, first-visible wall seconds, parent reasoning tokens, tool count, public action, and ambiguity handling;
- the exact boundary that Flash ran to full turn completion while Pro was stopped after its first visible acceptance;
- whether a larger model reduced repetitive reasoning;
- whether either model actually obeyed the intended material-ambiguity rule;
- the decision to use Pro for the natural longitudinal cycle without claiming that model substitution repaired the prompt semantics.

Do not claim that this short test proves teaching quality.

- [ ] **Step 6: Commit the real-model report update**

Run:

```bash
git add docs/audits/2026-08-04-gentle-teacher-judgment-acceptance.md
git commit -m "docs: validate gentle teacher judgment"
```

Expected: no `/tmp` artifacts, credentials, or full CoT enter the commit.

### Task 4: Run a natural-student Roadmap-to-isomorphism longitudinal cycle

**Files:**
- Create: `docs/audits/2026-08-04-isomorphic-plan-longitudinal-acceptance.md`
- Read only: `examples/derivative-m0/learning-set/**`
- Runtime artifacts: `/tmp/studyforge-isomorphic-long-*/learning-set`, server log, projected histories, and native Pi JSONL files.

**Interfaces:**
- Consumes: the real Roadmap/Plan/Lesson lifecycle, all packaged teaching resources and templates, real cards/graph assets, and the isolated `deepseek/deepseek-v4-pro` high-thinking configuration from Task 3.
- Produces: one closed multi-Lesson first Plan whose own documents demonstrate or honestly fail to demonstrate the intended isomorphic-transformation capability.

- [ ] **Step 1: Create one clean derivative learning-set copy**

Run from `apps/pi-teaching-web`:

```bash
LONG_ROOT="$(mktemp -d /tmp/studyforge-isomorphic-long-XXXXXX)"
mkdir -p "$LONG_ROOT/learning-set"
cp -R ../../examples/derivative-m0/learning-set/. "$LONG_ROOT/learning-set/"
find "$LONG_ROOT/learning-set" -type f \( -name 'ROADMAP.md' -o -path '*/plans/*.md' -o -path '*/lessons/*.md' \) \
  -exec perl -0pi -e 's/session_id: .*/session_id: null/g' {} +
test -z "$(find "$LONG_ROOT/learning-set/plans" -type f ! -name '.gitkeep' -print -quit)"
test -z "$(find "$LONG_ROOT/learning-set/lessons" -type f ! -name '.gitkeep' -print -quit)"
```

Expected: the copy keeps all cards, graph, materials, guide, and clean Roadmap, while Plan/Lesson directories contain no dynamic node documents.

- [ ] **Step 2: Start a fresh real-model app and capture run identity**

Choose a free port from `65490` upward and run:

```bash
STUDY_PERSONA=gojo \
STUDY_LEARNING_SET="$LONG_ROOT/learning-set" \
STUDY_WEB_PORT="$port" \
bun run start >"$LONG_ROOT/server.log" 2>&1 &
server_pid=$!
until curl -fsS "http://127.0.0.1:$port/api/health" >/dev/null; do sleep 1; done
curl -fsS "http://127.0.0.1:$port/api/course" > "$LONG_ROOT/course-initial.json"
```

Record git commit, model/provider, persona, root, port, server PID, and start time in the report. Do not place the API credential in the environment or report; Pi uses its existing local provider configuration.

- [ ] **Step 3: Begin as a natural strong student at the Roadmap level**

Send this opening, or an equally natural first-person variant that does not name the target method:

```text
我想系统学一点导数里的高级技巧。基础求导和常见单调性题我都会，但一到指数、对数和不同层级的式子混在一起，我经常看不出入口，只能先硬算。想把这种题真正看明白一点。
```

Thereafter answer only what the Roadmap Coach actually asks. Student behavior rules:

- answer in 1–4 natural sentences unless a mathematical attempt genuinely needs more;
- describe remembered experience, uncertainty, and preference, not an ideal curriculum;
- never say “同构 Plan”, “能力建构周期”, “概念课”, “迁移课”, “模板”, “Block”, “Scout”, “题卡”, “请读文件”, or prescribe a Lesson count;
- if asked a consequential question, give a plausible strong-student answer: basics are available, unfamiliar structure recognition is not;
- accept or push back based on personal preference, never to force a hidden expected architecture.

Continue until the Roadmap Coach itself creates one prepared first Plan. Audit whether it introduces the learning set before diagnosis, narrows the broad need through useful questions, and chooses isomorphic transformation for a reason grounded in the conversation.

- [ ] **Step 4: Start the Plan through the lifecycle API and negotiate each next Lesson naturally**

After reading the actual Plan ID from `/api/course`, use:

```bash
curl -fsS -X POST "http://127.0.0.1:$port/api/plans/$plan_id/start" \
  | tee "$LONG_ROOT/start-plan.json"
```

In the Plan Session, speak like a student who knows what they want to improve but not how to design instruction. Examples of valid reactions are “这个方向挺对的，我想先弄明白到底怎么看出来” or “上节我会跟着做，但换个式子可能还认不出来.” Do not request a particular template, activity count, card, search strategy, or predetermined next Lesson.

Allow the Coach to ask questions and prepare the next Lesson. If it proposes an arrangement that does not match the student’s experience, clarify only the lived mismatch. If it proposes a sensible plan, accept it without optimizing on the teacher’s behalf.

- [ ] **Step 5: Complete each Lesson as a realistic learner**

For each prepared Lesson discovered through `/api/course`:

1. Start it with `POST /api/lessons/:id/start`.
2. Enter with a natural line such as `开始吧` unless the Tutor already opens the activity.
3. Solve only the current visible task. Never use Teacher Control or card answers to construct the student reply.
4. Show strong but imperfect behavior across the cycle: retrieve derivative basics quickly; explain a new idea in personal language; make at least one incomplete or initially misdirected structural judgment; ask for a small hint only when genuinely stuck; later attempt changed-shell work without announcing the intended method.
5. Let the Tutor respond and record each Block. Do not correct metadata, evidence language, method-node names, file paths, or tool calls as a QA operator.
6. When the visible work is genuinely complete or fatigue makes stopping realistic, say naturally that the class can end. Then call `POST /api/lessons/:id/close` and return to the parent Plan.

After every closure, copy the projected Lesson history to `$LONG_ROOT/histories/<lesson-id>.json`, read the generated Lesson Markdown as an auditor, and record:

- what the student could do before help;
- what help was used;
- whether the Tutor preserved partial correctness and used progressive help;
- whether the Classroom Log matches the visible exchange;
- whether the Lesson served concept/knowledge, worked-example or near-transfer, changed-shell transfer, or independent-check teaching functions.

The final classification is auditor analysis only. Never inject those teaching-function labels into the next student message.

- [ ] **Step 6: Let the same Plan Coach adapt across multiple Lessons**

After every closed Lesson, return to `plan:<plan_id>` and let the Coach review the child document. Give only a natural student reflection when asked, such as what felt clear, where recognition still lagged, or whether the new shell felt genuinely different. Do not tell it to read the Lesson, update the Plan, prepare a transfer class, or finish the Plan.

Continue until the Plan’s own capability standard has been honestly exercised across these observed functions:

```text
understand the isomorphic relation and monotonicity condition
→ see it used or co-construct it on a worked example
→ recognise and use it on a changed shell
→ complete an unseen independent check without decisive route disclosure
```

This is an acceptance boundary, not a script for the Agent. A function may be skipped if prior independent performance truly makes it unnecessary, repeated if evidence warrants it, or combined with another function. Do not force a fixed Lesson count. Expect several Lessons; report the actual count.

- [ ] **Step 7: Close the Plan only when the student and Coach reach a real completion decision**

When the Coach explains that the stage standard has been met, react as the student based on the actual classroom experience. If an important transfer gap remains, say so naturally rather than accepting a false completion. If the evidence is sufficient, agree to finish and call:

```bash
curl -fsS -X POST "http://127.0.0.1:$port/api/plans/$plan_id/complete" \
  | tee "$LONG_ROOT/complete-plan.json"
```

Expected final facts:

- `ROADMAP.md` contains the first Plan link and an updated current position;
- the Plan is `completed`, or explicitly remains `active` with the unmet standard named;
- every conducted Lesson is `closed` and linked from the Plan;
- each Lesson contains Block-level Classroom Logs grounded in the visible exchange;
- the Plan Coach’s final statement agrees with the written Plan after rereading it.

Do not force `completed` merely to make the test green.

- [ ] **Step 8: Write the longitudinal acceptance report**

Create `docs/audits/2026-08-04-isomorphic-plan-longitudinal-acceptance.md` with:

```markdown
# 同构学习目标长程真实验收

## 运行身份

记录 commit、模型、人格、临时学习集、Roadmap/Plan/Lesson Session ID 与原始文件位置。

## 学生角色边界

说明学生只表达自身目标、理解、尝试与选择，没有指定同构 Plan、教学模板、课数、
Block、题卡、工具或文件操作。

## 从自然需求到第一份 Plan

按时间线复述 Roadmap 如何介绍学习集、问诊并形成首个 Plan；指出“同构”是否由
Coach 根据对话提出，而非由验收者暗示。

## 多节 Lesson 时间线

逐课记录教学目标、主要活动、学生真实停点、帮助使用、Lesson 文件、Session ID、
关闭状态与下一课调整。

## 教学功能覆盖

分别核对知识/概念形成、例题或近迁移、变式迁移、独立检查。每项引用 Lesson Block
和学生可见对话；没有直接证据就写“未证明”。

## 系统闭环

核对 Roadmap → Plan → Lesson 生命周期、父节点重读子 Markdown、Block 日志连续性、
刷新恢复和最终 Plan 写回。

## 教学质量与真实毛刺

区分模型能力、提示词、资产、工具调用、等待时间和前端问题。普通学生不会主动发现的
错误不得因系统最终可恢复而忽略。

## 结论边界

只判断这一个模拟强学生周期的系统与教学表现；不声称普遍学习增益或真实人类效果。
```

Include concise dialogue excerpts, exact document links, and a teacher-readable summary. Do not paste full private CoT or expose credentials.

- [ ] **Step 9: Commit only the report**

Run:

```bash
git add docs/audits/2026-08-04-isomorphic-plan-longitudinal-acceptance.md
git commit -m "docs: validate isomorphic learning cycle"
```

Expected: generated learning-set files and Session JSONL remain under `/tmp` and `~/.pi`, not in git.

### Task 5: Final verification and integration readiness

**Files:**
- Verify: all files committed by Tasks 1–4.

**Interfaces:**
- Consumes: all implementation and acceptance commits.
- Produces: a verified branch ready for local-main integration without absorbing unrelated user work.

- [ ] **Step 1: Run the final deterministic gate from a clean branch state**

Run:

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
cd ../..
git diff --check
git status --short
```

Expected: all checks pass; branch worktree has no uncommitted changes. Treat the existing large-chunk warning as informational if it is unchanged.

- [ ] **Step 2: Review commit scope and acceptance honesty**

Run:

```bash
git log --oneline --decorate -8
git diff --stat HEAD~4..HEAD
git grep -n -E 'sk-[A-Za-z0-9]|api[_-]?key|FIXME|XXX' -- \
  docs/audits/2026-08-04-gentle-teacher-judgment-acceptance.md \
  docs/audits/2026-08-04-isomorphic-plan-longitudinal-acceptance.md
```

Expected: no credential-like value or unresolved marker appears. If fewer or more than four task commits were created, adjust the review range to the implementation-plan commit rather than rewriting history.

- [ ] **Step 3: Compare all outcomes with the approved design**

Confirm explicitly:

- ordinary preferences no longer trigger manufactured debate in the sampled turns;
- the short test did not solve future preparation branches before agreement;
- the long test’s target emerged from natural Roadmap diagnosis;
- the simulated student never instructed the teacher how to teach;
- the completed/active Plan conclusion matches actual Lesson evidence;
- no new defensive runtime complexity was introduced.

If any item fails, report it as a bounded residual instead of patching a new mechanism outside this plan.

- [ ] **Step 4: Prepare a concise handoff**

Report the prompt files changed, deterministic results, Flash/Pro comparison, actual Lesson count, whether the isomorphism goal completed, the two or three most important observed teaching strengths, and every P0/P1 residual. Include absolute links to both audit reports and the final commit. Do not require the resting user to reconstruct the result from commentary.
