---
id: domain-integrity
kind: plan
status: active
---
# Plan：定义域完整性的系统加固

## Goal

让定义域从“容易遗漏的附加条件”变成导数解题的第一步和导航工具，并在不同题型中稳定迁移。

## Observable Capability Standard

连续两道不同结构的导数题中，在无提示情况下先写全所有显式和隐式定义域约束，并据此完成区间或参数边界判断；随后在一道嵌套约束迁移题中首次尝试无遗漏。

## Test

1. `1b`：再完成一道含对数真数约束的题，连续第二次独立无遗漏。
2. 跨题型：在不等式、恒成立参数或零点分析中，至少两类题主动用定义域确定答案边界。
3. 迁移：在非常规嵌套约束题中首次尝试一次通过。

## Planning Basis

当前判断是定义域遗漏已经成为稳定阻塞点，而不是一次计算失误。

关键来源：[Lesson 001](../lessons/lesson-001.md#trace-event-001)、
[Lesson 002](../lessons/lesson-002.md#trace-event-001)。

若连续独立核验仍出现遗漏，就重新检查是否需要更基础的函数条件诊断。

## Lesson Index

1. [Lesson 001：冷启动诊断](../lessons/lesson-001.md) — closed；原 run 为 unplanned，作为本 Plan 的诊断起点登记。
2. [Lesson 002：阶段 1a 核验](../lessons/lesson-002.md) — closed；`1a` 已通过。
3. [Lesson 003：阶段 1b 核验](../lessons/lesson-003.md) — prepared；等待开始。

## Current Position

- 阶段 `1a` 已通过：第二节课独立写出 `a>0`，无提示、无遗漏。
- 阶段 `1b` 待续：需再用一题确认不是偶然进步。
- 同构形式迁移仍需观察：`e^u/u` 流畅，但 `te^t` 变体需要两步提示；证据尚不足以形成长期画像。

## Next Lesson Candidate

- [mst_p0032_ex22](../cards/derivative/mst_p0032_ex22.card.yaml)：换用 `ln t/t` 一类结构，同时核验定义域连续性和同构泛化。
- 备课 Agent 应先用 `card_search` 查看候选卡自带的完整 Trace；若需要跨卡比较，再调用 `trace_search`。

## Plan Summary

两节课显示定义域意识从“遗漏 `ln` 真数限制”进步到“拿到题即独立写出 `a>0` 并用于保持不等号方向”。这一进步只有两次课堂证据，仍需 `1b` 确认。同构能力在不同函数外壳下表现分化，暂作为本 Plan 内待核验注意点，不写入长期偏好画像。

来源：[Lesson 001 Summary](../lessons/lesson-001.md#lesson-summary)、[Lesson 002 Summary](../lessons/lesson-002.md#lesson-summary)。
