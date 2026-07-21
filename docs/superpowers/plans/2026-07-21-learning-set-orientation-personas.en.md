# Learning-Set Orientation and Selectable Personas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Task 2 also requires `superpowers:writing-skills` because it creates a Claude Code Skill.

**Goal:** Make every `highschool-study:study` entry read the learning-set overview and resolve one student-selectable presentation persona while preserving all existing Roadmap, Plan, Lesson, card, Trace, and long-term-profile semantics.

**Architecture:** Add one non-user-invocable `enter-learning-set` Skill and invoke it before `study` chooses any route. The overview comes from `ROADMAP.md`. Persona resolution follows session override, `CLAUDE.local.md`, `CLAUDE.md`, then plugin default, and reads exactly one final Markdown persona. This feature remains in the Skill and project-configuration layer: it changes none of the four MCP tools and creates no Agent.

**Tech Stack:** Claude Code plugin Skills and Agents, `CLAUDE.md`, `CLAUDE.local.md`, Markdown, Bun 1.3.14, TypeScript 7.0.2, `bun:test`, and live Claude Code CLI smoke tests.

## Global Constraints

- Implement in the released `plugins/highschool-study/`; do not create a second plugin tree.
- Do not change the MCP tool list, MCP schemas, Trace format, card format, or knowledge graph.
- Add no Agent. `study-coach` remains the only student-facing entry, and `lesson-designer` remains persona-neutral.
- `enter-learning-set` runs before every Roadmap, Plan, Lesson, correction, or progress route in `study`.
- The overview comes from `ROADMAP.md`. Read it on every entry; actively present it only when no `## Trace event-` heading exists or the student asks for it.
- Persona precedence is fixed: current-session temporary choice, `learning-set/CLAUDE.local.md`, `learning-set/CLAUDE.md`, plugin `neutral-tutor`.
- `learning-set/.claude/personas/<id>.md` overrides a same-named built-in persona. Select only files returned by `Glob`; never construct a path from student text.
- A temporary switch writes nothing. A persistent switch edits only the `## Highschool Study Presentation` section of `CLAUDE.local.md` and preserves every other section.
- A persona changes only student-visible forms of address, voice, metaphors, and encouragement. It never enters Trace, Lesson Summary, Plan Summary, `student-profile.md`, `teaching-profile.md`, or `planner-attention.md`.
- A persona never changes capability judgment, card selection, assessment, test standards, lesson closure, or source authenticity.
- Do not `@`-import all personas. Add no persona database, rule engine, Hook, or runtime dependency.
- Write failing contract tests before prompts/templates. Finish with `bun run release:check` and live Claude Code smoke tests.

## File Responsibility Map

| Responsibility | Files |
| --- | --- |
| Shared learning-set configuration | `plugins/highschool-study/learning-set-template/CLAUDE.md` |
| Local-preference ignore | `plugins/highschool-study/learning-set-template/.gitignore` |
| Overview source | `plugins/highschool-study/learning-set-template/ROADMAP.md` |
| Learning-set persona extension directory | `plugins/highschool-study/learning-set-template/.claude/personas/.gitkeep` |
| Entry and persona resolution | `plugins/highschool-study/skills/enter-learning-set/SKILL.md` |
| Built-in personas | `plugins/highschool-study/skills/enter-learning-set/references/personas/*.md` |
| Entry routing | `plugins/highschool-study/skills/study/SKILL.md` |
| Student-facing boundary | `plugins/highschool-study/agents/study-coach.md` |
| Static contracts | `plugins/highschool-study/tests/contract/package-and-template.test.ts`, `agent-and-skills.test.ts` |
| Public demo | `examples/derivative-demo/CLAUDE.md`, `learning-set/**` |
| User documentation | `README.md`, `plugins/highschool-study/README.md`, `docs/zh-CN/完整说明书.md`, `examples/derivative-demo/README.md` |

---

### Task 1: Extend the Learning-Set Template

**Files:**

- Modify: `plugins/highschool-study/tests/contract/package-and-template.test.ts`
- Create: `plugins/highschool-study/learning-set-template/CLAUDE.md`
- Create: `plugins/highschool-study/learning-set-template/.gitignore`
- Create: `plugins/highschool-study/learning-set-template/.claude/personas/.gitkeep`
- Modify: `plugins/highschool-study/learning-set-template/ROADMAP.md`

**Interfaces:**

- Produces `## Learning Set Overview` in `ROADMAP.md`.
- Produces one parseable `Default presentation persona` line in `CLAUDE.md`.
- Produces a gitignored location for `CLAUDE.local.md` and an optional local-persona directory.

- [ ] **Step 1: Write the failing template contract**

Append to `package-and-template.test.ts`:

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

- [ ] **Step 2: Run the test and confirm the missing-file failure**

Run:

```bash
cd plugins/highschool-study
bun test tests/contract/package-and-template.test.ts
```

Expected: FAIL; the first missing path is `learning-set-template/CLAUDE.md`.

- [ ] **Step 3: Write the minimal template files**

Create `learning-set-template/CLAUDE.md` with:

```markdown
# Highschool Study Learning Set

- Enter study work through `highschool-study:study`.
- Default presentation persona: `neutral-tutor`
- A presentation persona changes student-facing wording only. It never changes teaching facts, capability standards, card selection, Trace, or assessment.
- Use only persona, card, Trace, and source files that really exist. Never invent a missing ID or path.
```

Create `learning-set-template/.gitignore` with:

```gitignore
CLAUDE.local.md
```

Create an empty `learning-set-template/.claude/personas/.gitkeep`. Insert this after `# Roadmap` and before `## Goal` in `ROADMAP.md`:

```markdown
## Learning Set Overview

- What this teaches:
- Who this is for:
- Approximate Plans:
- Observable result:
```

- [ ] **Step 4: Verify the template contract**

Run:

```bash
cd plugins/highschool-study
bun test tests/contract/package-and-template.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit the template change**

```bash
git add plugins/highschool-study/learning-set-template \
  plugins/highschool-study/tests/contract/package-and-template.test.ts
git commit -m "feat: add learning-set presentation config"
```

---

### Task 2: Implement the Entry Skill and Persona Boundary

**Required sub-skill:** `superpowers:writing-skills`

**Files:**

- Modify: `plugins/highschool-study/tests/contract/agent-and-skills.test.ts`
- Create: `plugins/highschool-study/skills/enter-learning-set/SKILL.md`
- Create: `plugins/highschool-study/skills/enter-learning-set/references/personas/neutral-tutor.md`
- Create: `plugins/highschool-study/skills/enter-learning-set/references/personas/calm-senpai.md`
- Create: `plugins/highschool-study/skills/enter-learning-set/references/personas/energetic-classmate.md`
- Modify: `plugins/highschool-study/skills/study/SKILL.md`
- Modify: `plugins/highschool-study/agents/study-coach.md`

**Interfaces:**

- Consumes the current student request, `learning-set/ROADMAP.md`, `CLAUDE.md`, optional `CLAUDE.local.md`, and enumerated persona files.
- Produces overview context, whether to present it, final persona ID/path/content, and an optional fallback notice.
- Its only persistent write updates the `Preferred persona` line in `learning-set/CLAUDE.local.md` after an explicit persistent-switch request.

- [ ] **Step 1: Write the failing Skill and Agent contract**

Change the fs import in `agent-and-skills.test.ts` to:

```ts
import { existsSync, readFileSync } from 'node:fs';
```

Then append:

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

- [ ] **Step 2: Run the test and confirm the missing-Skill failure**

Run:

```bash
cd plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts
```

Expected: FAIL because `skills/enter-learning-set/SKILL.md` is missing.

- [ ] **Step 3: Create `enter-learning-set`**

Create `skills/enter-learning-set/SKILL.md` with:

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

- [ ] **Step 4: Create the three built-in personas**

Create `neutral-tutor.md`:

```markdown
# Neutral Tutor

- ID: `neutral-tutor`
- Display name: 中性教师
- Address the student naturally as “你”.
- Use calm, direct, concise Chinese without role-play flourishes.
- Encourage concrete progress without exaggerated praise.
- Presentation only: never change teaching facts, evidence, assessment, or capability standards.
```

Create `calm-senpai.md`:

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

Create `energetic-classmate.md`:

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

- [ ] **Step 5: Wire the entry Skill into the single entry point**

Insert this before the route list in `skills/study/SKILL.md`:

```markdown
First invoke `highschool-study:enter-learning-set` with the current student request. Keep its overview as context, present it only when instructed, and apply its selected persona only to student-visible wording. Do not choose any route until it returns.
```

Insert this after the routing description in `agents/study-coach.md`:

```markdown
The selected persona is a presentation layer only. It may change address, tone, metaphors, and encouragement, but never capability judgments, card choice, Trace facts, tests, closure, or memory. Keep `lesson-designer` persona-neutral, and never persist a presentation persona into either confirmed profile.
```

- [ ] **Step 6: Verify the Skill contract and plugin structure**

Run:

```bash
cd plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts
claude plugin validate . --strict
```

Expected: all tests PASS and strict plugin validation succeeds.

- [ ] **Step 7: Commit the Skill and personas**

```bash
git add plugins/highschool-study/agents/study-coach.md \
  plugins/highschool-study/skills/study/SKILL.md \
  plugins/highschool-study/skills/enter-learning-set \
  plugins/highschool-study/tests/contract/agent-and-skills.test.ts
git commit -m "feat: inject learning-set orientation and personas"
```

---

### Task 3: Migrate the Derivative Demo and Update User Documentation

**Files:**

- Create: `plugins/highschool-study/tests/contract/public-demo.test.ts`
- Create: `examples/derivative-demo/learning-set/CLAUDE.md`
- Create: `examples/derivative-demo/learning-set/.gitignore`
- Create: `examples/derivative-demo/learning-set/.claude/personas/.gitkeep`
- Modify: `examples/derivative-demo/learning-set/ROADMAP.md`
- Modify: `examples/derivative-demo/CLAUDE.md`
- Modify: `examples/derivative-demo/README.md`
- Modify: `plugins/highschool-study/README.md`
- Modify: `docs/zh-CN/完整说明书.md`
- Modify: `README.md`

**Interfaces:**

- Sets `calm-senpai` as the derivative demo's default persona.
- Gives the derivative Roadmap a student-ready Chinese overview.
- Documents temporary switching, persistent switching, disabling, customization, and the presentation-only boundary.

- [ ] **Step 1: Write the failing public-demo contract**

Create `tests/contract/public-demo.test.ts`:

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

- [ ] **Step 2: Run the test and confirm the missing-demo-config failure**

Run:

```bash
cd plugins/highschool-study
bun test tests/contract/public-demo.test.ts
```

Expected: FAIL because `examples/derivative-demo/learning-set/CLAUDE.md` is missing.

- [ ] **Step 3: Add the derivative learning-set configuration and overview**

Create `examples/derivative-demo/learning-set/CLAUDE.md` with:

```markdown
# Derivative Learning Set

- Enter study work through `highschool-study:study`.
- Default presentation persona: `calm-senpai`
- A presentation persona changes student-facing wording only. It never changes teaching facts, capability standards, card selection, Trace, or assessment.
- Use only persona, card, Trace, and source files that really exist. Never invent a missing ID or path.
```

Create `learning-set/.gitignore` with only `CLAUDE.local.md`, and create an empty `learning-set/.claude/personas/.gitkeep`. Insert this between the derivative Roadmap title and `## Goal`:

```markdown
## Learning Set Overview

- 学什么：把定义域、同构变形和参数分离真正嵌入导数解题过程。
- 适合谁：已学过高中导数基础，但在等价变形或分类讨论中容易遗漏定义域的学生。
- 大致 Plan：先完成“定义域完整性的系统加固”，再根据真实课堂证据决定后续目标。
- 完成后：面对未见过的对数、分母、根式或参数约束题，能在变形前独立写全合法域，并用于确定边界和取等可行性。
```

Append this to the project-root `CLAUDE.md`:

```markdown
Learning-set-specific instructions and the default presentation persona live in `learning-set/CLAUDE.md`. The `highschool-study:study` Skill reads them before routing.
```

- [ ] **Step 4: Update the four user-documentation surfaces**

Add the same interaction semantics to the root README, plugin README, Chinese manual, and derivative tutorial. The derivative tutorial must contain these exact examples:

```text
这节课换成元气同桌。
以后这个学习集都用冷静学姐。
恢复学习集默认人设。
关闭人设。
```

Each documentation surface must state:

```markdown
- With no classroom Trace, `study` presents the Learning Set Overview from `ROADMAP.md`; with existing Trace, it expands the overview only when asked.
- A learning set can add `.claude/personas/<id>.md` or override a same-named built-in persona.
- A persistent choice goes to gitignored `CLAUDE.local.md`; a temporary choice writes no file.
- A persona changes presentation only, never capability judgment, cards, Trace, tests, or preparation.
```

- [ ] **Step 5: Run the public-demo contract**

Run:

```bash
cd plugins/highschool-study
bun test tests/contract/public-demo.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the demo and documentation**

```bash
git add README.md docs/zh-CN/完整说明书.md \
  examples/derivative-demo plugins/highschool-study/README.md \
  plugins/highschool-study/tests/contract/public-demo.test.ts
git commit -m "docs: explain learning-set personas"
```

---

### Task 4: Release Check and Live Claude Code Smoke Tests

**Files:** No additional product files. This task verifies Tasks 1-3.

**Interfaces:**

- Consumes the local plugin directory and derivative demo.
- Produces a valid distributable bundle, passing automated tests, and six passing live-session behaviors.

- [ ] **Step 1: Run the full release check**

```bash
cd plugins/highschool-study
bun run release:check
```

Expected: bundle rebuild, TypeScript check, every `bun:test`, and `claude plugin validate . --strict` all succeed.

- [ ] **Step 2: Prepare a deterministic no-Trace derivative project**

```bash
REPO="$(git rev-parse --show-toplevel)"
PLUGIN="$REPO/plugins/highschool-study"
SMOKE="/tmp/highschool-study-persona-smoke"
rm -rf "$SMOKE"
cp -R "$REPO/examples/derivative-demo" "$SMOKE"
find "$SMOKE/learning-set/lessons" -type f -name 'lesson-*.md' -delete
```

Expected: `$SMOKE/learning-set/ROADMAP.md` retains its overview, and `lessons/` contains no Trace.

- [ ] **Step 3: Verify first-entry orientation and the learning-set default persona**

```bash
REPO="$(git rev-parse --show-toplevel)"
PLUGIN="$REPO/plugins/highschool-study"
SMOKE="/tmp/highschool-study-persona-smoke"
cd "$SMOKE"
claude -p --plugin-dir "$PLUGIN" --permission-mode acceptEdits \
  --max-budget-usd 1 \
  '/highschool-study:study 只介绍这个学习集的用途、当前默认人设和可观测能力目标；不创建或修改任何学习文件。'
```

Expected: the response summarizes the domain-integrity goal, reports “冷静学姐” as current, and creates no Lesson, Plan, or Trace.

- [ ] **Step 4: Verify that a temporary switch writes no file**

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

Expected: the response confirms “元气同桌” for the current Session, and `test` exits `0`.

- [ ] **Step 5: Verify persistent switching and inheritance in a new Session**

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

Expected: `rg` finds the local preference, and the second fresh Claude Code Session still reports “元气同桌”.

- [ ] **Step 6: Verify a same-ID learning-set persona override**

First restore the learning-set default:

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

Then use `apply_patch` to add a temporary learning-set override:

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

Run:

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

Expected: the response contains the learning-set override's unique phrase rather than the bundled `calm-senpai` content.

- [ ] **Step 7: Verify that disabling personas selects neutral presentation only**

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

Expected: the response reports `neutral-tutor` or “中性教师”, omits the override's unique phrase, and does not edit `CLAUDE.local.md`.

- [ ] **Step 8: Verify that existing Trace suppresses repeated orientation**

```bash
REPO="$(git rev-parse --show-toplevel)"
PLUGIN="$REPO/plugins/highschool-study"
cd "$REPO/examples/derivative-demo"
claude -p --plugin-dir "$PLUGIN" --permission-mode acceptEdits \
  --max-budget-usd 1 \
  '/highschool-study:study 只根据现有 Roadmap、Plan、Lesson 和 Trace 用一句话说明学到哪了，不要介绍学习集，不修改文件。'
```

Expected: the response states the current domain-integrity Plan progress directly and does not repeat the four overview fields.

- [ ] **Step 9: Verify the worktree contains only expected changes**

```bash
REPO="$(git rev-parse --show-toplevel)"
cd "$REPO"
git status --short
git diff --check
```

Expected: no whitespace errors and no unintended change to MCP server code, Trace, cards, graph assets, or generated learning data.

## Final Acceptance Checklist

- [ ] `study` invokes `enter-learning-set` before any other route.
- [ ] Every entry reads the overview, while a learning set with Trace does not repeat it unprompted.
- [ ] Four-level persona precedence and same-ID learning-set override work.
- [ ] A temporary switch writes nothing; a persistent switch edits only the dedicated `CLAUDE.local.md` section.
- [ ] Disabling personas resolves to `neutral-tutor`.
- [ ] Preparation, capability judgment, cards, Trace, tests, and long-term profiles are unaffected by presentation personas.
- [ ] The derivative demo has a real overview, a default persona, and runnable instructions.
- [ ] `bun run release:check` and every live Claude Code smoke case pass.
