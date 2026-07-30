---
id: domain-integrity
kind: plan
status: active
parent_id: roadmap
parent_path: ROADMAP.md
coach_session: null
---
# Plan：定义域完整性的系统加固

> 让定义域从“容易遗漏的附加条件”变成导数解题的第一步和导航工具。

## Goal

让定义域从“容易遗漏的附加条件”变成导数解题的第一步和导航工具，并在不同题型中稳定迁移。

## Observable Capability Standard

连续两道不同结构的导数题中，在无提示情况下先写全所有显式和隐式定义域约束，并据此完成区间或参数边界判断。

## Test

在一道嵌套约束迁移题中首次尝试无遗漏。

## Planning Basis

当前判断是定义域遗漏已经成为稳定阻塞点，而不是一次计算失误。若连续独立核验仍出现遗漏，就重新检查是否需要更基础的函数条件诊断。

## Activation Snapshot

- Parent: roadmap:roadmap
- Activated at: 2026-07-21T08:00:00.000Z

### Selected Context

- trace:trace-fixture-001
- trace:trace-fixture-002

### Content Boundary

- 不在课前公开目标题的决定性变形。

### Adaptation Brief

- Working judgment: 定义域遗漏是当前稳定阻塞点。
- Sources:
  - trace:trace-fixture-001
  - trace:trace-fixture-002
- Design consequence: 使用不同结构连续核验定义域能否主动参与推导。
- Revise if: 学生在两类陌生结构中均能首次独立写全并使用合法域。

## Lesson Tree

### Child lesson-candidate-001

- Node: [Lesson 001：冷启动诊断](../lessons/lesson-001.md)
- Public purpose: 找到定义域遗漏的真实起点。
- After:
- Depends on:
- Consider when: 需要确认问题是否来自定义域。
- Sources:
  - trace:trace-fixture-001
- Private note: 诊断记录，不升级为稳定能力。

### Child lesson-candidate-002

- Node: [Lesson 002：阶段 1a 核验](../lessons/lesson-002.md)
- Public purpose: 核验能否在第二种结构中主动写出定义域。
- After: lesson-candidate-001
- Depends on: lesson-candidate-001
- Consider when: 第一节已定位定义域遗漏。
- Sources:
  - trace:trace-fixture-002
- Private note: 保持题目结构相近，只检查连续性。

### Child lesson-candidate-003

- Node: [Lesson 003：阶段 1b 核验](../lessons/lesson-003.md)
- Public purpose: 完成一次独立能力检验。
- After: lesson-candidate-002
- Depends on: lesson-candidate-002
- Consider when: 阶段 1a 已通过，需要排除偶然进步。
- Sources:
  - trace:trace-fixture-002
- Private note: 用未见结构检查定义域连续性和跨结构迁移。

## Current Position

- 阶段 `1a` 已通过：第二节课独立写出 `a>0`，无提示、无遗漏。
- 阶段 `1b` 待续：需再用一题确认不是偶然进步。

## Plan Summary

两节课显示定义域意识从遗漏真数限制进步到主动写出 `a>0` 并用于保持不等号方向；证据仍需第三节确认。

## Handoff

（尚未封存）
