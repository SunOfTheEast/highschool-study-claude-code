# StudyForge 节点化主线整合验收记录

## 基线与拓扑

- 验收日期：2026-07-31。
- 切换前 `main`：`a4f0c126fcfffb88bc4c3fe4ec5d5d8e2eed5260`。
- 节点候选分支：`codex/studyforge-node-workspace`。
- 合并当前 `main` 的提交：`a1fd1269b7381d246d30eeb917339c1ba71306e1`（`merge: align node workspace with current main`）。
- 节点化三坐标基线：`ba9a380549553a1f7eb6978d044fb3ad25f910e5`。
- 教学小修的节点分支提交：`744a980ab6e4143671c5e599bd94dc0be2fcf067`。
- 整合设计提交：`0270f6c8598516c86c552e5e12acde0e5585d01c`。
- 旧主工作树补丁的停车提交：`7a54520430e895df91f1a4cd9c412ce0574795a0`，位于 `codex/pre-node-hotfixes`，不是候选分支祖先。
- 候选验收前 HEAD：`db258f7e635674c490c8c05b501ea65e01b09628`。

祖先检查确认 `a4f0c12`、`744a980`、`ba9a380` 和 `0270f6c` 都在候选历史中；停车分支未被重复合入。

## 补丁去重

旧主工作树 11 个 tracked 文件的 working patch 与节点分支 `744a980` 的 stable patch-id 都是：

```text
fb8918d7356915b5fe0d44acb11c1397c374733d
```

停车提交再次计算也得到同一 patch-id。11 个文件为：

1. `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
2. `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
3. `apps/pi-teaching-web/src/client/styles.css`
4. `apps/pi-teaching-web/src/runtime/lesson-prepare.ts`
5. `apps/pi-teaching-web/src/runtime/study-tools.ts`
6. `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`
7. `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
8. `plugins/highschool-study/dist/mcp-server.js`
9. `plugins/highschool-study/server/src/mcp/register-tools.ts`
10. `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
11. `plugins/highschool-study/skills/run-lesson/references/evidence-protocol.md`

因此只在停车分支留一份安全快照，没有向节点分支重复移植相同补丁。

## 自动发布门

候选 HEAD 上重新执行完整发布门，结果如下：

| 验证面 | 命令 | 结果 |
| --- | --- | --- |
| Claude Code 插件 | `bun run release:check` | 72 pass，0 fail，1898 assertions；strict plugin validation 通过 |
| Pi Runtime 与前端 | `bun run check` | 397 pass，0 fail，1499 assertions；TypeScript 与 production build 通过 |
| 浏览器 E2E | `bun run test:e2e` | 38 pass，0 fail |

Vite 只报告已有的 chunk-size 提示。构建后 `git diff --check`、tracked diff 和 staged diff 均为空；节点工作树仍只有 `.playwright-cli/`、`.superpowers/`、`apps/pi-teaching-web/.playwright-cli/` 三个已知未跟踪生成目录。

## 验收中发现并修复的问题

候选真实课在隔离副本上重新开始后通过。此前失败副本均保留在 `/tmp`，没有回写公开示例。验收过程中按最小范围修复了四项真实问题：

1. 多词题卡检索原先要求全部词命中，真实中文自然查询可能返回空结果；现改为部分命中排序，并增加回归测试。提交：`6bdf0f2`。
2. Plan Coach 私有检索步骤原先容易被模型拆成公开回复；Skill 改为原子私有工具序列。提交：`3866ffc`。
3. Roadmap 在前一轮检索、后一轮成功建 Plan 时仍可能输出自由总结并泄露题目；safe projection 现在以成功 `plan_prepare` 为准跨轮封口。提交：`38713d4`。
4. 首周期 `roadmap_update` 的 checkpoint 省略规则只写在 Skill 中，Flash 仍反复构造非法 checkpoint；tool schema 现在明确首周期完全省略该字段。提交：`db258f7`。

以上修改均在新的隔离副本上重新验证，没有在失败中的课上继续改代码。

## 真实短课节点

- 隔离副本：`/tmp/studyforge-node-mainline-acceptance-1yKpdC`。
- 题卡数量：519。
- Provider / model：`deepseek / deepseek-v4-flash`。
- Roadmap Coach Session：`019fb7de-80aa-70d4-ae51-55a9e0338d38`。
- Plan：`plan-001`，状态 `active`。
- Plan Coach Session：`019fb7e1-08b8-7045-8667-27ee47a5b2ff`。
- Lesson：`lesson-001`，状态 `closed`。
- Tutor Session：`019fb7e6-f2de-74ba-b479-90757c1c92e9`。
- Problem Block：`block-002`。
- 真实题卡：`cards/derivative/mst_p0042_section2_ex08.card.yaml`。
- 当前有效作答 Trace：`trace-0601f3fa-6992-4bda-8a37-c4f92b5342a4`。
- 被更正的旧 Trace：`trace-6880dcdb-5357-47a2-8c6d-1665733943f8`。

学生设定是“常规求导没有困难，但综合题结构不显眼时容易犹豫；用两道不同题检验动笔前的选路判断；今天只上第一节”。Roadmap 形成两课短周期；Plan Coach 逐轮确认本节同时观察“动笔前协议”和完整求解，并按学生选择自行决定首课路线。公开课前回执只显示三段课堂结构和题号，没有展示题面、答案、决定性变形、方法名或 Teacher Control。

## 事实写入链

实际链路为：

```text
Roadmap Candidate
  → 学生显式物化并激活 plan-001
  → Plan Candidate
  → 学生显式物化并激活 lesson-001
  → block-001 动笔前协议 Trace
  → block-002 独立作答 Trace
  → block-003 自核 Trace
  → 学生纠正次方法归因
  → superseding block-002 Trace
  → Lesson Handoff
  → closed Replay
```

作答结果正确且 `support: none`。Tutor 初次把题卡声明的次方法“同构变形与换元法”一起写入作答 Trace；学生指出 `t=x+2` 只是平移记号，并没有使用题卡中的指数—对数同构路线。Tutor 随后写入 superseding Trace：

- 保留主方法“切线放缩与凹凸性”；
- 将 Secondary 改为空数组；
- `supersedes` 精确指向旧的同 Plan、Lesson、Block、card Trace；
- Lesson Summary 与 Handoff 只引用更正后的 active Trace。

Knowledge 投影中主方法为 `observed`、一次 attempt、一道独立题卡；旧 Trace 保留为 `active: false`，新 Trace 为 `active: true`；错误次方法显示为 `invalidated`，没有形成新的有效能力证据。

真实模型有三次可恢复的工具使用毛刺：Plan Coach 一次引用不允许的父 Session source、一次生成无题卡绑定的 problem Block；Tutor 一次在旧 Block 尚 active 时提前激活下一 Block。运行时均拒绝非法写入，模型随后使用允许的 source、合法 blueprint 和正确 Block 顺序重试。另有一项非阻塞遵循差异：Plan Coach 使用已获得的本 Session 题卡检索结果后直接 `lesson_prepare`，没有执行 Skill 要求的显式 `source_resolve`；`lesson_prepare` 仍重新验证了真实卡路径与 Lesson 结构，最终未制造假卡或公开剧透。该项记录为模型遵循观察，不改写本轮事实结论。

## 三坐标投影

Course、Knowledge、Memory 都从同一组 Markdown / Trace 事实读取：

- Course 深链固定在 `plan-001 / lesson-001`，Lesson 状态为 `closed`，页面显示只读完整回放，没有 composer。
- Knowledge 总览将“切线放缩与凹凸性”显示为一次 `observed`；选择该方法后能看到旧记录“后来修正”和新记录“当前记录”，API 中包含 active Trace source。
- Memory 按 `trace:trace-0601f3fa-6992-4bda-8a37-c4f92b5342a4` 下钻，技术来源可展开到 `plan-001 / lesson-001 / block-002 / cards/derivative/mst_p0042_section2_ex08.card.yaml`。

三个 JSON 投影均不包含 `Teacher Control`、`source_solution_summary` 或 `rubric`。Knowledge 的来源详情按设计只在选择具体方法后展开；未选择方法的总览只返回节点状态与计数。

浏览器依次执行课堂深链刷新、Knowledge 方法下钻、Memory Trace 下钻和返回课堂。切换前后始终为 4 个 Trace、3 个 Pi Session，没有新激活、Session 或事实写入。

## 边界检查

- `examples/derivative-demo/learning-set/**` 在真实课前后均无 diff 或未跟踪写入。
- 真实模型只写入 `/tmp` 副本；Session JSONL 未加入 Git。
- 学生投影没有 Teacher Control、参考答案字段或工具参数泄漏。
- Claude Code 插件公共 MCP 仍恰好为 `card_search`、`trace_search`、`trace_append`、`source_resolve` 四个。
- 节点化 Runtime 不读取旧线性 Plan/Lesson 结构；没有新增兼容层、数据库、向量库、规则引擎或 Agent。
- 知页源码和两份知页专属设计不在 StudyForge 候选树中，README 指向独立路径 `/Users/yangrundong/Documents/GitHub/zhiye`。

## 候选结论

自动发布门、复制学习集真实短课、Trace 更正、Lesson Handoff、终态 Replay、三坐标来源下钻与只读刷新全部通过。节点化候选可进入主线切换。
