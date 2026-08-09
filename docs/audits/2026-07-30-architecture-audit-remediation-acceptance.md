# 架构审计问题收口验收

日期：2026-07-30  
结论：`PASS`

## Baseline

- Source commit：`45342e55cc3019d355a71e55005fd4e9554444d6`
- Branch：`codex/architecture-audit-remediation`
- 验收前工作区：clean
- 学习集：`/tmp/studyforge-audit-remediation-*/learning-set`
  形式的导数公开学习集副本；仓库样例未被修改
- Message projection：`safe`
- Provider / model / thinking：
  `deepseek / deepseek-v4-pro / high`
- Tutor Session：`019fb22f-2568-77af-b56f-8b86ce17afb0`
- Session owner：
  `tutor / lesson-003 / lessons/lesson-003.md`

凭据、原始 Session JSONL、Teacher Control、完整题卡解答和完整课堂转录均未写入本报告。

## Automated Gates

| Command | Result |
| --- | --- |
| `plugins/highschool-study: bun run release:check` | PASS：build、typecheck、59 tests 与 strict plugin validation 全部通过；公共 MCP 工具仍为 4 个 |
| `apps/pi-teaching-web: bun run check` | PASS：typecheck、309 tests 与 production build 全部通过 |
| `apps/pi-teaching-web: bun run test:e2e` | PASS：17 Playwright tests |

## Accepted Writes

### 真实模型课堂

学生从 `safe` 学生界面启动 `lesson-003`，完成了一次真实短课并明确要求结束，随后点击
“返回学习顾问”回到原 Plan Coach。

最终 Lesson 事实为：

- Lesson：`closed`
- `orientation`：`completed`
- `assessment-01`：`completed`
- `repair-optional`：`completed`
- `assessment-02`：`active`
- `reflection`：`pending`

`lesson_close` 保留了学生停止时仍 active 的第二道评估题，没有把未作答 Block
伪造成完成或跳过。Replay 明确区分第一题已完成、修复环节已完成和第二题未作答。

### Route Changes

同一 Lesson 最终包含：

1. `route-001`：`skip repair-optional`
2. `route-002`：`insert repair-optional`
3. `route-003`：`insert assessment-02`

第一次跳过时，`repair-optional` 同步成为 `skipped`；学生改主意后，它在一次
route 写入中恢复为 `pending`，依赖已完成后才被激活。第二题已经激活但尚未作答时，
Tutor 先结束其当前 active 状态，再进入修复环节；修复完成后把第二题恢复为
`pending` 并重新激活。最终 Route Change 与 Block 状态没有互相矛盾。

### Same-Block Trace chain

`assessment-01` / `cards/derivative/mst_p0032_ex22.card.yaml` 形成：

```text
event-001 incomplete
  → event-002 incorrect
  → event-003 correct
  → event-004 correct + 含参数分类讨论
```

四条事件始终绑定同一 Block 和同一卡片；后三条依次 supersede 当时唯一 active
事件。最终 active source 为
`lessons/lesson-003.md#trace-event-004`，前三条不再进入普通 active Trace
读取。学生可见课堂没有出现 Teacher Control、工具参数或原始内部矩阵。

### Learning Review recovery

以已经失效的
`lessons/lesson-003.md#trace-event-001` 作为 key evidence 时，运行时返回：

```text
LEARNING_REVIEW_SOURCE_NOT_ACTIVE:
source=lessons/lesson-003.md#trace-event-001;
reason=not-active;
eligible=lessons/lesson-003.md#trace-event-004
```

调用前后 Plan SHA-256 均为
`393e9de1d82e0fb8aa0c14a2645c433ec5ddef9751d091cdc6d4e49e90a8459f`。
错误既给出客观原因和合格候选，也没有修改 Plan。

### Real-model recovery observation

Tutor 在动态重排中出现两次被运行时拒绝的调用：

- `CLASSROOM_BLOCK_NOT_ACTIVE: requested=repair-optional; active=(none)`
- `CLASSROOM_ACTIVE_BLOCK_EXISTS: assessment-02`

模型随后分别改用 route skip，以及先结束当前第二题状态再激活修复 Block；没有把
工具参数问题交给学生，也没有留下冲突状态。这验证了局部 gate 能阻止错误写入，
同时仍允许同一 Session 自主恢复。

## Rejected Writes

以下结果来自另一个导数学习集一次性副本上的直接工具 harness。每次调用都在操作前后
逐字比较 Lesson 与 Plan：

| Mutation | Exact error | Lesson bytes | Plan bytes |
| --- | --- | --- | --- |
| 未满足 `assessment-01` 依赖时激活 `assessment-02` | `CLASSROOM_DEPENDENCY_UNRESOLVED: block=assessment-02; dependsOn=assessment-01` | unchanged | unchanged |
| `orientation` active 时再激活 `assessment-01` | `CLASSROOM_ACTIVE_BLOCK_EXISTS: orientation` | unchanged | unchanged |
| `assessment-02` 跨 Block supersede `assessment-01` | `INVALID_TRACE: Superseded event must belong to the same Block: requested=assessment-02; target=assessment-01` | unchanged | unchanged |
| 再次 supersede 已失效 `event-001` | `INVALID_TRACE: Superseded event must be active: event-001` | unchanged | unchanged |
| Lesson source 指向不存在的 `materials/not-there.md` | `LESSON_BLUEPRINT_INVALID: 来源无法定位：materials/not-there.md（MISSING_FILE）` | unchanged | unchanged |

来源失败后 `lessons/lesson-smoke.md` 不存在，`lessons/` 文件列表逐项不变。

## Remaining Boundaries

- 本地单人版的 raw Workspace API 仍不是保密边界；`safe` 解决学生渐进呈现，不等于
  云端权限隔离。
- 多用户云发布仍缺认证、learning-set 归属、角色授权和 student-only DTO；完成独立
  云端设计前不能把当前服务直接当作共享 SaaS。
- 本轮未验证 Roadmap Coach 的 generic Pi `write/edit` 是否能绕过 owner-bound
  工具修改既有 Plan、Lesson 或 profile；没有复现前不增加 allowlist。
- 全新隔离 `PI_CODING_AGENT_DIR` 首次启动时，Pi npm 初始化耗时约 49 秒，超过 Bun
  默认 10 秒 request timeout。Lesson 曾先变为 `active`，Tutor Session 随后在同一
  进程完成创建；刷新后恢复到同一 canonical Session 并完成全课。该冷启动现象未造成
  最终事实损坏，但启动状态与 Session 创建不是一个原子步骤，留作独立运行时议题。
- Plan / Roadmap 跨文件事务、云端权限和 generic 文件工具均未在本轮扩张实现；只有
  故障注入或真实绕过证据出现后再设计。
