---
id: lesson-003
kind: lesson
plan_id: domain-integrity
status: prepared
---
# Lesson 003：阶段 1b — 定义域连续性与跨结构迁移核验

## Plan Link

[定义域完整性的系统加固](../plans/domain-integrity.md) — 阶段 `1b`：用两道未见结构核验定义域能否连续独立无遗漏，并观察它是否真正参与边界判断。

## Capability Target

面对含参数对数和开区间边界的恒成立不等式，在无提示下先写全定义域与正负条件，并在变形、参数分离和端点判断中主动使用这些条件。

## Lesson Configuration

- Primary template: `assessment`
- Reason: 本课需要确认阶段 `1b` 是否达标，并用第二种未见结构观察迁移；教学和提示不能先于验收证据。
- Adjustment: 保留一个可选的历史题修复 Block；只有首题出现缺口或学生主动求助时使用。
- Required unseen roles: continuity check、cross-structure transfer。
- Optional seen role: trace-grounded remediation。

## Sources

- Continuity check: [mst_p0032_ex22](../cards/derivative/mst_p0032_ex22.card.yaml)
- Transfer check: [mst_p0030_ex16](../cards/derivative/mst_p0030_ex16.card.yaml)
- Optional remediation: [mst_p0017_ex05](../cards/derivative/mst_p0017_ex05.card.yaml) and [Lesson 002 Trace](lesson-002.md#trace-event-001)
- Public source policy: [demo notes](../materials/demo-notes.md#source-policy)

## Dependencies and control

- `orientation` precedes both assessment Blocks.
- `assessment-01` precedes `assessment-02`; `repair-optional` may be inserted between them.
- `repair-optional` is skipped when the first response is independently complete.
- The student may pause or close at any time. `reflection` may move earlier only after at least one evidence-bearing attempt.

---

## Block orientation（必做）

### Student View

本课先做两道不同结构的未见题。每题请先单独写出定义域、恒正或恒负条件，再开始等价变形；两题首次尝试都不提供提示。你可以随时暂停或结束。

### Teacher Control

- Role: capability-standard orientation。
- Evidence target: 学生理解“先列合法域并在后续真正使用”，但不提前获知任何目标卡的方法。
- Reveal: `zero`。
- Do not name the target method or preview either card's transformation.

---

## Block assessment-01（必做）

### Student View

请独立完成题卡 `Q-DOMAIN-EX22`。教练只呈现真实题干和选项；请先写出所有合法性与符号条件，再给出完整理由和结论。

### Teacher Control

- Role: continuity check for Plan stage `1b`。
- Evidence target: 定义域是否无提示写全，并在关键变形和开区间边界中被主动使用。
- Reveal: `zero`。
- Card evidence: Q-DOMAIN-EX22 `step_1` and `step_5`; inspect the remaining card steps privately only after the student's attempt.
- If help is requested, record the unsupported or incomplete attempt, then offer `repair-optional`. Do not count the supported completion as independent `1b` evidence.

---

## Block repair-optional（可选）

### Student View

如果你希望先修复卡点，我们回看已经做过的 `Q-DOMAIN-EX05`：只比较“哪些量必须先保证有意义或为正，以及这些条件后来在哪一步真正被使用”。不把旧题结果当成新验收证据。

### Teacher Control

- Role: trace-grounded remediation using a seen card.
- Evidence target: connect the Lesson 002 domain success to the gap just observed.
- Reveal: `ladder`.
- Source: Lesson 002 Trace event-001 and Q-DOMAIN-EX05 `step_1`–`step_2`.
- Reveal one level per consented turn. This block is not independent assessment evidence.

---

## Block assessment-02（必做）

### Student View

请独立完成另一张未见题卡 `Q-DOMAIN-EX16`。教练只呈现真实题干和选项；仍然先写合法域和符号条件，再决定如何推进。

### Teacher Control

- Role: cross-structure transfer; if repair ran, this is also the fresh unsupported retest.
- Evidence target: 定义域、正量与开区间边界能否迁移到不同外壳，而不是复述上一题路线。
- Reveal: `zero`.
- Card evidence: Q-DOMAIN-EX16 `step_1` and `step_7`; inspect the remaining card steps privately only after the student's attempt.
- Do not reuse a hint, intermediate result, or answer from assessment-01.

---

## Block reflection（必做）

### Student View

比较两次首次尝试：哪一个定义域或符号条件真正改变了你的变形合法性、参数边界或端点取舍？如果你认为今天已经够了，也可以在这里结束课程。

### Teacher Control

- Role: evidence summary and student-controlled closure.
- Evidence target: distinguish an independently used condition from a condition added only during checking.
- Reveal: `zero`; summarize only evidence already produced by the student and active Trace.
- Task completion is not capability attainment. Show supporting and conflicting evidence before reflection routing.

## Reflection

（课堂结束后填写）

## Lesson Summary

（课堂结束后填写）

## Aliases

- Q-DOMAIN-EX22: ../cards/derivative/mst_p0032_ex22.card.yaml
- Q-DOMAIN-EX16: ../cards/derivative/mst_p0030_ex16.card.yaml
- Q-DOMAIN-EX05: ../cards/derivative/mst_p0017_ex05.card.yaml

## Traces

（课堂中通过 trace_append 追加）
