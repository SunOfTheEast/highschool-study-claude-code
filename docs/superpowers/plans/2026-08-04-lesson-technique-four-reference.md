# Lesson 四参考技巧实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Lesson 的七个未验收技巧草稿收缩为四个边界清楚、按需读取且经真实模型验证的 reference，并把跨文件共同约束放回常驻 Agent/根 Skill。

**Architecture:** `lesson-node.md` 与 `tutor-lesson/SKILL.md` 常驻承担证据、公开输出、生命周期和日志边界；根 Skill 只做固定优先级路由与核心支架阶梯；四个 reference 各自决定一种低频教学动作。旧文件直接删除，不保留别名、兼容入口或互相跳读。Runtime 投影本轮不变；只有提示层在同情境 5 次仍不能守住一次公开回复时，才另开 Runtime 设计。

**Tech Stack:** Markdown Agent/Skill resources, Bun structural tests, Pi native Lesson sessions, DeepSeek V4 Flash high-thinking behavioral micro-tests.

## 全局约束

- 只在 `gentle-judgment-isomorphic-acceptance` worktree 工作，保留所有无关脏改动。
- 未获明确授权不暂存、不提交、不合并。
- 不增加 schema、Session 类型、生命周期状态、工具或 Runtime 文本过滤。
- 不为 Skill 文案增加逐字断言；自动化只验证文件集合与资源装配，教学行为由真实模型判断。
- 先使用既有 60 次真实模型失败作为行为 RED，并再观察一次目录结构测试按预期失败；之后才修改运行时 Skill。
- 四个 reference 分别过门。一个文件没有达到同情境 5/5 时，不把失败藏进其他技巧或用整库通过代替。

---

### Task 1：固定删除表面的结构性 RED

**Files:**
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`
- Read: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/teaching-techniques/`

**Interface:** 最终目录恰好包含 `INDEX.md` 和四个批准文件；旧五个文件不存在。

- [x] 增加 `packages only the accepted Lesson technique references` 测试，只比较文件集合并检查非空，不断言具体措辞。
- [x] 运行 `bun test tests/m0/native-session.test.ts`，确认测试因当前七草稿文件集合而失败，而非导入或路径错误。
- [x] 把既有 60 次候选、反例和核心对照作为行为 RED，不重复把旧文案当 GREEN。

### Task 2：收紧 Lesson 常驻系统契约与核心循环

**Files:**
- Modify: `apps/pi-teaching-web/resources/agents/lesson-node.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`

**Interfaces:**
- 当前 Lesson 证据只来自 Lesson 本身与当前/下一 Block 显式 `Uses`。
- Tutor 只改 Block 状态和日志；Lesson 顶层生命周期归 UI/Runtime。
- 必要工具调用和日志先完成，之后只有一段学生可见回复并等待。
- Classroom Log 只追加 Markdown 列表项，不生成时间。
- 普通卡顿使用根 Skill 的四级帮助阶梯，不读第五个 reference。

- [x] 在 Agent 与根 Skill 各放一份职责相称、没有例外从句的证据边界；明确禁止父节点、兄弟 Lesson、未链接文件和目录枚举。
- [x] 把公开输出写成正向顺序：必要读取/写入 → 一段课堂回复 → 等待；工具调用段不夹带公开旁白。
- [x] 明确 Block 与 Lesson 顶层生命周期权限，保留学生停止即停止加题的边界。
- [x] 把日志从“timestamped line”改为按发生顺序追加的 Markdown 列表项。
- [x] 把“最小方向 → 更具体关系 → 具体步骤 → 有边界讲解”并入帮助主流程。
- [x] 此任务暂不增加技巧路由，先运行聚焦 Bun 测试确认资源仍可装配。

### Task 3：实现并验收概念边界修复

**Files:**
- Create: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/teaching-techniques/concept-boundary-repair.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/teaching-techniques/INDEX.md`

**Interface:** 只在“必要概念缺口、已确认错误模型、同一解释已经失败”三种状态之一命中；本轮只选一个动作，最后把一个小动作交还学生。

- [x] 写三条互斥分支的正向亮线；排除局部计算错、未完成表达和仍在有效思考。
- [x] 文件内不读取、推荐或命名另一个技巧；对照/反例只作为“已有解释失败”分支的一次动作。
- [x] 将该分支接入根 Skill 最低优先级，并在 INDEX 只登记已接入文件。
- [x] 对“缺概念”“错误模型”“解释无效”各做至少 5 个新 Session；对局部算术错做 5 个无该 reference 对照。
- [x] 人工检查所有 CoT 与公开文本：5/5 无父节点/目录读取、无内部路由旁白、无生命周期越权，且每轮只做一个修复动作。
- [x] 若失败，只改这一 reference 或共同常驻契约并重跑；通过后才进入 Task 4。

### Task 4：实现并验收两轮方法比较

**Files:**
- Rewrite: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/teaching-techniques/method-comparison.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/teaching-techniques/INDEX.md`

**Interface:** 已完成且核验合法的学生路线才命中；首次命中只确认有效并请学生复述入口、关键一步、代价，然后等待；下一次学生回复后才比较最多一个替代。

- [x] 用两轮正向输出契约替换旧四步同轮流程。
- [x] 明确路线细节不足时询问学生，不读取 Plan、Roadmap、卡片、材料或图谱重建。
- [x] 把该分支插入概念修复之前，并更新 INDEX。
- [x] 做 5 个完整两轮 Session，逐轮检查第一次没有替代方法、第二次最多一个比较。
- [x] 对尚未完成路线做 5 个对照，确认不读该 reference、不提前比较。
- [x] 人工检查所有 CoT 与工具边界；通过后才进入 Task 5。

### Task 5：实现并验收独立迁移检查

**Files:**
- Rewrite: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/teaching-techniques/independent-transfer-check.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/teaching-techniques/INDEX.md`

**Interface:** 讲解或提示后尚无独立证据时命中；优先使用当前题决定性一步或当前 Block `Uses`，必要时才生成严格位于 Lesson Goal 内的自检微题。

- [x] 写清任务来源优先级、微题边界和日志中的“教师现场生成”标记。
- [x] 禁止为寻找平行题读取父节点、枚举目录或碰未链接材料。
- [x] 把该分支插入方法比较之前，并更新 INDEX。
- [x] 做至少 5 个新 Session，覆盖有现成小动作与无现成题需现场微题；检查首次独立表现和后续帮助分开记录。
- [x] 人工检查所有 CoT：5/5 证据范围、公开输出和生命周期均守住；通过后才进入 Task 6。

### Task 6：实现并验收挫败与暂停

**Files:**
- Create: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/teaching-techniques/frustration-and-pause.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/teaching-techniques/INDEX.md`

**Interface:** 先按“明确暂停/结束”与“挫败但未停止”分流；明确停止分支不加任务、不提供继续菜单、不编辑 Lesson 顶层状态。

- [x] 写两个互斥分支；安慰只使用当前课堂已经真实发生的观察。
- [x] 把该分支放在根路由最高优先级，并更新 INDEX。
- [x] 对明确“今天不做了”做 5 个新 Session：全部只回应、记录、停下。
- [x] 对挫败但愿意继续做 5 个新 Session：只给一个可选小入口或暂停选择并等待。
- [x] 人工检查所有 CoT：5/5 无新任务越过停止、无顶层状态 edit、无日志/路由旁白；通过后才进入 Task 7。

### Task 7：删除旧入口并让结构测试转绿

**Files:**
- Delete: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/teaching-techniques/misconception-repair.md`
- Delete: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/teaching-techniques/new-concept-explanation.md`
- Delete: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/teaching-techniques/stuck-scaffolding.md`
- Delete: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/teaching-techniques/contrast-and-counterexample.md`
- Delete: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/teaching-techniques/frustration-response.md`
- Verify: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/teaching-techniques/INDEX.md`

- [x] 用 `apply_patch` 删除五个旧文件，不建立别名或迁移说明文件。
- [x] `rg` 检查运行时资源中不存在旧文件名、互链、七技巧表述或“草稿未启用”入口。
- [x] 运行聚焦 `native-session.test.ts`，确认 Task 1 的结构测试由正确原因转绿。

### Task 8：整体回归与交付复核

**Files:**
- Read only: 本计划涉及的 Agent、Skill、references、测试与设计文档。

- [x] 运行 `git diff --check`。
- [x] 从 `apps/pi-teaching-web` 运行 `bun run check`，要求 typecheck、非 E2E 测试和 production build 全绿。
- [x] 运行 `bun run test:e2e -- tests/e2e/m0-cycle.spec.ts`，要求浏览器生命周期通过。
- [x] 用最终完整路由再各抽一个最易串线情境：停止优先于迁移、迁移优先于方法比较、方法比较优先于概念修复；确认一次回应只读取第一命中 reference。
- [x] 检查目标 diff，不覆盖、不暂存、不提交任何既有用户改动。
- [x] 只按实际证据汇报：自动测试、真实模型样本数、仍存在的风险和未做事项分别说明。
