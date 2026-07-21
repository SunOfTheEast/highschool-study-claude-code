# 学习集概述注入与可切换人设实施计划

> **供 Agent 执行者使用：** 必须逐任务使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`。所有执行步骤均用复选框（`- [ ]`）跟踪。任务 2 创建 Claude Code Skill 时还必须使用 `superpowers:writing-skills`。

**目标：** 让每次 `highschool-study:study` 进入都能读取学习集概述并解析一份学生可切换的展示人设，同时保持 Roadmap、Plan、Lesson、题卡、Trace 与长期画像的现有语义不变。

**架构：** 新增一个不可直接调用的 `enter-learning-set` Skill，由 `study` 在任何路由判断前调用。概述来自 `ROADMAP.md`；人设按 Session 临时选择、`CLAUDE.local.md`、`CLAUDE.md`、插件默认的顺序解析，且每次只读最终选中的一份 Markdown 人设。这是 Skill 与项目配置层的功能，不修改四个 MCP 工具，也不新增 Agent。

**技术栈：** Claude Code plugin Skills/Agents、`CLAUDE.md`、`CLAUDE.local.md`、Markdown、Bun 1.3.14、TypeScript 7.0.2、`bun:test`、Claude Code CLI 真实模型 smoke test。

## 全局约束

- 实现位于已发布的 `plugins/highschool-study/`，不新建第二套插件。
- 不修改 MCP 工具列表、MCP schema、Trace 格式、题卡格式或知识图谱。
- 不新增 Agent；`study-coach` 仍是唯一面向学生的入口，`lesson-designer` 仍保持中性。
- `enter-learning-set` 必须在 `study` 任何 Roadmap、Plan 或 Lesson 路由之前运行。
- 学习集概述必须来自 `ROADMAP.md`。每次进入都读取；仅在无任何 `## Trace event-` 标题或学生主动询问时对外展开。
- 人设优先级固定为：当前 Session 临时选择 → `learning-set/CLAUDE.local.md` → `learning-set/CLAUDE.md` → 插件 `neutral-tutor`。
- 学习集 `.claude/personas/<id>.md` 覆盖插件内置的同名人设。只能从 `Glob` 真实列出的文件中选择，不从学生文本拼路径。
- 临时切换不写文件。持久切换只编辑 `CLAUDE.local.md` 中的 `## Highschool Study Presentation` 小节，保留该文件的其他内容。
- 人设只改变学生可见文字的称呼、语气、比喻和鼓励方式。它不进入 Trace、Lesson Summary、Plan Summary、`student-profile.md`、`teaching-profile.md` 或 `planner-attention.md`。
- 人设不得改变能力判断、题卡选择、评价、测试标准、课程关闭条件或证据真实性。
- 不使用 `@` import 加载全部人设，不新增人设数据库、规则引擎、Hook 或运行时依赖。
- 先写失败的 contract test，再写 Skill/模板；最后必须运行 `bun run release:check` 和真实 Claude Code smoke test。

## 文件职责图

| 职责 | 文件 |
| --- | --- |
| 学习集稳定配置 | `plugins/highschool-study/learning-set-template/CLAUDE.md` |
| 本地偏好忽略 | `plugins/highschool-study/learning-set-template/.gitignore` |
| 概述源 | `plugins/highschool-study/learning-set-template/ROADMAP.md` |
| 学习集自定义人设目录 | `plugins/highschool-study/learning-set-template/.claude/personas/.gitkeep` |
| 进入与人设解析 | `plugins/highschool-study/skills/enter-learning-set/SKILL.md` |
| 内置人设 | `plugins/highschool-study/skills/enter-learning-set/references/personas/*.md` |
| 入口路由 | `plugins/highschool-study/skills/study/SKILL.md` |
| 面向学生的边界 | `plugins/highschool-study/agents/study-coach.md` |
| 静态 contract | `plugins/highschool-study/tests/contract/package-and-template.test.ts`、`agent-and-skills.test.ts` |
| 公开试用集 | `examples/derivative-demo/CLAUDE.md`、`learning-set/**` |
| 说明文档 | `README.md`、`plugins/highschool-study/README.md`、`docs/zh-CN/完整说明书.md`、`examples/derivative-demo/README.md` |

---

### 任务 1：扩展学习集模板

**文件：**

- 修改：`plugins/highschool-study/tests/contract/package-and-template.test.ts`
- 新建：`plugins/highschool-study/learning-set-template/CLAUDE.md`
- 新建：`plugins/highschool-study/learning-set-template/.gitignore`
- 新建：`plugins/highschool-study/learning-set-template/.claude/personas/.gitkeep`
- 修改：`plugins/highschool-study/learning-set-template/ROADMAP.md`

**接口：**

- 产出：`ROADMAP.md` 中的 `## Learning Set Overview`。
- 产出：`CLAUDE.md` 中唯一可解析的 `Default presentation persona` 行。
- 产出：被 Git 忽略的 `CLAUDE.local.md` 存储位置与可选本地人设目录。

- [ ] **步骤 1：写失败的模板 contract test**

在 `package-and-template.test.ts` 末尾增加：

```ts
test('ships the learning-set orientation envelope', () => {
  for (const path of [
    'learning-set-template/CLAUDE.md',
    'learning-set-template/.gitignore',
    'learning-set-template/.claude/personas/.gitkeep',
  ]) expect(existsSync(join(root, path))).toBe(true);

  const roadmap = readFileSync(
    join(root, 'learning-set-template/ROADMAP.md'), 'utf8',
  );
  const instructions = readFileSync(
    join(root, 'learning-set-template/CLAUDE.md'), 'utf8',
  );
  const ignore = readFileSync(
    join(root, 'learning-set-template/.gitignore'), 'utf8',
  );

  expect(roadmap).toContain('## Learning Set Overview');
  expect(roadmap).toContain('- What this teaches:');
  expect(instructions).toContain(
    '- Default presentation persona: `neutral-tutor`',
  );
  expect(instructions).toContain('presentation only');
  expect(ignore.split(/\r?\n/)).toContain('CLAUDE.local.md');
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
cd plugins/highschool-study
bun test tests/contract/package-and-template.test.ts
```

预期：FAIL，首个缺失路径是 `learning-set-template/CLAUDE.md`。

- [ ] **步骤 3：写入最小模板内容**

`learning-set-template/CLAUDE.md` 写为：

```markdown
# Highschool Study Learning Set

- Enter study work through `highschool-study:study`.
- Default presentation persona: `neutral-tutor`
- A presentation persona changes student-facing wording only. It never changes teaching facts, capability standards, card selection, Trace, or assessment.
- Use only persona, card, Trace, and source files that really exist. Never invent a missing ID or path.
```

`learning-set-template/.gitignore` 写为：

```gitignore
CLAUDE.local.md
```

创建空文件 `learning-set-template/.claude/personas/.gitkeep`。在 `ROADMAP.md` 的 `# Roadmap` 之后、`## Goal` 之前插入：

```markdown
## Learning Set Overview

- What this teaches:
- Who this is for:
- Approximate Plans:
- Observable result:
```

- [ ] **步骤 4：验证模板 contract**

运行：

```bash
cd plugins/highschool-study
bun test tests/contract/package-and-template.test.ts
```

预期：全部 PASS。

- [ ] **步骤 5：提交模板变更**

```bash
git add plugins/highschool-study/learning-set-template \
  plugins/highschool-study/tests/contract/package-and-template.test.ts
git commit -m "feat: add learning-set presentation config"
```

---

### 任务 2：实现进入 Skill 与人设边界

**必需子 Skill：** `superpowers:writing-skills`

**文件：**

- 修改：`plugins/highschool-study/tests/contract/agent-and-skills.test.ts`
- 新建：`plugins/highschool-study/skills/enter-learning-set/SKILL.md`
- 新建：`plugins/highschool-study/skills/enter-learning-set/references/personas/neutral-tutor.md`
- 新建：`plugins/highschool-study/skills/enter-learning-set/references/personas/calm-senpai.md`
- 新建：`plugins/highschool-study/skills/enter-learning-set/references/personas/energetic-classmate.md`
- 修改：`plugins/highschool-study/skills/study/SKILL.md`
- 修改：`plugins/highschool-study/agents/study-coach.md`

**接口：**

- 消费：当前学生请求、`learning-set/ROADMAP.md`、`CLAUDE.md`、可选 `CLAUDE.local.md`、人设文件列表。
- 产出：概述背景、是否主动展开概述、最终人设 ID/路径/内容、可选回退说明。
- 唯一持久写入：在学生明确要求持久切换时，更新 `learning-set/CLAUDE.local.md` 中的 `Preferred persona` 行。

- [ ] **步骤 1：写失败的 Skill 与 Agent contract**

把 `agent-and-skills.test.ts` 的 fs import 改为：

```ts
import { existsSync, readFileSync } from 'node:fs';
```

然后增加：

```ts
test('enters the learning set before routing and confines personas to presentation', () => {
  const enterPath = 'skills/enter-learning-set/SKILL.md';
  expect(existsSync(join(root, enterPath))).toBe(true);
  const enter = read(enterPath);
  const study = read('skills/study/SKILL.md');
  const coach = read('agents/study-coach.md');

  expect(frontmatter(enter)['user-invocable']).toBe(false);
  expect(toolList(enter, 'allowed-tools')).toEqual([
    'Read', 'Glob', 'Grep', 'Write', 'Edit',
  ]);
  expectInOrder(study, [
    'First invoke `highschool-study:enter-learning-set`',
    'Route an explicit correction request',
  ]);
  expectInOrder(enter, [
    'current Lesson Session',
    '`learning-set/CLAUDE.local.md`',
    '`learning-set/CLAUDE.md`',
    '`neutral-tutor`',
  ]);
  expect(enter).toContain('Read exactly one final persona file');
  expect(enter).toContain('Do not write a temporary choice');
  expect(enter).toContain('## Highschool Study Presentation');
  expect(coach).toContain('presentation layer only');
  expect(coach).toContain('Keep `lesson-designer` persona-neutral');

  for (const id of [
    'neutral-tutor', 'calm-senpai', 'energetic-classmate',
  ]) {
    const persona = read(
      `skills/enter-learning-set/references/personas/${id}.md`,
    );
    expect(persona).toContain(`- ID: \`${id}\``);
    expect(persona).toContain('Presentation only');
  }
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
cd plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts
```

预期：FAIL，缺失 `skills/enter-learning-set/SKILL.md`。

- [ ] **步骤 3：创建 `enter-learning-set` Skill**

`skills/enter-learning-set/SKILL.md` 写为：

```markdown
---
name: enter-learning-set
description: Load the learning-set overview and exactly one presentation persona before routing study work.
user-invocable: false
allowed-tools: Read, Glob, Grep, Write, Edit
---

Run this Skill before any Roadmap, Plan, Lesson, correction, or progress route. Return context to the caller; do not create another Agent or a persisted context object.

## Learning-set overview

1. Read `learning-set/ROADMAP.md` and extract `## Learning Set Overview` on every entry.
2. Use `Grep` over `learning-set/lessons/*.md` for headings matching `^## Trace event-`.
3. Present the overview to the student when no such Trace exists or when the student asks what the learning set is for. Otherwise keep it as background and do not repeat it unprompted.
4. If the overview section is absent, form one short fallback sentence from the Roadmap title, Goal, Plan Graph, and Observable Capability Standard. Do not block study.

## Persona resolution

Resolve in this exact order:

1. an explicit temporary choice already made in the current Lesson Session;
2. `Preferred persona` under `## Highschool Study Presentation` in `learning-set/CLAUDE.local.md`;
3. `Default presentation persona` in `learning-set/CLAUDE.md`;
4. the bundled `neutral-tutor`.

Use `Glob` to enumerate `learning-set/.claude/personas/*.md` and this Skill's `references/personas/*.md`. Match an existing filename stem exactly. A learning-set file with the same stem overrides the bundled file. Do not construct a path from student text and do not invent a persona. If the requested ID is missing, tell the student and fall back to the learning-set default, then to `neutral-tutor` if necessary.

Read exactly one final persona file. Treat "disable personas" as `neutral-tutor`. Apply the selected file only to student-visible wording. Never pass it to `lesson-designer`, and never write it into Trace, summaries, profiles, planner attention, capability judgments, card selection, assessments, or tests.

## Switching

- A request such as "for this lesson" or "temporarily" changes only the current Lesson Session. Do not write a temporary choice.
- A request such as "for this learning set from now on" creates or edits only this section in `learning-set/CLAUDE.local.md`, preserving every other section:

  ```markdown
  ## Highschool Study Presentation

  - Preferred persona: `<existing-persona-id>`
  ```

- "Restore the learning-set default" removes only the `Preferred persona` bullet. "Disable personas for this learning set" stores `neutral-tutor`.

Return the overview text, whether it should be presented, the selected persona ID/path/content, and any fallback notice to `study`.
```

- [ ] **步骤 4：创建三份内置人设**

`neutral-tutor.md`：

```markdown
# Neutral Tutor

- ID: `neutral-tutor`
- Display name: 中性教师
- Address the student naturally as “你”.
- Use calm, direct, concise Chinese without role-play flourishes.
- Encourage concrete progress without exaggerated praise.
- Presentation only: never change teaching facts, evidence, assessment, or capability standards.
```

`calm-senpai.md`：

```markdown
# Calm Senpai

- ID: `calm-senpai`
- Display name: 冷静学姐
- Speak with composed, precise warmth and address the student as “你”.
- Prefer short structural hints such as “我们先把这一层理清”.
- Praise specific reasoning rather than the student's identity.
- Avoid romance, dependency framing, forced catchphrases, or claiming real-world relationships.
- Presentation only: never change teaching facts, evidence, assessment, or capability standards.
```

`energetic-classmate.md`：

```markdown
# Energetic Classmate

- ID: `energetic-classmate`
- Display name: 元气同桌
- Use lively, compact Chinese with a collaborative peer-like tone.
- Celebrate a concrete breakthrough, then immediately name the next step.
- Keep jokes brief and never obscure mathematical notation or evidence.
- Avoid romance, dependency framing, humiliation, or inflated praise.
- Presentation only: never change teaching facts, evidence, assessment, or capability standards.
```

- [ ] **步骤 5：把进入 Skill 接到单一入口**

在 `skills/study/SKILL.md` 路由列表之前增加：

```markdown
First invoke `highschool-study:enter-learning-set` with the current student request. Keep its overview as context, present it only when instructed, and apply its selected persona only to student-visible wording. Do not choose any route until it returns.
```

在 `agents/study-coach.md` 的路由说明之后增加：

```markdown
The selected persona is a presentation layer only. It may change address, tone, metaphors, and encouragement, but never capability judgments, card choice, Trace facts, tests, closure, or memory. Keep `lesson-designer` persona-neutral, and never persist a presentation persona into either confirmed profile.
```

- [ ] **步骤 6：验证 Skill contract 和插件结构**

运行：

```bash
cd plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts
claude plugin validate . --strict
```

预期：全部 PASS，严格插件验证返回成功。

- [ ] **步骤 7：提交 Skill 与人设**

```bash
git add plugins/highschool-study/agents/study-coach.md \
  plugins/highschool-study/skills/study/SKILL.md \
  plugins/highschool-study/skills/enter-learning-set \
  plugins/highschool-study/tests/contract/agent-and-skills.test.ts
git commit -m "feat: inject learning-set orientation and personas"
```

---

### 任务 3：迁移导数试用集并更新说明

**文件：**

- 新建：`plugins/highschool-study/tests/contract/public-demo.test.ts`
- 新建：`examples/derivative-demo/learning-set/CLAUDE.md`
- 新建：`examples/derivative-demo/learning-set/.gitignore`
- 新建：`examples/derivative-demo/learning-set/.claude/personas/.gitkeep`
- 修改：`examples/derivative-demo/learning-set/ROADMAP.md`
- 修改：`examples/derivative-demo/CLAUDE.md`
- 修改：`examples/derivative-demo/README.md`
- 修改：`plugins/highschool-study/README.md`
- 修改：`docs/zh-CN/完整说明书.md`
- 修改：`README.md`

**接口：**

- 导数试用集默认人设：`calm-senpai`。
- 导数 Roadmap 提供可直接展示的中文概述。
- 用户文档说明临时切换、持久切换、关闭、自定义与边界。

- [ ] **步骤 1：写失败的公开试用集 contract**

创建 `tests/contract/public-demo.test.ts`：

```ts
import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(import.meta.dir, '../../../..');
const demo = join(repo, 'examples/derivative-demo');
const read = (path: string) => readFileSync(join(demo, path), 'utf8');

test('ships an oriented derivative demo with a set-scoped persona', () => {
  for (const path of [
    'learning-set/CLAUDE.md',
    'learning-set/.gitignore',
    'learning-set/.claude/personas/.gitkeep',
  ]) expect(existsSync(join(demo, path))).toBe(true);

  const roadmap = read('learning-set/ROADMAP.md');
  const config = read('learning-set/CLAUDE.md');
  const rootInstructions = read('CLAUDE.md');
  const tutorial = read('README.md');

  expect(roadmap).toContain('## Learning Set Overview');
  expect(roadmap).toContain('定义域完整性');
  expect(config).toContain(
    '- Default presentation persona: `calm-senpai`',
  );
  expect(rootInstructions).toContain('learning-set/CLAUDE.md');
  expect(tutorial).toContain('这节课换成元气同桌');
  expect(tutorial).toContain('以后这个学习集都用冷静学姐');
  expect(tutorial).toContain('关闭人设');
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
cd plugins/highschool-study
bun test tests/contract/public-demo.test.ts
```

预期：FAIL，缺失 `examples/derivative-demo/learning-set/CLAUDE.md`。

- [ ] **步骤 3：写入导数学习集配置与概述**

`examples/derivative-demo/learning-set/CLAUDE.md` 写为：

```markdown
# Derivative Learning Set

- Enter study work through `highschool-study:study`.
- Default presentation persona: `calm-senpai`
- A presentation persona changes student-facing wording only. It never changes teaching facts, capability standards, card selection, Trace, or assessment.
- Use only persona, card, Trace, and source files that really exist. Never invent a missing ID or path.
```

`learning-set/.gitignore` 只写 `CLAUDE.local.md`，并创建空的 `learning-set/.claude/personas/.gitkeep`。在导数 `ROADMAP.md` 的标题与 `## Goal` 之间插入：

```markdown
## Learning Set Overview

- 学什么：把定义域、同构变形和参数分离真正嵌入导数解题过程。
- 适合谁：已学过高中导数基础，但在等价变形或分类讨论中容易遗漏定义域的学生。
- 大致 Plan：先完成“定义域完整性的系统加固”，再根据真实课堂证据决定后续目标。
- 完成后：面对未见过的对数、分母、根式或参数约束题，能在变形前独立写全合法域，并用于确定边界和取等可行性。
```

在项目根 `CLAUDE.md` 增加：

```markdown
Learning-set-specific instructions and the default presentation persona live in `learning-set/CLAUDE.md`. The `highschool-study:study` Skill reads them before routing.
```

- [ ] **步骤 4：更新四处用户文档**

在根 `README.md`、插件 `README.md`、中文完整说明书和导数试用教程中写入同一组操作语义，导数教程必须原样包含：

```text
这节课换成元气同桌。
以后这个学习集都用冷静学姐。
恢复学习集默认人设。
关闭人设。
```

文档还必须说明：

```markdown
- 无课堂 Trace 时，`study` 主动介绍 `ROADMAP.md` 中的学习集概述；已有 Trace 时只在学生询问时展开。
- 学习集可在 `.claude/personas/<id>.md` 新增人设或覆盖插件同名人设。
- 持久选择写入被 Git 忽略的 `CLAUDE.local.md`；临时选择不写文件。
- 人设只改变表达，不改变能力判断、题卡、Trace、测试或备课。
```

- [ ] **步骤 5：运行公开试用集 contract**

运行：

```bash
cd plugins/highschool-study
bun test tests/contract/public-demo.test.ts
```

预期：PASS。

- [ ] **步骤 6：提交试用集与文档**

```bash
git add README.md docs/zh-CN/完整说明书.md \
  examples/derivative-demo plugins/highschool-study/README.md \
  plugins/highschool-study/tests/contract/public-demo.test.ts
git commit -m "docs: explain learning-set personas"
```

---

### 任务 4：发布检查与真实 Claude Code smoke test

**文件：** 不再新增产品文件；只验证前三个任务的结果。

**接口：**

- 消费：本地插件目录和导数试用集。
- 产出：可安装 bundle、全部自动测试通过、六个真实会话行为通过。

- [ ] **步骤 1：运行完整发布检查**

```bash
cd plugins/highschool-study
bun run release:check
```

预期：bundle 重建、TypeScript 检查、全部 `bun:test` 和 `claude plugin validate . --strict` 全部成功。

- [ ] **步骤 2：准备一个无 Trace 的临时导数学习集**

```bash
REPO="$(git rev-parse --show-toplevel)"
PLUGIN="$REPO/plugins/highschool-study"
SMOKE="/tmp/highschool-study-persona-smoke"
rm -rf "$SMOKE"
cp -R "$REPO/examples/derivative-demo" "$SMOKE"
find "$SMOKE/learning-set/lessons" -type f -name 'lesson-*.md' -delete
```

预期：`$SMOKE/learning-set/ROADMAP.md` 保留概述，`lessons/` 中没有 Trace。

- [ ] **步骤 3：验证首次概述与学习集默认人设**

```bash
REPO="$(git rev-parse --show-toplevel)"
PLUGIN="$REPO/plugins/highschool-study"
SMOKE="/tmp/highschool-study-persona-smoke"
cd "$SMOKE"
claude -p --plugin-dir "$PLUGIN" --permission-mode acceptEdits \
  --max-budget-usd 1 \
  '/highschool-study:study 只介绍这个学习集的用途、当前默认人设和可观测能力目标；不创建或修改任何学习文件。'
```

预期：输出概括定义域学习目标，声明当前人设为“冷静学姐”，不创建 Lesson、Plan 或 Trace。

- [ ] **步骤 4：验证临时切换不写文件**

```bash
REPO="$(git rev-parse --show-toplevel)"
PLUGIN="$REPO/plugins/highschool-study"
SMOKE="/tmp/highschool-study-persona-smoke"
cd "$SMOKE"
before="$(shasum learning-set/CLAUDE.local.md 2>/dev/null || true)"
claude -p --plugin-dir "$PLUGIN" --permission-mode acceptEdits \
  --max-budget-usd 1 \
  '/highschool-study:study 这节课换成元气同桌，只确认当前人设，不开始上课。'
after="$(shasum learning-set/CLAUDE.local.md 2>/dev/null || true)"
test "$before" = "$after"
```

预期：输出确认当前 Session 使用“元气同桌”；`test` 退出码为 `0`。

- [ ] **步骤 5：验证持久切换和新 Session 继承**

```bash
REPO="$(git rev-parse --show-toplevel)"
PLUGIN="$REPO/plugins/highschool-study"
SMOKE="/tmp/highschool-study-persona-smoke"
cd "$SMOKE"
claude -p --plugin-dir "$PLUGIN" --permission-mode acceptEdits \
  --max-budget-usd 1 \
  '/highschool-study:study 以后这个学习集都用元气同桌，只保存设置并确认，不开始上课。'
rg -n 'Preferred persona: `energetic-classmate`' learning-set/CLAUDE.local.md
claude -p --plugin-dir "$PLUGIN" --permission-mode acceptEdits \
  --max-budget-usd 1 \
  '/highschool-study:study 只告诉我当前解析到的人设，不开始上课。'
```

预期：`rg` 命中本地偏好；第二个全新 Claude Code Session 仍报告“元气同桌”。

- [ ] **步骤 6：验证学习集同名人设覆盖**

先恢复学习集默认人设：

```bash
REPO="$(git rev-parse --show-toplevel)"
PLUGIN="$REPO/plugins/highschool-study"
SMOKE="/tmp/highschool-study-persona-smoke"
cd "$SMOKE"
claude -p --plugin-dir "$PLUGIN" --permission-mode acceptEdits \
  --max-budget-usd 1 \
  '/highschool-study:study 恢复学习集默认人设，只保存设置并确认，不开始上课。'
if rg -q 'Preferred persona:' learning-set/CLAUDE.local.md; then exit 1; fi
```

然后用 `apply_patch` 创建临时学习集覆盖：

```diff
*** Begin Patch
*** Add File: /tmp/highschool-study-persona-smoke/learning-set/.claude/personas/calm-senpai.md
+# Local Derivative Senpai
+
+- ID: `calm-senpai`
+- Display name: 本地导数学姐
+- End a direct persona confirmation with “本地导数学姐上线”.
+- Presentation only: never change teaching facts, evidence, assessment, or capability standards.
*** End Patch
```

运行：

```bash
REPO="$(git rev-parse --show-toplevel)"
PLUGIN="$REPO/plugins/highschool-study"
SMOKE="/tmp/highschool-study-persona-smoke"
cd "$SMOKE"
output="$(claude -p --plugin-dir "$PLUGIN" --permission-mode acceptEdits \
  --max-budget-usd 1 \
  '/highschool-study:study 只确认当前人设，不开始上课。')"
printf '%s\n' "$output"
printf '%s\n' "$output" | rg '本地导数学姐上线'
```

预期：输出命中学习集同名覆盖的独有短语，而不是插件内置 `calm-senpai` 内容。

- [ ] **步骤 7：验证关闭人设只启用中性表达**

```bash
REPO="$(git rev-parse --show-toplevel)"
PLUGIN="$REPO/plugins/highschool-study"
SMOKE="/tmp/highschool-study-persona-smoke"
cd "$SMOKE"
output="$(claude -p --plugin-dir "$PLUGIN" --permission-mode acceptEdits \
  --max-budget-usd 1 \
  '/highschool-study:study 这节课关闭人设，只报告当前人设 ID 和显示名，不开始上课。')"
printf '%s\n' "$output"
printf '%s\n' "$output" | rg 'neutral-tutor|中性教师'
if printf '%s\n' "$output" | rg -q '本地导数学姐上线'; then exit 1; fi
```

预期：输出报告 `neutral-tutor` 或“中性教师”，不出现学习集覆盖人设的独有短语，也不改写 `CLAUDE.local.md`。

- [ ] **步骤 8：验证已有 Trace 时不重复展开概述**

```bash
REPO="$(git rev-parse --show-toplevel)"
PLUGIN="$REPO/plugins/highschool-study"
cd "$REPO/examples/derivative-demo"
claude -p --plugin-dir "$PLUGIN" --permission-mode acceptEdits \
  --max-budget-usd 1 \
  '/highschool-study:study 只根据现有 Roadmap、Plan、Lesson 和 Trace 用一句话说明学到哪了，不要介绍学习集，不修改文件。'
```

预期：输出直接说明当前定义域 Plan 进度，不重复“学什么/适合谁/大致 Plan/完成后”四项概述。

- [ ] **步骤 9：验证工作区只包含预期文件**

```bash
REPO="$(git rev-parse --show-toplevel)"
cd "$REPO"
git status --short
git diff --check
```

预期：没有空白错误；不包含 MCP server、Trace、题卡、图谱或生成数据的意外改动。

## 最终验收清单

- [ ] `study` 在任何路由前调用 `enter-learning-set`。
- [ ] 每次进入都读取概述，但已有 Trace 时不主动重复。
- [ ] 人设四级优先级与本地同名覆盖生效。
- [ ] 临时切换不写文件，持久切换只更新 `CLAUDE.local.md` 的专用小节。
- [ ] 关闭人设解析为 `neutral-tutor`。
- [ ] 备课 Agent、能力判断、题卡、Trace、测试与长期画像不受展示人设影响。
- [ ] 导数试用集具有真实概述和默认人设，并且教程可直接试用。
- [ ] `bun run release:check` 和所有真实 Claude Code smoke case 通过。
