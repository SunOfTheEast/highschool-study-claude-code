---
id: lesson-001
kind: lesson
status: closed
parent_id: domain-integrity
parent_path: plans/domain-integrity.md
tutor_session: session-lesson-001
---
# Lesson 001：冷启动诊断

> 找到定义域遗漏的真实起点。

## Activation Snapshot

- Parent: plan:domain-integrity
- Activated at: 2026-06-09T06:20:00.000Z

### Selected Context

- card:cards/derivative/mst_p0019_ex11.card.yaml

### Content Boundary

- 首次尝试前不提示定义域。

### Adaptation Brief

- Working judgment: 需要区分定义域遗漏与一般计算失误。
- Sources:
  - card:cards/derivative/mst_p0019_ex11.card.yaml
- Design consequence: 使用一题冷启动诊断观察首次作答。
- Revise if: 学生能首次完整写出并使用全部合法域。

## Block block-001（必做）

### Node State

- Kind: dialogue
- Required: true
- Status: completed
- Depends on:
- Uses:

### Student View

先说明这次想强化的能力。

### Teacher Control

只确认目标，不提示方法。

## Block block-002（必做）

### Node State

- Kind: problem
- Required: true
- Status: completed
- Depends on: block-001
- Uses: Q-DOMAIN-EX11

### Student View

独立完成题卡。

### Teacher Control

记录首次作答中的定义域使用情况。

## Block block-003（必做）

### Node State

- Kind: reflection
- Required: true
- Status: completed
- Depends on: block-002
- Uses:

### Student View

总结定义域在哪一步改变了结论。

### Teacher Control

只总结已产生的证据。

## Lesson Summary

同构识别和切线放缩较流畅；主要证据是定义域遗漏直接造成左端点错误，但学生能在追问后自查纠正。

## Aliases

- Q-DOMAIN-EX11: ../cards/derivative/mst_p0019_ex11.card.yaml

## Handoff

- ID: lesson-001/handoff
- From: lesson:lesson-001
- To: plan:domain-integrity
- Sealed at: 2026-06-09T06:45:00.000Z

### Source Index

- trace:trace-fixture-001
