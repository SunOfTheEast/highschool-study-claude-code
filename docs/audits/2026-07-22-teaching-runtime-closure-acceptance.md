# Teaching Runtime Closure 验收报告

状态：**PARTIAL / FAIL — 不满足 Final Completion Gate**

运行日期：2026-07-22  
报告日期：2026-07-23

## 一、结论

Session 绑定工具、Plan/Lesson 写回、安全消息投影、能力快照刷新、浏览器路由恢复、学生异议/方法否定的 superseding Trace，以及“缺决定性充分性证明时保持 incomplete”均有自动测试和真实运行证据。

原课堂事实真实性 P0 已被修正：相同缺失充分性的回答现在先写 `incomplete + support:none`，Tutor 只指出缺口；学生独立补全后才以新 Trace supersede，并按 `Trace → alternative → reply` 顺序落盘整题另解。

整体验收仍未通过。提示支持来源仍不稳定：最终隔离复验中，学生明确请求并收到一级提示，确认语句没有制造正确证据，之后学生补全证明时 Tutor 正确 supersede 了 incomplete Trace，却错误写成 `support:none`。这会把受提示完成误投影为独立完成。纯 Agent/Skill/工具参数提示经过多轮收紧后仍未稳定解决，因此 Final Completion Gate 保持失败。

## 二、运行身份与隔离

- 分支：`codex/studyforge-lane-a`
- 基线实现提交：`66d17b9694e109baf089efa50e7a4fd6fa4bd08c`
- 学生确认方法契约提交：`dceed02`（`fix: require student-confirmed method evidence`）
- 学习集：`examples/derivative-demo/learning-set`
- Provider：`xiaomi`
- Model：`mimo-v2.5-pro-ultraspeed`
- Pi 配置只记录 provider/model；本报告不包含 API key、认证内容、私密推理或完整课堂转录。
- 所有课堂写入均发生在 `/tmp/studyforge-runtime-closure-*` 或 `/tmp/studyforge-evidence-freeze-*` 隔离副本；仓库中的 `examples/derivative-demo/learning-set/**` 未被验收运行修改。

`/tmp/studyforge-runtime-closure-fixed-20260722-mjER5F` 不计入证据。该运行被全局 Pi package 路径遮蔽，加载的 Skill 不来自隔离副本，且隔离 runtime 内没有对应原生 Session JSONL；它不满足来源隔离要求。

## 三、自动验证

| 范围 | 命令 | 结果 |
|---|---|---|
| Pi Web 类型、单测、构建 | `cd apps/pi-teaching-web && bun run check` | PASS：86 tests，0 fail；TypeScript 与 Vite build exit 0 |
| Plugin 打包与发布检查 | `cd plugins/highschool-study && bun run release:check` | PASS：59 tests，0 fail；typecheck、bundle、strict plugin validation exit 0 |
| 浏览器 E2E | `cd apps/pi-teaching-web && bun run test:e2e` | PASS：8 tests，0 fail |

Vite 仍报告单个前端 chunk 大于 500 kB；这是既有体积警告，不影响本次教学协议结论。

## 四、真实运行证据

### 4.1 基线闭环

Runtime root：`/tmp/studyforge-runtime-closure-isolated-20260722-J94bAv`

- Coach Session：`pi-agent/sessions/--private-tmp-studyforge-runtime-closure-isolated-20260722-J94bAv-examples-derivative-demo-learning-set--/2026-07-22T16-09-39-437Z_019f8a96-ff6d-7b13-81f5-e73c6c4d57fc.jsonl`
- Tutor Session：`pi-agent/sessions/--private-tmp-studyforge-runtime-closure-isolated-20260722-J94bAv-examples-derivative-demo-learning-set--/2026-07-22T16-09-46-254Z_019f8a97-1a0e-7b67-b9b5-06fb84a53291.jsonl`
- Plan：`examples/derivative-demo/learning-set/plans/domain-integrity.md`
- Lesson：`examples/derivative-demo/learning-set/lessons/lesson-003.md`
- Cards：`Q-DOMAIN-EX22`、`Q-DOMAIN-EX16`

观察：

- Tutor 的 `trace_append`、`classroom_update`、`lesson_close` 均未填写 `lessonPath` 或 `cardStepId`；Lesson 由 Session ownerPath 绑定。
- 两道题分别形成 Trace，Reflection Block 与 Lesson frontmatter/summary 一次关闭。
- Coach 只调用一次 `plan_update`，随后重读同一 Plan，再给学生结论；Plan 最终写为 completed。
- raw Pi JSONL 保留完整工具事件；safe 页面未显示内部矩阵、工具参数或另解正文。
- 能力图在 Trace 后收到完整 snapshot；刷新、Coach/Lesson 深链与 closed replay 的路由恢复通过。

该运行同时暴露了原方法契约缺陷：Tutor 把第一条路线硬套为主方法“含参数分类讨论”、次方法“局部逼近与找点”。两个名称都真实存在，但不准确；合法枚举只能防止虚构节点，不能证明教学语义贴合。

### 4.2 扁平未映射契约与首次另解

Runtime root：`/tmp/studyforge-runtime-closure-flatconfirm-20260722-iTY2XP`

- Tutor Session：`pi-agent/sessions/--private-tmp-studyforge-runtime-closure-flatconfirm-20260722-iTY2XP-examples-derivative-demo-learning-set--/2026-07-22T16-35-15-730Z_019f8aae-7092-7f6e-a20f-7c73e104f3ae.jsonl`
- Trace：`lessons/lesson-003.md#trace-event-001`
- 另解：`cards/derivative/mst_p0032_ex22.card.alternatives.md`

观察：

- `trace_append` 一次成功，使用扁平 `methodStatus: unmapped` 与 `methodRoute`，持久 Trace 没有方法字段。
- 紧接着一次 `card_alternative_append` 成功，`question` 精确为“整题”；没有参数重试。
- 旁挂另解索引回 `event-001`，标题为未归类路线，不制造 BKT 方法证据。

此前 `/tmp/studyforge-runtime-closure-studentconfirm-20260722-fYvf85` 的嵌套 `methodResolution` 方案被模型连续五次序列化为字符串，Trace 全部失败；该方案已废弃，不能视为最终契约失败。

### 4.3 学生异议与方法否定的 correction closure

Runtime root：`/tmp/studyforge-runtime-closure-methodsupersede-20260722-mNbRj6`

- Tutor Session：`pi-agent/sessions/--private-tmp-studyforge-runtime-closure-methodsupersede-20260722-mNbRj6-examples-derivative-demo-learning-set--/2026-07-22T16-44-05-230Z_019f8ab6-84ee-793d-a39d-1cdbbf5cb345.jsonl`
- Trace chain：`lesson-003.md#trace-event-001` → `event-002` → `event-003`

观察：

- `event-001` 把路线判为 `partially_correct`。
- 学生指出 Tutor 的逻辑误判后，Tutor 接受异议并以 `event-002` supersede `event-001`，assessment 更正为 `correct`。
- Tutor 随后提议“局部逼近与找点”；学生认为不贴切并要求保留未映射。
- Tutor 以 `event-003` supersede `event-002`，在 note 中持久记录拒绝，active Trace 为 `correct + methods:null`，随后才推进下一 Block。

这证明学生可以否定合法但不贴切的节点，且否定不会只留在聊天中。该运行没有在 `event-002` 首次更正为 correct 后补写另解；随后已补充 Skill contract，但尚缺同路径的修订后真实复验，因此该子项只能记为 PARTIAL。

### 4.4 最终课堂事实真实性失败

Runtime root：`/tmp/studyforge-runtime-closure-finalaccept-20260722-epxahM`

- Tutor Session：`pi-agent/sessions/--private-tmp-studyforge-runtime-closure-finalaccept-20260722-epxahM-examples-derivative-demo-learning-set--/2026-07-22T16-48-42-896Z_019f8aba-c18f-7235-b274-c1429ee5b158.jsonl`
- 错误 Trace：`examples/derivative-demo/learning-set/lessons/lesson-003.md#trace-event-001`

学生完成了参数单调性与必要条件，但明确声明尚未证明 `a=e^{-1}` 的充分性。Tutor 随后：

1. 把学生未写出的充分性补成“学生推理链实际上完整”；
2. 错写 `x→1⁻` 时原式极限为 `1 + ln a - a`，实际应为 `1 + ln a`；
3. 只因一项为正就断言整个 `F_x(e^{-1})` 为正，没有处理同时存在的负项 `x²-x`；
4. 用 `assessment: correct` 写入 Trace，并继续提议“含参数分类讨论”节点。

因此该 active Trace 不是学生真实完成的证据，且数学判断本身不成立。此失败发生在方法确认之前，根因不是节点映射，而是 Tutor 把自己补出的内容冒充为学生证据。

## 五、分层结果

| 层 | 结果 | 证据 |
|---|---|---|
| Session ownerPath 与窄工具参数 | PASS | 基线 Tutor JSONL；自动 contract tests |
| `lesson_close` 原子关闭 | PASS | 基线 Lesson 最终文件；Pi tests |
| Coach `plan_update → read` | PASS | 基线 Coach JSONL；Plan 最终文件 |
| safe projection / raw JSONL 保留 | PASS | 基线 UI + JSONL；projection tests |
| Trace 后能力快照刷新 | PASS | 基线 UI；server test；Playwright ability case |
| Plan/Lesson URL 恢复 | PASS | 基线 UI；Playwright route/replay cases |
| attempt 聚合与题卡参考方法隔离 | PASS | Plugin method-signals tests |
| 首次 correct Trace → `整题`另解连续写入 | PASS | flatconfirm JSONL 与 alternatives 文件 |
| 学生确认/否定方法节点 | PASS | methodsupersede `event-002 → event-003` |
| accepted objection 写 superseding Trace | PASS | methodsupersede `event-001 → event-002` |
| assessment 更正为 correct 后立即补写另解 | PASS | evidence-freeze `event-001 → event-002` 与 alternatives sidecar |
| 不把 Tutor 补全冒充学生证据 | PASS | evidence-freeze 首轮 `incomplete` 与独立补全 Trace |
| 提示后的完成保留 `support:tutor` | **FAIL / P0** | hint-final2 `event-002` 错写为 `support:none` |

## 六、下一步

最小后续任务只剩提示支持来源，不再改 method schema 或 assessment 语义：

- 当前“不要加运行时门”的约束下，Agent/Skill 和工具参数描述已明确 `support:tutor` 的沿袭规则，但真实模型仍会偶发写成 `none`。
- 下一步需要在两个方向中明确选择：接受纯提示词方案的概率性误标，或重新授权一个极窄的确定性来源机制；在未选择前不继续堆叠提示词。
- 无论选择哪条路，都应复用本节的固定脚本：一级提示 → “明白了”不产证据 → 学生补全 → active Trace 必须是 `correct + support:tutor + supersedes`。

在提示支持来源的真实路径通过前，Task 11 与总计划 Final Completion Gate 保持未完成。

## 七、2026-07-23 Evidence Freeze Recheck

### 7.1 实现身份

- 初始证据冻结实现：`0d0721d`（`fix: freeze student evidence before tutor assessment`）
- 同一 attempt 的 supersede 提示：`5495062`
- `trace_append` 来源参数说明：`564c8c4`
- 写 Trace 前置来源检查：`0afd748`
- 未新增持久字段、裁判 Agent 或运行时数学判定；修订仅涉及 Agent/Skill 契约与既有工具参数描述。

### 7.2 无提示独立补全：PASS

Runtime root：`/tmp/studyforge-evidence-freeze-20260723-Ai7MKC`

- Tutor Session：`pi-agent/sessions/--private-tmp-studyforge-evidence-freeze-20260723-Ai7MKC-examples-derivative-demo-learning-set--/2026-07-22T17-58-41-645Z_019f8afa-d2ed-751c-a448-13e1c3f9a7d4.jsonl`
- 初始 Trace：`examples/derivative-demo/learning-set/lessons/lesson-003.md#trace-event-001`
- 补全 Trace：`examples/derivative-demo/learning-set/lessons/lesson-003.md#trace-event-002`
- 另解：`examples/derivative-demo/learning-set/cards/derivative/mst_p0032_ex22.card.alternatives.md`

事实顺序：

1. 学生明确缺少 `a=e^{-1}` 的充分性；Tutor 写 `assessment: incomplete`、`support: none`、`methodStatus: unmapped`，没有写另解、没有提议方法节点、没有推进下一 Block。
2. Tutor 只确认已建立的必要性并指出缺失证明义务，没有补出充分性。
3. 学生随后独立写出完整放缩链；Tutor 写 `event-002`，使用 `assessment: correct`、`support: none`、`supersedes: event-001`。
4. 下一工具轮调用 `card_alternative_append`，`question` 精确为“整题”，source Trace 为 `event-002`；工具完成后才向学生确认正确并询问方法节点。

### 7.3 提示支持分支：FAIL

最终有效 Runtime root：`/tmp/studyforge-evidence-freeze-hint-final2-20260723-kOY6wU`

- Tutor Session：`pi-agent/sessions/--private-tmp-studyforge-evidence-freeze-hint-final2-20260723-kOY6wU-examples-derivative-demo-learning-set--/2026-07-22T18-24-35-362Z_019f8b12-8822-701f-bb04-420bf9f80b0f.jsonl`
- 初始 Trace：`examples/derivative-demo/learning-set/lessons/lesson-003.md#trace-event-001`
- 提示后补全 Trace：`examples/derivative-demo/learning-set/lessons/lesson-003.md#trace-event-002`

事实顺序：

1. 初始缺证明回答正确写为 `incomplete + support:none`。
2. 学生请求“一级提示”，Tutor 返回一条一级提示。
3. 学生只回复“明白了”；此时仍只有一个 Trace，没有制造 `correct` 证据。
4. 学生随后写出完整证明；Tutor 正确写 `assessment: correct` 与 `supersedes: event-001`，但错误写成 `support: none`，未保留本 attempt 已发生的 Tutor 提示来源。
5. 发现失败后立即停止该运行，未把后续另解写入当作本分支通过证据。

中间失败样本均保留在各自 `/tmp/studyforge-evidence-freeze-hint-*` 隔离目录；其中 `/tmp/studyforge-evidence-freeze-hint-final-20260723-wNxnwb` 在开场工具顺序即失效，不计入证据结论。

### 7.4 自动回归与验收矩阵

| 检查 | 结果 |
|---|---|
| Pi Web `bun run check` | PASS：86 tests，0 fail；typecheck/build exit 0 |
| Plugin `bun run release:check` | PASS：59 tests，0 fail；strict validation exit 0 |
| Pi Web `bun run test:e2e` | PASS：8 tests，0 fail |
| 缺决定性证明保持 incomplete | PASS |
| Tutor 不补出缺失证明 | PASS |
| 无提示补全 supersede 为 `correct + support:none` | PASS |
| correct Trace → 整题另解 → 回复/方法询问 | PASS |
| 仅确认提示不制造 correct Trace | PASS |
| 提示后补全 supersede active incomplete Trace | PASS |
| 提示后补全保留 `support:tutor` | **FAIL** |

本次复验不改变报告顶部状态：**PARTIAL / FAIL — 不满足 Final Completion Gate**。
