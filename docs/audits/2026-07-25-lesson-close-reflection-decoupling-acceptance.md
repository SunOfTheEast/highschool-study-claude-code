# Lesson Close / Reflection Decoupling 验收报告

## 结论

**PASS。**

Lesson 生命周期已与 Reflection Block 解耦。六条 canonical 真实路径均只调用一次
`lesson_close`，唯一模型参数为 `summary`，成功回执绑定当前 Tutor Session 的
`ownerPath`。关闭只更新 Lesson Summary 与 Lesson `status`，不会替学生完成、
跳过或重排 Block。

同一次 attempt 的方法更正与同卡不同 Block 的独立 attempt 均按设计进入 active
Trace。Plan、学生画像和教学画像没有被 Tutor 的 Trace 更正自动改写。来源 Trace
失效后另解 sidecar 保留但退出能力投影的边界，由可执行集成测试覆盖。

## 运行身份

- 被验实现：`3677436`（`fix: preserve structured lesson summaries in replay`）
- Pi version：`0.81.0`
- Provider / model：`deepseek` / `deepseek-v4-pro`
- copied learning-set root：`/tmp/studyforge-reflection-decouple-*/learning-set`
- runtime health：`{"ok":true,"runtime":"pi"}`

未提交 Provider 凭据、Pi Session JSONL、完整课堂转录或验收 learning set。

## 自动验证

| Command | Result |
| --- | --- |
| `plugins/highschool-study: bun run release:check` | PASS：52 tests；strict plugin validation 通过；公共 MCP 工具仍为 4 个 |
| `apps/pi-teaching-web: bun run check` | PASS：158 tests；typecheck 与 production build 通过 |
| `apps/pi-teaching-web: bun run test:e2e` | PASS：12 Playwright tests |

关键可执行边界：

- [`lesson-close.ts`](../../apps/pi-teaching-web/src/runtime/lesson-close.ts) 只暴露
  `summary`，Runtime 注入真实 `ownerPath`。
- [`student-notebook.ts`](../../apps/pi-teaching-web/src/study/student-notebook.ts)
  从 closed Lesson 恢复关课摘要，并容忍历史正文中的二级小结标题。
- [`method-signals.test.ts`](../../plugins/highschool-study/tests/integration/method-signals.test.ts)
  验证 superseded-source alternative 仍在 sidecar，但不再进入 Planner Attention，
  且 Summary、Plan 和两个画像保持不变。

## 真实路径

所有 case 的 `lesson_close` 次数均为 1，参数键均只有 `summary`，receipt 均为
对应 `lessons/lesson-xxx.md` 与 `closed`。每份 Lesson 只有一个
`## Lesson Summary`，没有固定顶层 `## Reflection`。

| Case | Lesson / Tutor Session | 最终 Block 状态 | 证据 | 结论 |
| --- | --- | --- | --- | --- |
| Reflection 回答与关课同一轮 | `lesson-003` / `019f9815-34ad-70df-aec1-4e41887a7423` | `orientation: completed`；`review-core: completed`；`reflection: completed` | `lessons/lesson-003.md#lesson-summary`；active `#trace-event-002` | PASS |
| Reflection 已完成，下一轮关课 | `lesson-004` / `019f981c-ab78-70f1-9e93-1bc8e973b288` | `orientation: completed`；`review-core: completed`；`reflection: completed` | `lessons/lesson-004.md#lesson-summary`；active `#trace-event-002` | PASS |
| 零 Reflection，尚未作答即关课 | `lesson-012` / `019f9843-e0d3-782f-81e9-1770adf8bf14` | `diagnosis: active` | `lessons/lesson-012.md#lesson-summary`；active Trace 为空 | PASS：未把看题或停止伪造成 attempt |
| 两个 Reflection，在第一个之后关课 | `lesson-006` / `019f9827-b850-72ad-b80c-e1ef335d12b2` | `orientation: completed`；`retrospect: completed`；`project: pending` | `lessons/lesson-006.md#lesson-summary`；停止位置保持 pending | PASS |
| 同一次 attempt 更正方法节点 | `lesson-007` / `019f982b-5d66-77dd-9c9a-02afb5d6f2c3` | 三个 Block 均 `completed` | 历史 `event-001 → event-002 → event-003`；普通搜索只返回 active `#trace-event-003` | PASS |
| 同卡、不同 problem Block 的独立 attempt | `lesson-008` / `019f9831-f0ce-7017-bfa0-d0fb5df8c725` | 三个 Block 均 `completed` | active `#trace-event-001` 为首次 incomplete；active `#trace-event-003` 为第二次 correct | PASS：两次 attempt 未互相 supersede |

### 权威边界核对

- 六个 Tutor Session 的 `plan_update` 调用数均为 0；Plan 只因 Coach 备课而增加
  Lesson Index，没有被 Tutor 的 Trace 或关课动作自动裁决。
- `memory/student-profile.md` 与 `memory/teaching-profile.md` 均与验收副本建立时
  逐字一致。
- `lesson-007` 的普通 Trace 搜索只返回 `event-003`。
- `lesson-008` 的普通 Trace 搜索同时返回不同 Block 的 `event-001` 与
  `event-003`。
- `lesson-012` 没有 Trace，证明“呈现题目但没有数学作答”不会生成证据。
- Planner Attention 只链接 active Trace；被 supersede 的旧事件不再成为来源。
- closed Lesson 刷新后仍恢复原 Tutor URL、只读 composer、最终消息、
  “结课时记录”和“返回 Coach”按钮。

### 补充纠错验收

`lesson-013`（Session `019f984b-2c33-7db4-ba4b-fbdb546999fb`）先确认
“充分/必要性探路”为主、“自由度与主元”为辅，随后学生在同一 attempt 内要求
反转主次。Tutor 追加 `event-003` supersede `event-002`；普通搜索只返回
`event-003`，Planner Attention 的来源也立即切换到 `event-003`。关课后刷新仍
恢复完整 Lesson Summary。

这张卡的参数单调性另解已由 `lesson-003#trace-event-002` 写入 sidecar，
`lesson-013` 没有重复追加同一路线。针对“另解来源本身随后失效”的精确边界，
自动集成测试另行构造并验证：sidecar 字节不变，能力投影移除旧来源，Lesson
Summary、Plan 和两个画像均不变。

## 验收中发现并修复的问题

1. 关课摘要曾泄漏 Teacher Control / 隐藏检查点：已限制为学生已见内容和 active
   Trace，最终零 Reflection 路径通过。
2. 模型曾重复写入 `## Lesson Summary`：tool schema 已明确只接收正文。
3. 模型曾把“只看见题目但未作答”写成 Trace：Tutor Skill 已明确非 attempt
   不写 Trace。
4. 模型高频在 Summary 正文中写 `## 课堂小结`，导致旧读取器把正文截成空串：
   已让学生投影以 `Aliases` / `Traces` 结构区为边界，并要求新摘要内部只用
   `###` 子标题。七份真实 closed Lesson 的 API 投影均已恢复非空摘要。

## 残余问题

辅助探索中的 `lesson-010` / `lesson-011` 曾出现 Tutor 在一次启动中同时激活
orientation 与 diagnosis、未先完成 orientation 的情况。`lesson_close` 正确保留
了两个真实状态，因此它不影响本设计的生命周期验收；这是课堂节点推进顺序的独立
后续问题，不应重新耦合 Reflection 或扩大本轮关课契约。

Provider 响应延迟和浏览器遥测网络警告没有改变任何 Lesson、Trace、Plan 或回放
结果，不计为教学运行时缺陷。
