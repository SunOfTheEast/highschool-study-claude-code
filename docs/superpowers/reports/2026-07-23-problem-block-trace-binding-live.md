# Problem Block Trace 题卡自动绑定真模验收

日期：2026-07-23

## Run Identity

- App commit: `4e5e2decb4a5cfd3d6d87ce42c8c26d517b0710d`
- Initial repository state: clean
- Copied learning set: `/tmp/studyforge-trace-binding-deepseek-qzsNuW/learning-set`
- Runtime URL: `http://127.0.0.1:65433`
- Message projection: `raw-stream`
- Provider/model: `deepseek/deepseek-v4-pro`
- Plan/Lesson: `domain-integrity` / `lesson-003`
- Tutor Session: `019f8fb4-5cd4-7109-a1f1-f83c8969cad0`
- Attempt Block: `assessment-01`
- Lesson alias: `Q-DOMAIN-EX22`
- Frozen card path: `cards/derivative/mst_p0032_ex22.card.yaml`
- Trace anchor: `lessons/lesson-003.md#trace-event-001`

本次只写入 `/tmp` 学习集副本。仓库示例保持干净，Provider 凭据没有被打印、
复制进报告或写入仓库。

## Automated Verification

| Check | Result |
| --- | --- |
| `apps/pi-teaching-web: bun run check` | PASS：131 tests，0 fail；TypeScript 与生产构建通过 |
| `plugins/highschool-study: bun run release:check` | PASS：48 tests，0 fail；bundle、typecheck 与严格插件校验通过 |
| Public MCP surface | PASS：仍为 `card_search`、`trace_search`、`trace_append`、`source_resolve` |
| Blueprint/source admission | PASS：零卡和多卡 problem Block 均被拒绝 |
| Pi tool schema | PASS：`trace_append` 不再暴露 `cardAlias` |
| Cross-binding regression | PASS：旧调用即使额外传入别的 alias，也只能写入所选 Block 的唯一题卡 |
| Non-problem Trace | PASS：dialogue/reflection Trace 仍可保持 `cardPath: null` |

## Real-Model Evidence

Tutor 读取当前 Lesson 后展示真实题卡，学生独立完成第一题。模型随后调用一次
`trace_append`。原始工具参数键为：

```text
assessment
blockId
materialPath
methodRoute
methodStatus
note
support
```

其中没有 `cardAlias`、`lessonPath`、`cardStepId` 或 Session ID。运行时仅根据
Session owner `lessons/lesson-003.md` 与 `blockId: assessment-01` 读取：

```text
assessment-01
  -> Uses: Q-DOMAIN-EX22
  -> Aliases: ../cards/derivative/mst_p0032_ex22.card.yaml
```

最终 Trace 为：

```text
Block: assessment-01
Card: cards/derivative/mst_p0032_ex22.card.yaml
Assessment: correct
Support: none
Methods: null
```

## Read-Path Audit

| Reader | Result | Evidence |
| --- | --- | --- |
| Lesson Trace | PASS | `event-001` 持久化真实 cardPath，不再是 `(none)` |
| `card_search` | PASS | 目标题卡的 `traceHistory` 含 `event-001` |
| `trace_search` | PASS | 返回 `event-001`，且 `cardsByPath` 含唯一目标题卡 |
| Evidence View | PASS | `/api/evidence` 返回非空 card metadata，路径与 Trace 一致 |
| Ability projection | PASS（预期为空） | Tutor 将实际路线保留为 `methodStatus: unmapped`；题卡身份恢复不会伪造学生方法证据 |
| Session ownership | PASS | raw Session owner 为 `role: tutor`、`ownerPath: lessons/lesson-003.md` |

## Scope Notes

- 这是针对题卡绑定链的短验收；首张题完成并写入后暂停 Lesson，没有把整节课或
  Plan 完成状态纳入本报告。
- Tutor 额外把同一题卡路径填入了可选 `materialPath`，因此 Trace 中出现一条冗余
  `Material:`。它不影响 cardPath、双向检索或能力边界，也不属于本次题卡身份修复。
- 能力图保持空不是回归。方法投影只接受学生确认过的规范方法；本次路线明确为
  `unmapped`。
- 验收中有一次由审计端手写 JSON 转义错误导致的 HTTP 500；请求没有进入 Session，
  重新用 JSON 编码器提交后正常完成。它不是模型或产品链故障。

## Result

本次修复通过。Pi Tutor 不再负责重复选择题卡 alias；每个 problem Block 的单卡
约束在 Blueprint、首次准入和 Trace 写入三处一致，真实模型省略 alias 时仍能得到
正确、持久且可双向检索的 cardPath。公共 MCP 和无卡教学 Trace 的既有边界没有改变。
