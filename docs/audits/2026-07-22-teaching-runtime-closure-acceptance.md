# Teaching Runtime Closure 验收报告

状态：**PARTIAL / FAIL — 不满足 Final Completion Gate**

运行日期：2026-07-22  
报告日期：2026-07-23

## 一、结论

Session 绑定工具、Plan/Lesson 写回、安全消息投影、能力快照刷新、浏览器路由恢复、首次正确另解落盘，以及学生异议/方法否定的 superseding Trace 均有自动测试或真实运行证据。

整体验收仍未通过。最终真实课堂中，学生明确说“还没有写出充分性证明”，Tutor 却把自己补出的推理记成学生已经完成的证据，并写入 `assessment: correct`；补出的推理还包含错误极限与未经证明的正性结论。这是课堂事实真实性 P0，自动测试通过不能覆盖它。

另有一条未完成的真实复验：当学生异议把 active Trace 从 `partially_correct` 更正为 `correct` 时，Tutor 应立即重新判断并落盘另解。Skill contract 已补齐，但该精确路径尚未在修订后重新跑通。

## 二、运行身份与隔离

- 分支：`codex/studyforge-lane-a`
- 基线实现提交：`66d17b9694e109baf089efa50e7a4fd6fa4bd08c`
- 学生确认方法契约提交：`dceed02`（`fix: require student-confirmed method evidence`）
- 学习集：`examples/derivative-demo/learning-set`
- Provider：`xiaomi`
- Model：`mimo-v2.5-pro-ultraspeed`
- Pi 配置只记录 provider/model；本报告不包含 API key、认证内容、私密推理或完整课堂转录。
- 所有课堂写入均发生在 `/tmp/studyforge-runtime-closure-*` 隔离副本；仓库中的 `examples/derivative-demo/learning-set/**` 未被验收运行修改。

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
| assessment 更正为 correct 后立即补写另解 | PARTIAL | contract 已补；同路径真实复验缺失 |
| 不把 Tutor 补全冒充学生证据 | **FAIL / P0** | finalaccept Session 与错误 active Trace |

## 六、下一步

最小后续任务应只处理课堂证据边界，不再改 method schema：

- 学生明确承认决定性步骤、证明或结论尚缺失时，active assessment 不能由 Tutor 自行补成 `correct`。
- Tutor 自己提供的补充只能算 Tutor 支持，不能倒灌为学生已经产出的 `support: none` 证据。
- 先用一个失败 contract/真实模型样本固定该边界，再修改 Tutor Skill；不新增裁判 Agent、运行时数学规则或新持久字段。
- 修订后重跑 finalaccept 场景，并顺带完成“异议更正为 correct 后补写另解”的缺失真实复验。

在这两个真实路径通过前，Task 11 与总计划 Final Completion Gate 保持未完成。
