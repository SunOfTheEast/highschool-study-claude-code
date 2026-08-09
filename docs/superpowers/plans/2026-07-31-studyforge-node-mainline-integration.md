# StudyForge 节点化主线整合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 安全封存旧主工作树中的教学小修，将已验收的层级 Node Runtime 与三坐标工作台完整整合到 StudyForge `main`，完成自动测试、真实短课、本地重装和生产 smoke。

**Architecture:** 当前 11 文件 dirty patch 与节点分支的 `744a980` patch-id 完全相同，因此只在 parking branch 留一份安全快照，不重复移植。节点分支先 merge 当前 `main`，通过确定性测试和复制学习集真实短课后，`main` 再以 `--ff-only` 切换；最后从新主线重建、重装并记录整合验收。

**Tech Stack:** Git worktree、Bun 1.3.14、TypeScript 7.0.2、React 19、Pi 0.81、Playwright 1.61、Markdown/YAML、Claude Code plugin strict validator。

**Design:** `docs/superpowers/specs/2026-07-31-studyforge-node-mainline-integration-design.md`

## Global Constraints

- 主工作树固定为 `/Users/yangrundong/Documents/GitHub/highschool-study-claude-code`；节点工作树固定为 `/Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/studyforge-node-workspace`。
- 执行开始时，旧主线必须仍为 `main@a4f0c126fcfffb88bc4c3fe4ec5d5d8e2eed5260`；节点分支必须包含 `744a980ab6e4143671c5e599bd94dc0be2fcf067`、`ba9a380549553a1f7eb6978d044fb3ad25f910e5` 和设计提交 `0270f6c8598516c86c552e5e12acde0e5585d01c`。任一断言不成立就停止整合，重新审计新提交。
- dirty patch 的唯一合法 patch-id 是 `fb8918d7356915b5fe0d44acb11c1397c374733d`。若执行时不同，不得提交、丢弃或覆盖新增差异。
- `codex/pre-node-hotfixes` 只封存 11 个已知 tracked 文件；不得添加主工作树的 `.superpowers/` 或 `docs/superpowers/plans/2026-07-22-three-lesson-teaching-quality-optimization.md`。
- 不使用 rebase、squash、`reset --hard`、`checkout --`、强推或批量 `ours`/`theirs`。节点分支合入 `main`，最终 `main` 使用 `git merge --ff-only`。
- 本计划不新增旧线性 Plan/Lesson 兼容路径，不新增数据库、向量库、规则引擎、Agent、MCP 工具、长期记忆层或分发防御代码。
- Claude Code 插件公共 MCP 必须仍恰好为 `card_search`、`trace_search`、`trace_append`、`source_resolve` 四个。
- 自动测试下限不得下降：Pi 非 E2E 394 pass、插件 71 pass、Playwright 38 pass。若仓库合并带来新增测试，总数只能增加。
- 真实模型只写入 `/tmp` 下的导数学习集副本。不得修改 `examples/derivative-demo/learning-set/**`，不得提交凭据、Base URL、Pi Session JSONL、完整私有对话、Teacher Control 或生成的 Playwright 目录。
- 预计没有产品源码改动。若 clean merge 后出现源码测试失败，停止在失败证据处；先更新设计与本计划，不在整合任务里即兴扩展 Runtime。

## File Map

**只由 Git merge 改变：**

- `README.md`：保留节点化架构、三坐标工作台和学习节点协议入口，同时合入知页已迁移至 `/Users/yangrundong/Documents/GitHub/zhiye` 的说明。
- `docs/superpowers/plans/2026-07-31-general-multi-book-learning-app.md`：沿用 `a4f0c12` 的删除结果。
- `docs/superpowers/specs/2026-07-31-general-learning-kernel-design.md`：沿用 `a4f0c12` 的删除结果。

**只检查、不再编辑或重复提交：**

- `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- `apps/pi-teaching-web/src/client/styles.css`
- `apps/pi-teaching-web/src/runtime/lesson-prepare.ts`
- `apps/pi-teaching-web/src/runtime/study-tools.ts`
- `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`
- `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- `plugins/highschool-study/dist/mcp-server.js`
- `plugins/highschool-study/server/src/mcp/register-tools.ts`
- `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
- `plugins/highschool-study/skills/run-lesson/references/evidence-protocol.md`

**创建并在两阶段补全：**

- `docs/audits/2026-07-31-studyforge-node-mainline-integration.md`：记录候选分支自动验收、真实短课、主线 fast-forward、本地重装和生产 smoke；不保存秘密或完整对话。

**只存在于 `/tmp`：**

- `/tmp/studyforge-node-mainline-acceptance-XXXXXX/`：公开导数示例的真实模型副本。
- `/tmp/studyforge-node-mainline-acceptance.path`：本轮副本绝对路径。
- `/tmp/studyforge-node-mainline-server.pid`：候选分支 smoke 服务 PID。
- `/tmp/studyforge-node-mainline-{course,knowledge,memory}.json`：三坐标只读投影。
- `/tmp/studyforge-node-mainline-server.log`：本地服务日志，不进入 Git。

---

### Task 1: 封存旧主工作树的 11 文件教学小修

**Files:**

- Commit only: 上述 11 个已知 tracked 文件
- Preserve untracked: `.superpowers/**`
- Preserve untracked: `docs/superpowers/plans/2026-07-22-three-lesson-teaching-quality-optimization.md`

**Interfaces:**

- Consumes: `main@a4f0c12` 的 dirty working diff。
- Produces: `codex/pre-node-hotfixes` 上一份 patch-id 为 `fb8918d7356915b5fe0d44acb11c1397c374733d` 的安全提交；`main` 恢复 tracked clean。

- [ ] **Step 1: 核实两个工作树和分支身份**

```bash
MAIN=/Users/yangrundong/Documents/GitHub/highschool-study-claude-code
NODE="$MAIN/.worktrees/studyforge-node-workspace"

test "$(git -C "$MAIN" branch --show-current)" = main
test "$(git -C "$MAIN" rev-parse HEAD)" = a4f0c126fcfffb88bc4c3fe4ec5d5d8e2eed5260
test "$(git -C "$NODE" branch --show-current)" = codex/studyforge-node-workspace
git -C "$NODE" merge-base --is-ancestor 744a980ab6e4143671c5e599bd94dc0be2fcf067 HEAD
git -C "$NODE" merge-base --is-ancestor ba9a380549553a1f7eb6978d044fb3ad25f910e5 HEAD
git -C "$NODE" merge-base --is-ancestor 0270f6c8598516c86c552e5e12acde0e5585d01c HEAD
```

Expected: 所有命令退出 0；主工作树在 `main`，节点工作树在 `codex/studyforge-node-workspace`。

- [ ] **Step 2: 证明 dirty path 集合没有变化**

```bash
diff -u \
  <(printf '%s\n' \
    apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
    apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
    apps/pi-teaching-web/src/client/styles.css \
    apps/pi-teaching-web/src/runtime/lesson-prepare.ts \
    apps/pi-teaching-web/src/runtime/study-tools.ts \
    apps/pi-teaching-web/tests/e2e/workspace.spec.ts \
    apps/pi-teaching-web/tests/runtime/study-tools.test.ts \
    plugins/highschool-study/dist/mcp-server.js \
    plugins/highschool-study/server/src/mcp/register-tools.ts \
    plugins/highschool-study/skills/prepare-next-lesson/SKILL.md \
    plugins/highschool-study/skills/run-lesson/references/evidence-protocol.md) \
  <(git -C "$MAIN" diff --name-only | sort)

git -C "$MAIN" diff --check
git -C "$MAIN" status --short
```

Expected: `diff -u` 和 `git diff --check` 无输出；status 除 11 个 `M` 外只显示原有 `.superpowers/` 与旧三课计划两个未跟踪入口。

- [ ] **Step 3: 重新计算 working diff 与 `744a980` 的 patch-id**

```bash
working_patch_id="$(git -C "$MAIN" diff --binary | git patch-id --stable | awk '{print $1}')"
committed_patch_id="$(git -C "$NODE" show --format= --binary 744a980 | git patch-id --stable | awk '{print $1}')"

test "$working_patch_id" = fb8918d7356915b5fe0d44acb11c1397c374733d
test "$committed_patch_id" = fb8918d7356915b5fe0d44acb11c1397c374733d
printf 'working=%s\ncommitted=%s\n' "$working_patch_id" "$committed_patch_id"
```

Expected: 两行都打印 `fb8918d7356915b5fe0d44acb11c1397c374733d`。

- [ ] **Step 4: 创建 parking branch，只暂存 11 个 tracked 文件**

```bash
test -z "$(git -C "$MAIN" branch --list codex/pre-node-hotfixes)"
git -C "$MAIN" switch -c codex/pre-node-hotfixes
git -C "$MAIN" add -- \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  apps/pi-teaching-web/src/client/styles.css \
  apps/pi-teaching-web/src/runtime/lesson-prepare.ts \
  apps/pi-teaching-web/src/runtime/study-tools.ts \
  apps/pi-teaching-web/tests/e2e/workspace.spec.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts \
  plugins/highschool-study/dist/mcp-server.js \
  plugins/highschool-study/server/src/mcp/register-tools.ts \
  plugins/highschool-study/skills/prepare-next-lesson/SKILL.md \
  plugins/highschool-study/skills/run-lesson/references/evidence-protocol.md

test "$(git -C "$MAIN" diff --cached --name-only | wc -l | tr -d ' ')" = 11
git -C "$MAIN" diff --cached --check
git -C "$MAIN" status --short
```

Expected: staged 区只有上述 11 个文件；两个未跟踪入口仍以 `??` 显示。

- [ ] **Step 5: 提交 parking snapshot 并验证等价性**

```bash
git -C "$MAIN" commit -m "fix: preserve accepted teaching refinements before node cutover"

parking_commit="$(git -C "$MAIN" rev-parse HEAD)"
parking_patch_id="$(git -C "$MAIN" show --format= --binary "$parking_commit" | git patch-id --stable | awk '{print $1}')"
test "$parking_patch_id" = fb8918d7356915b5fe0d44acb11c1397c374733d
git -C "$MAIN" show --stat --oneline "$parking_commit"
```

Expected: 新提交恰好包含 11 个文件，patch-id 仍为 `fb8918d7356915b5fe0d44acb11c1397c374733d`。

- [ ] **Step 6: 切回旧 `main` 并确认 tracked tree 干净**

```bash
git -C "$MAIN" switch main
test "$(git -C "$MAIN" rev-parse HEAD)" = a4f0c126fcfffb88bc4c3fe4ec5d5d8e2eed5260
git -C "$MAIN" diff --quiet
git -C "$MAIN" diff --cached --quiet
git -C "$MAIN" status --short
```

Expected: 没有 tracked 修改；只保留原来的 `.superpowers/` 与旧三课计划未跟踪内容。

---

### Task 2: 将当前 `main` 干净合入节点化分支

**Files:**

- Merge: `README.md`
- Delete through merge: `docs/superpowers/plans/2026-07-31-general-multi-book-learning-app.md`
- Delete through merge: `docs/superpowers/specs/2026-07-31-general-learning-kernel-design.md`

**Interfaces:**

- Consumes: clean `main@a4f0c12`、包含完整节点实现和本计划的 `codex/studyforge-node-workspace`。
- Produces: 一个保留两侧历史的 merge commit；`main` 成为节点分支祖先。

- [ ] **Step 1: 核实节点工作树只有已知生成目录未跟踪**

```bash
MAIN=/Users/yangrundong/Documents/GitHub/highschool-study-claude-code
NODE="$MAIN/.worktrees/studyforge-node-workspace"

test "$(git -C "$NODE" branch --show-current)" = codex/studyforge-node-workspace
git -C "$NODE" diff --quiet
git -C "$NODE" diff --cached --quiet
git -C "$NODE" status --short
```

Expected: tracked tree clean；只显示 `.playwright-cli/`、`.superpowers/` 与 `apps/pi-teaching-web/.playwright-cli/` 三个生成目录。

- [ ] **Step 2: 在不改工作树的情况下验证三方合并结果**

```bash
merged_tree="$(git -C "$NODE" merge-tree --write-tree HEAD main)"
test -n "$merged_tree"

git -C "$NODE" show "$merged_tree:README.md" | rg -F 'Roadmap、Plan 和 Lesson 不是三个松散列表，而是一棵控制树。'
git -C "$NODE" show "$merged_tree:README.md" | rg -F '/Users/yangrundong/Documents/GitHub/zhiye'
test -z "$(git -C "$NODE" ls-tree -r --name-only "$merged_tree" -- \
  docs/superpowers/plans/2026-07-31-general-multi-book-learning-app.md \
  docs/superpowers/specs/2026-07-31-general-learning-kernel-design.md)"
```

Expected: `git merge-tree --write-tree` 退出 0；合成 README 同时含节点树说明和知页迁移说明；两份知页专属文档不在合成树中。

- [ ] **Step 3: 创建非重写式 merge commit**

```bash
git -C "$NODE" merge --no-ff main -m "merge: align node workspace with current main"
```

Expected: Git 自动合并 README，并删除两份知页专属文档；没有冲突。若出现冲突，执行 `git -C "$NODE" merge --abort` 并停止本计划。

- [ ] **Step 4: 验证历史、README 和删除结果**

```bash
git -C "$NODE" merge-base --is-ancestor main HEAD
git -C "$NODE" merge-base --is-ancestor 744a980ab6e4143671c5e599bd94dc0be2fcf067 HEAD
git -C "$NODE" merge-base --is-ancestor ba9a380549553a1f7eb6978d044fb3ad25f910e5 HEAD

test ! -e "$NODE/docs/superpowers/plans/2026-07-31-general-multi-book-learning-app.md"
test ! -e "$NODE/docs/superpowers/specs/2026-07-31-general-learning-kernel-design.md"
rg -F 'Roadmap、Plan 和 Lesson 不是三个松散列表，而是一棵控制树。' "$NODE/README.md"
rg -F '/Users/yangrundong/Documents/GitHub/zhiye' "$NODE/README.md"
rg -F '学习节点树与证据继承协议' "$NODE/README.md"
git -C "$NODE" log -1 --merges --oneline
```

Expected: 三个祖先检查全部通过；README 保留三条目标信息；最新 merge commit 为 `merge: align node workspace with current main`。

- [ ] **Step 5: 检查合并后工作树**

```bash
git -C "$NODE" diff --check
git -C "$NODE" diff --quiet
git -C "$NODE" diff --cached --quiet
git -C "$NODE" status --short
```

Expected: tracked tree clean；仍只有三个已知生成目录未跟踪。

---

### Task 3: 审计 `744a980` 三项教学小修在当前语义所有者中仍然生效

**Files:**

- Inspect: `apps/pi-teaching-web/src/runtime/study-tools.ts`
- Inspect: `apps/pi-teaching-web/resources/skills/{coach-study,tutor-lesson}/SKILL.md`
- Inspect: `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
- Inspect: `plugins/highschool-study/skills/run-lesson/references/evidence-protocol.md`
- Test: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- Test: `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`
- Test: `plugins/highschool-study/tests/contract/mcp-tools.test.ts`
- Test: `plugins/highschool-study/tests/e2e/markdown-learning-loop.test.ts`

**Interfaces:**

- Consumes: merge 后节点分支与 `744a980` 的既有实现。
- Produces: 紧凑检索、诚实归因、长题 composer 三项独立通过的回归证据；不产生新 commit。

- [ ] **Step 1: 验证 Coach 的卡片与 Trace 召回保持元数据化**

```bash
cd /Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/studyforge-node-workspace/apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts
```

Expected: 文件内全部测试通过，其中 `keeps Plan Coach card and Trace search payloads metadata-only` 通过，卡片 payload 只有 `goal`、`methods`、`path`、`title`、`traceHistory`。

- [ ] **Step 2: 验证 Claude 插件仍只有四个真实工具及双向检索闭环**

```bash
cd /Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/studyforge-node-workspace/plugins/highschool-study
bun test tests/contract/mcp-tools.test.ts tests/e2e/markdown-learning-loop.test.ts
```

Expected: 两个测试文件全部通过；公共工具集合恰好为四个，空搜索仍是真实性边界。

- [ ] **Step 3: 逐条核对当前 Skill 与 tool schema 共同保留归因和撤回语义**

```bash
NODE=/Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/studyforge-node-workspace

rg -F 'A Handoff is an index; resolve its' "$NODE/apps/pi-teaching-web/resources/skills/coach-study/SKILL.md"
rg -F "Card metadata describes the task, not the student's route." "$NODE/apps/pi-teaching-web/resources/skills/coach-study/SKILL.md"
rg -F 'Corrections supersede the active record for that' "$NODE/apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md"
rg -F 'Help actually used in the final route' "$NODE/apps/pi-teaching-web/src/runtime/study-tools.ts"
rg -F 'identifying the exact student-supplied claim behind the assessment' "$NODE/apps/pi-teaching-web/src/runtime/study-tools.ts"
rg -F 'Teacher Control, rubrics, reference solutions, common failures and fallbacks are judging aids, not observations.' "$NODE/plugins/highschool-study/skills/run-lesson/references/evidence-protocol.md"
rg -F 'A Tutor claim the student correctly rejects is not adopted decisive content' "$NODE/plugins/highschool-study/skills/run-lesson/references/evidence-protocol.md"
```

Expected: 七个检索各命中现行语义所有者。紧凑检索由 Step 1 的 Runtime 测试验证；Pi Tutor 的时序规则与 `trace_append` schema 共同约束归因；Claude 插件由 evidence protocol 承载同一含义。不把 `744a980` 的历史原句当成永久接口，也不新增 Skill 文本快照测试。

- [ ] **Step 4: 单独验证超长题面下 composer 可点击**

```bash
cd /Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/studyforge-node-workspace/apps/pi-teaching-web
bunx playwright test tests/e2e/workspace.spec.ts \
  --grep 'keeps the composer clickable when the current problem is taller than the viewport' \
  --reporter=line
```

Expected: 1 passed；1280×720 视口下把题卡拉到 `70rem` 后，提交按钮仍可见且命中测试通过。

- [ ] **Step 5: 确认审计没有修改 tracked 文件**

```bash
git -C /Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/studyforge-node-workspace diff --quiet
git -C /Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/studyforge-node-workspace diff --cached --quiet
```

Expected: 两个命令退出 0。

---

### Task 4: 运行完整自动发布门

**Files:**

- Verify: `plugins/highschool-study/**`
- Verify: `apps/pi-teaching-web/**`
- Generated but untracked: `.playwright-cli/**`
- Generated but untracked: `apps/pi-teaching-web/.playwright-cli/**`

**Interfaces:**

- Consumes: Task 2 的 merge commit 和 Task 3 的定向通过结果。
- Produces: 插件、Pi App、生产构建和全部浏览器 E2E 的统一通过证据；不产生新 commit。

- [ ] **Step 1: 重建并验证 Claude Code 插件**

```bash
cd /Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/studyforge-node-workspace/plugins/highschool-study
bun install --frozen-lockfile
bun run release:check
```

Expected: bundle 构建、TypeScript、71 个测试、`claude plugin validate . --strict` 全部通过；`tests/contract/mcp-tools.test.ts` 继续证明公共 MCP 数量为 4。

- [ ] **Step 2: 运行 Pi App 类型、非浏览器测试和生产构建**

```bash
cd /Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/studyforge-node-workspace/apps/pi-teaching-web
bun install --frozen-lockfile
bun run check
```

Expected: typecheck 通过，394 个非 E2E 测试通过，Vite production build 退出 0；仅允许已知 chunk-size 提示。

- [ ] **Step 3: 运行全部浏览器 E2E**

```bash
cd /Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/studyforge-node-workspace/apps/pi-teaching-web
bun run test:e2e
```

Expected: 38 passed，0 failed；课程树、节点生命周期、路由恢复、三坐标切换、证据下钻、终态只读与 composer 均通过。

- [ ] **Step 4: 验证构建没有制造 tracked diff**

```bash
NODE=/Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/studyforge-node-workspace
git -C "$NODE" diff --check
git -C "$NODE" diff --quiet
git -C "$NODE" diff --cached --quiet
git -C "$NODE" status --short
```

Expected: `plugins/highschool-study/dist/mcp-server.js` 与源码同步且无 diff；tracked tree clean；仅三个已知生成目录未跟踪。

---

### Task 5: 在复制导数学习集上完成一节真实短课

**Files:**

- Create outside repo: `/tmp/studyforge-node-mainline-acceptance-XXXXXX/**`
- Create: `docs/audits/2026-07-31-studyforge-node-mainline-integration.md`
- Inspect only: Pi Session JSONL associated with the copied workspace

**Interfaces:**

- Consumes: Task 4 已构建的 production App、现有本地 Pi provider 配置和空白节点化导数示例。
- Produces: Roadmap Candidate → prepared/active Plan → prepared/active/closed Lesson → active Trace → Lesson Handoff 的真实闭环，以及 Course/Knowledge/Memory 一致投影。

- [ ] **Step 1: 创建隔离副本并冻结公开示例状态**

```bash
NODE=/Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/studyforge-node-workspace
git -C "$NODE" diff --quiet -- examples/derivative-demo/learning-set
test -z "$(git -C "$NODE" status --porcelain -- examples/derivative-demo/learning-set)"

ACCEPTANCE_ROOT="$(mktemp -d /tmp/studyforge-node-mainline-acceptance-XXXXXX)"
cp -R "$NODE/examples/derivative-demo/." "$ACCEPTANCE_ROOT/"
printf '%s\n' "$ACCEPTANCE_ROOT" > /tmp/studyforge-node-mainline-acceptance.path

test -f "$ACCEPTANCE_ROOT/learning-set/ROADMAP.md"
test -f "$ACCEPTANCE_ROOT/learning-set/graph/method_tree.yaml"
test "$(find "$ACCEPTANCE_ROOT/learning-set/cards" -name '*.card.yaml' | wc -l | tr -d ' ')" = 519
printf 'acceptance_root=%s\n' "$ACCEPTANCE_ROOT"
```

Expected: 新副本包含空白 Roadmap、方法树和 519 张题卡；仓库示例无 diff。

- [ ] **Step 2: 用固定端口启动候选分支 production server**

```bash
NODE=/Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/studyforge-node-workspace
ACCEPTANCE_ROOT="$(cat /tmp/studyforge-node-mainline-acceptance.path)"
test -z "$(lsof -tiTCP:65439 -sTCP:LISTEN)"

cd "$NODE/apps/pi-teaching-web"
STUDY_LEARNING_SET="$ACCEPTANCE_ROOT/learning-set" \
STUDY_WEB_PORT=65439 \
bun run start > /tmp/studyforge-node-mainline-server.log 2>&1 &
printf '%s\n' "$!" > /tmp/studyforge-node-mainline-server.pid

for attempt in {1..30}; do
  curl -fsS http://127.0.0.1:65439/api/health && break
  sleep 1
done
curl -fsS http://127.0.0.1:65439/api/health
```

Expected: 最迟 30 秒内 health 返回 200；日志首行包含 `StudyForge Pi Web: http://127.0.0.1:65439`。

- [ ] **Step 3: 用自然学生话术走完 Roadmap 与 Plan 问诊**

在浏览器打开 `http://127.0.0.1:65439/course`，按真实 UI 操作，不直接编辑 Markdown：

1. 向 Roadmap Coach 发送：`我常规求导没问题，但综合题里两条路线都能走时容易犹豫。先给我安排一个很短的阶段，用两道不同题看我能不能在动笔前说清为什么选这条路；今天只上第一节。`
2. 对 Coach 每次只回答当前一个追问；回答必须来自这个学生设定，不替 Agent 填计划字段。
3. 等 Roadmap 产生至少一个 Plan Candidate 后，由学生显式选择最贴近“先比较路线再动笔”的 Candidate。
4. 在 prepared Plan 页面点击开始，确认进入独立 Plan Coach Session；刷新一次，路由和 Session 不变。
5. 向 Plan Coach 发送：`今天只上十到十五分钟。你先问清楚要观察什么，再准备一节只做一道题的短课。`
6. 完成逐轮问诊，确认无剧透公开目的；等 Coach 创建一个 Lesson Candidate 并只物化这一节。

Expected: Candidate 在选择前没有文件或 Session；prepared Plan/Lesson 只有学生显式点击后激活；Coach 课前摘要不暴露答案、决定性变形或 Teacher Control。

- [ ] **Step 4: 以真实学生表现完成一个 problem Block 并关课**

1. 点击开始 prepared Lesson，确认 Tutor 使用独立 Session，页面只揭示当前 Student View。
2. 对真实题目先给出一段可判断但不刻意完美的思路；若确实卡住，只说：`给我一个方向性提示就行，先别展开完整做法。`
3. 根据 Tutor 提示继续作答，并如实回答提示是否改变了最终路线。
4. Tutor 提议方法节点时，只在节点与这一问的完整解法真正贴切时确认；不贴切就明确拒绝，不能为了测试硬绑。
5. 确认至少一次真实作答已经写入 Trace；若获得 Tutor 决定性提示，active Trace 的 `support` 必须为 `tutor`。
6. 发送：`这节课到这里，可以结束。请按刚才实际发生的情况收口。`
7. 等 `lesson_close` 成功后刷新页面，确认进入只读 Replay，并返回原 Plan Coach 页面。

Expected: 一张题卡对应一个 problem Block；Trace 绑定真实 Plan/Lesson/Block/card；关课由学生决定；Lesson Handoff 能回溯到 active Trace 或形成合法 source-only 索引。

- [ ] **Step 5: 从 Markdown 事实中读取本轮坐标并验证绑定**

```bash
ACCEPTANCE_ROOT="$(cat /tmp/studyforge-node-mainline-acceptance.path)"
PLAN_PATH="$(find "$ACCEPTANCE_ROOT/learning-set/plans" -type f -name '*.md' | sort | head -n 1)"
LESSON_PATH="$(find "$ACCEPTANCE_ROOT/learning-set/lessons" -type f -name '*.md' | sort | head -n 1)"
TRACE_PATH="$(find "$ACCEPTANCE_ROOT/learning-set/traces" -type f -name '*.md' | sort | tail -n 1)"

test -n "$PLAN_PATH"
test -n "$LESSON_PATH"
test -n "$TRACE_PATH"

PLAN_ID="$(awk -F': ' '$1 == "id" {gsub(/\r/, "", $2); print $2; exit}' "$PLAN_PATH")"
LESSON_ID="$(awk -F': ' '$1 == "id" {gsub(/\r/, "", $2); print $2; exit}' "$LESSON_PATH")"
TRACE_ID="$(awk -F': ' '$1 == "id" {gsub(/\r/, "", $2); print $2; exit}' "$TRACE_PATH")"
CARD_PATH="$(awk -F': ' '$1 == "card_path" {gsub(/\r/, "", $2); print $2; exit}' "$TRACE_PATH")"

rg -F 'status: active' "$PLAN_PATH"
rg -F 'status: closed' "$LESSON_PATH"
rg -F 'parent_path: ROADMAP.md' "$PLAN_PATH"
rg -F "parent_path: plans/$PLAN_ID.md" "$LESSON_PATH"
if rg -F 'coach_session: null' "$PLAN_PATH"; then exit 1; fi
if rg -F 'tutor_session: null' "$LESSON_PATH"; then exit 1; fi
if rg -F 'Activated at: pending' "$PLAN_PATH" "$LESSON_PATH"; then exit 1; fi
rg -F "plan_id: $PLAN_ID" "$TRACE_PATH"
rg -F "lesson_id: $LESSON_ID" "$TRACE_PATH"
rg -n '^block_id: .+' "$TRACE_PATH"
rg -n '^card_path: cards/.+\.card\.yaml$' "$TRACE_PATH"
test -f "$ACCEPTANCE_ROOT/learning-set/$CARD_PATH"
rg -F "$CARD_PATH" "$LESSON_PATH"
rg -F '## Handoff' "$LESSON_PATH"
rg -F "trace:$TRACE_ID" "$LESSON_PATH"

printf 'plan=%s\nlesson=%s\ntrace=%s\ncard=%s\n' "$PLAN_ID" "$LESSON_ID" "$TRACE_ID" "$CARD_PATH"
```

Expected: Plan 仍 active，Lesson closed；父子路径、非空 Session owner 和 Activation Snapshot 均已冻结；Trace 的四重身份完整并解析到真实题卡；Handoff 引用这条 active Trace。若 Handoff 是合法 source-only 形式，也必须在 Source Index 中出现由 `trace:` 与真实 Trace ID 组成的同一 source handle。

- [ ] **Step 6: 从三个只读 API 验证同一坐标与来源**

```bash
ACCEPTANCE_ROOT="$(cat /tmp/studyforge-node-mainline-acceptance.path)"
PLAN_PATH="$(find "$ACCEPTANCE_ROOT/learning-set/plans" -type f -name '*.md' | sort | head -n 1)"
LESSON_PATH="$(find "$ACCEPTANCE_ROOT/learning-set/lessons" -type f -name '*.md' | sort | head -n 1)"
TRACE_PATH="$(find "$ACCEPTANCE_ROOT/learning-set/traces" -type f -name '*.md' | sort | tail -n 1)"
export PLAN_ID="$(awk -F': ' '$1 == "id" {gsub(/\r/, "", $2); print $2; exit}' "$PLAN_PATH")"
export LESSON_ID="$(awk -F': ' '$1 == "id" {gsub(/\r/, "", $2); print $2; exit}' "$LESSON_PATH")"
export TRACE_ID="$(awk -F': ' '$1 == "id" {gsub(/\r/, "", $2); print $2; exit}' "$TRACE_PATH")"

curl -fsSG http://127.0.0.1:65439/api/views/course \
  --data-urlencode "plan=$PLAN_ID" \
  --data-urlencode "lesson=$LESSON_ID" \
  > /tmp/studyforge-node-mainline-course.json
curl -fsSG http://127.0.0.1:65439/api/views/knowledge \
  --data-urlencode "plan=$PLAN_ID" \
  --data-urlencode "lesson=$LESSON_ID" \
  > /tmp/studyforge-node-mainline-knowledge.json
curl -fsSG http://127.0.0.1:65439/api/views/memory \
  --data-urlencode "plan=$PLAN_ID" \
  --data-urlencode "lesson=$LESSON_ID" \
  --data-urlencode "source=trace:$TRACE_ID" \
  > /tmp/studyforge-node-mainline-memory.json

bun -e '
const course = await Bun.file("/tmp/studyforge-node-mainline-course.json").json();
const knowledge = await Bun.file("/tmp/studyforge-node-mainline-knowledge.json").json();
const memory = await Bun.file("/tmp/studyforge-node-mainline-memory.json").json();
const planId = process.env.PLAN_ID;
const lessonId = process.env.LESSON_ID;
const traceSource = `trace:${process.env.TRACE_ID}`;
if (course.selectedPlan?.id !== planId) throw new Error("course plan mismatch");
if (course.selectedLesson?.id !== lessonId) throw new Error("course lesson mismatch");
if (course.selectedLesson?.status !== "closed") throw new Error("course lesson not closed");
if (memory.selectedSource !== traceSource) throw new Error("memory source mismatch");
if (!JSON.stringify(memory).includes(traceSource)) throw new Error("memory lineage missing trace");
const safe = JSON.stringify({ course, knowledge, memory });
for (const forbidden of ["Teacher Control", "source_solution_summary", "rubric"]) {
  if (safe.includes(forbidden)) throw new Error(`student projection leaked ${forbidden}`);
}
console.log(JSON.stringify({
  planId,
  lessonId,
  traceSource,
  knowledgeEvidence: JSON.stringify(knowledge).includes(traceSource),
  memoryLineage: true,
}, null, 2));
'

printf 'classroom_url=http://127.0.0.1:65439/course/plan/%s/lesson/%s\n' "$PLAN_ID" "$LESSON_ID"
printf 'knowledge_url=http://127.0.0.1:65439/knowledge?plan=%s&lesson=%s\n' "$PLAN_ID" "$LESSON_ID"
printf 'memory_url=http://127.0.0.1:65439/memory?plan=%s&lesson=%s&source=trace%%3A%s\n' "$PLAN_ID" "$LESSON_ID" "$TRACE_ID"
```

Expected: Course 指向同一 closed Lesson，Memory 能按同一 Trace 下钻，三个 JSON 都不含私有字段。若学生确认了正式方法节点，`knowledgeEvidence` 应为 `true`；若学生明确拒绝映射，则必须为 `false`，并在验收报告中记录“未制造错误方法边”。

- [ ] **Step 7: 验证浏览器刷新和三坐标切换不改变事实**

使用 Step 6 打印的三个完整 URL：

1. 打开 `classroom_url`，确认只读 Replay。
2. 刷新，确认仍停在同一路由，没有新 Session、激活或 Trace。
3. 打开 `knowledge_url`，确认 Plan/Lesson 筛选坐标保留；若方法已确认，能看到 active Trace 观察但没有掌握百分比。
4. 打开 `memory_url`，确认能回到 Plan、Lesson、Block 和题卡来源。
5. 切回 Course，确认 Lesson 仍 closed，原 Plan Coach 可继续。

Expected: 三个页面只是同一 Markdown/Trace/Session 事实的只读投影；切换和刷新不写入新事实。

- [ ] **Step 8: 停止服务并确认公开示例未被写入**

```bash
kill "$(cat /tmp/studyforge-node-mainline-server.pid)"
wait "$(cat /tmp/studyforge-node-mainline-server.pid)" 2>/dev/null || true

NODE=/Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/studyforge-node-workspace
git -C "$NODE" diff --quiet -- examples/derivative-demo/learning-set
test -z "$(git -C "$NODE" status --porcelain -- examples/derivative-demo/learning-set)"
git -C "$NODE" status --short
```

Expected: server 停止；公开示例没有 diff；节点工作树 tracked clean。

- [ ] **Step 9: 写入候选分支验收记录**

创建 `docs/audits/2026-07-31-studyforge-node-mainline-integration.md`，按以下固定章节记录本轮实际观察，不复制完整聊天：

1. `基线与拓扑`：main、节点候选、merge commit、`744a980`、parking commit 的真实 hash。
2. `补丁去重`：两个 patch-id 及 11 文件清单结论。
3. `自动发布门`：插件、Pi、E2E 的真实 pass 数和退出状态。
4. `真实短课节点`：副本路径、provider/model 名称、Plan/Lesson/Trace ID 和 Session owner；不写凭据或 Base URL。
5. `事实写入链`：Candidate、激活、Trace、Handoff、Replay 的观察结果。
6. `三坐标投影`：Course、Knowledge、Memory 如何读取同一 Plan/Lesson/Trace；注明方法映射是否经学生确认。
7. `边界检查`：公开示例未修改、无 Teacher Control 泄漏、无旧结构兼容、无新增 MCP。
8. `候选结论`：只有上述门全部通过时写“节点化候选可进入主线切换”。

Expected: 每项结论都有命令输出、文件来源或页面观察支撑；不写“应该”“推测”或未发生的课堂能力结论。

- [ ] **Step 10: 提交候选验收记录**

```bash
NODE=/Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/studyforge-node-workspace
git -C "$NODE" add docs/audits/2026-07-31-studyforge-node-mainline-integration.md
test "$(git -C "$NODE" diff --cached --name-only)" = docs/audits/2026-07-31-studyforge-node-mainline-integration.md
git -C "$NODE" diff --cached --check
git -C "$NODE" commit -m "test: record node mainline acceptance"
git -C "$NODE" status --short
```

Expected: 只提交一份验收记录；tracked tree clean，三个生成目录仍未跟踪。

---

### Task 6: Fast-forward `main`、重装并完成生产 smoke

**Files:**

- Modify: `docs/audits/2026-07-31-studyforge-node-mainline-integration.md`
- External install: Pi package settings managed by `pi install`
- Preserve untracked in main: `.superpowers/**`
- Preserve untracked in main: `docs/superpowers/plans/2026-07-22-three-lesson-teaching-quality-optimization.md`

**Interfaces:**

- Consumes: Task 5 已通过且已提交的节点候选分支。
- Produces: fast-forward 后的新 `main`、指向新主线的本地 Pi 安装、生产 smoke 记录，以及与 `main` 对齐的节点分支。

- [ ] **Step 1: 冻结候选目标并再次检查两个工作树**

```bash
MAIN=/Users/yangrundong/Documents/GitHub/highschool-study-claude-code
NODE="$MAIN/.worktrees/studyforge-node-workspace"
TARGET="$(git -C "$NODE" rev-parse HEAD)"
printf '%s\n' "$TARGET" > /tmp/studyforge-node-mainline-target

test "$(git -C "$MAIN" branch --show-current)" = main
test "$(git -C "$MAIN" rev-parse HEAD)" = a4f0c126fcfffb88bc4c3fe4ec5d5d8e2eed5260
git -C "$MAIN" diff --quiet
git -C "$MAIN" diff --cached --quiet

test "$(git -C "$NODE" branch --show-current)" = codex/studyforge-node-workspace
git -C "$NODE" diff --quiet
git -C "$NODE" diff --cached --quiet
git -C "$NODE" merge-base --is-ancestor main HEAD
```

Expected: main 仍停在旧锚点且 tracked clean；节点分支 tracked clean，并已经包含 main。

- [ ] **Step 2: 只用 fast-forward 切换主线**

```bash
MAIN=/Users/yangrundong/Documents/GitHub/highschool-study-claude-code
TARGET="$(cat /tmp/studyforge-node-mainline-target)"
git -C "$MAIN" merge --ff-only codex/studyforge-node-workspace
test "$(git -C "$MAIN" rev-parse HEAD)" = "$TARGET"
git -C "$MAIN" merge-base --is-ancestor 744a980ab6e4143671c5e599bd94dc0be2fcf067 HEAD
git -C "$MAIN" merge-base --is-ancestor a4f0c126fcfffb88bc4c3fe4ec5d5d8e2eed5260 HEAD
```

Expected: `main` 直接快进到候选验收提交，没有额外合并提交，也没有覆盖未跟踪文件。

- [ ] **Step 3: 从新 `main` 重建两个产品**

```bash
MAIN=/Users/yangrundong/Documents/GitHub/highschool-study-claude-code

cd "$MAIN/plugins/highschool-study"
bun install --frozen-lockfile
bun run release:check

cd "$MAIN/apps/pi-teaching-web"
bun install --frozen-lockfile
bun run check
```

Expected: 插件 71 pass、strict validation 通过；Pi 394 pass、typecheck 与 production build 通过。

- [ ] **Step 4: 重装本地 Pi App 并核对安装源**

```bash
cd /Users/yangrundong/Documents/GitHub/highschool-study-claude-code/apps/pi-teaching-web
pi install "$PWD" --approve
pi list
```

Expected: `pi list` 显示本地 StudyForge package 来自新 `main/apps/pi-teaching-web`；不得打印 provider 凭据。

- [ ] **Step 5: 从新主线运行固定端口 production smoke**

```bash
MAIN=/Users/yangrundong/Documents/GitHub/highschool-study-claude-code
ACCEPTANCE_ROOT="$(cat /tmp/studyforge-node-mainline-acceptance.path)"
test -z "$(lsof -tiTCP:65440 -sTCP:LISTEN)"

cd "$MAIN/apps/pi-teaching-web"
STUDY_LEARNING_SET="$ACCEPTANCE_ROOT/learning-set" \
STUDY_WEB_PORT=65440 \
bun run start > /tmp/studyforge-node-mainline-main-server.log 2>&1 &
printf '%s\n' "$!" > /tmp/studyforge-node-mainline-main-server.pid

for attempt in {1..30}; do
  curl -fsS http://127.0.0.1:65440/api/health && break
  sleep 1
done
curl -fsS http://127.0.0.1:65440/api/health
curl -fsS http://127.0.0.1:65440/course > /dev/null
curl -fsS http://127.0.0.1:65440/knowledge > /dev/null
curl -fsS http://127.0.0.1:65440/memory > /dev/null
```

Expected: health 与三个 SPA route 都返回 200。

- [ ] **Step 6: 完成主线浏览器 smoke**

先从复制学习集打印新端口下的三个完整 URL：

```bash
ACCEPTANCE_ROOT="$(cat /tmp/studyforge-node-mainline-acceptance.path)"
PLAN_PATH="$(find "$ACCEPTANCE_ROOT/learning-set/plans" -type f -name '*.md' | sort | head -n 1)"
LESSON_PATH="$(find "$ACCEPTANCE_ROOT/learning-set/lessons" -type f -name '*.md' | sort | head -n 1)"
TRACE_PATH="$(find "$ACCEPTANCE_ROOT/learning-set/traces" -type f -name '*.md' | sort | tail -n 1)"
PLAN_ID="$(awk -F': ' '$1 == "id" {gsub(/\r/, "", $2); print $2; exit}' "$PLAN_PATH")"
LESSON_ID="$(awk -F': ' '$1 == "id" {gsub(/\r/, "", $2); print $2; exit}' "$LESSON_PATH")"
TRACE_ID="$(awk -F': ' '$1 == "id" {gsub(/\r/, "", $2); print $2; exit}' "$TRACE_PATH")"

printf 'classroom_url=http://127.0.0.1:65440/course/plan/%s/lesson/%s\n' "$PLAN_ID" "$LESSON_ID"
printf 'knowledge_url=http://127.0.0.1:65440/knowledge?plan=%s&lesson=%s\n' "$PLAN_ID" "$LESSON_ID"
printf 'memory_url=http://127.0.0.1:65440/memory?plan=%s&lesson=%s&source=trace%%3A%s\n' "$PLAN_ID" "$LESSON_ID" "$TRACE_ID"
```

然后完成浏览器检查：

1. 打开 `http://127.0.0.1:65440/course`，确认默认页面为 Course，课程树包含真实 Plan 和 closed Lesson。
2. 打开打印出的 `classroom_url`，确认只读 Replay；刷新后仍在同一深链。
3. 打开打印出的 `knowledge_url`，确认图谱可见且没有未揭示 Teacher Control。
4. 打开打印出的 `memory_url`，确认来源链可下钻。
5. 返回 Course，确认没有新增 Trace、Session 或节点状态变化。

Expected: 默认 Course、Knowledge、Memory 和课堂深链全部可用；页面切换不修改事实。

- [ ] **Step 7: 停止服务并把主线切换结果补入同一验收记录**

```bash
kill "$(cat /tmp/studyforge-node-mainline-main-server.pid)"
wait "$(cat /tmp/studyforge-node-mainline-main-server.pid)" 2>/dev/null || true
```

在 `docs/audits/2026-07-31-studyforge-node-mainline-integration.md` 追加 `主线切换与本地安装` 章节，记录：

- fast-forward 前后真实 hash；
- 新 `main` 的插件和 Pi 复验结果；
- `pi list` 中的本地安装源；
- 65440 production smoke 的四个 route；
- 主工作树两个原有未跟踪入口仍保留；
- 最终结论“StudyForge 主线已切换到节点化 Runtime，旧线性 Runtime 不再是开发基线”。

Expected: 报告只增加本轮真实观察，不重写 Task 5 的候选验收事实。

- [ ] **Step 8: 提交最终切换记录并让节点分支对齐**

```bash
MAIN=/Users/yangrundong/Documents/GitHub/highschool-study-claude-code
NODE="$MAIN/.worktrees/studyforge-node-workspace"

git -C "$MAIN" add docs/audits/2026-07-31-studyforge-node-mainline-integration.md
test "$(git -C "$MAIN" diff --cached --name-only)" = docs/audits/2026-07-31-studyforge-node-mainline-integration.md
git -C "$MAIN" diff --cached --check
git -C "$MAIN" commit -m "test: record StudyForge node mainline cutover"

git -C "$NODE" merge --ff-only main
test "$(git -C "$MAIN" rev-parse HEAD)" = "$(git -C "$NODE" rev-parse HEAD)"
```

Expected: 最终审计提交只修改一份报告；节点分支 fast-forward 到同一提交。

- [ ] **Step 9: 最终完整性检查**

```bash
MAIN=/Users/yangrundong/Documents/GitHub/highschool-study-claude-code
NODE="$MAIN/.worktrees/studyforge-node-workspace"

git -C "$MAIN" diff --check
git -C "$MAIN" diff --quiet
git -C "$MAIN" diff --cached --quiet
git -C "$NODE" diff --quiet
git -C "$NODE" diff --cached --quiet

git -C "$MAIN" merge-base --is-ancestor 744a980ab6e4143671c5e599bd94dc0be2fcf067 HEAD
git -C "$MAIN" merge-base --is-ancestor ba9a380549553a1f7eb6978d044fb3ad25f910e5 HEAD
git -C "$MAIN" merge-base --is-ancestor a4f0c126fcfffb88bc4c3fe4ec5d5d8e2eed5260 HEAD
test "$(git -C "$MAIN" rev-list --count f0a4b3df0077a5e2faf26630ea68e637352fb381..ba9a380549553a1f7eb6978d044fb3ad25f910e5)" = 54
if git -C "$MAIN" merge-base --is-ancestor codex/pre-node-hotfixes HEAD; then exit 1; fi

test ! -e "$MAIN/apps/general-learning-web"
test ! -e "$MAIN/docs/superpowers/plans/2026-07-31-general-multi-book-learning-app.md"
test ! -e "$MAIN/docs/superpowers/specs/2026-07-31-general-learning-kernel-design.md"
rg -F '/Users/yangrundong/Documents/GitHub/zhiye' "$MAIN/README.md"
rg -F '学习节点树与证据继承协议' "$MAIN/README.md"

git -C "$MAIN" status --short
git -C "$NODE" status --short
git -C "$MAIN" log --oneline --decorate -8
```

Expected: 两个工作树 tracked clean 且 HEAD 相同；main 保留旧主线、54 个既有节点化实现提交、整合设计/计划和验收记录；知页源码及专属设计不在 StudyForge；主工作树只剩原有两个未跟踪入口，节点工作树只剩三个生成目录。

## Completion Gate

以下条件必须同时成立，才能报告整合完成：

- `codex/pre-node-hotfixes` 的提交与 `744a980` patch-id 相同，且未合入主线形成重复补丁。
- `main` 和 `codex/studyforge-node-workspace` 最终指向同一 commit。
- `a4f0c12`、`744a980`、`ba9a380` 都是新 `main` 的祖先。
- 插件 `release:check`、Pi `check`、38 项 E2E 和一节复制学习集真实短课全部通过。
- Course、Knowledge、Memory、课堂 Replay 和刷新路由读取同一组节点事实，不泄露 Teacher Control。
- `examples/derivative-demo/learning-set/**` 没有验收写入。
- 本地 Pi 安装来自新 `main/apps/pi-teaching-web`，生产 smoke 通过。
- 没有加入旧结构兼容、额外工具、额外 Agent、数据库或防御性框架。
