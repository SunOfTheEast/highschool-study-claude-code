---
id: lesson-003
kind: lesson
plan_id: domain-integrity
status: prepared
---
# Lesson 003：阶段 1b — ln t/t 同构 + 定义域连续性核验

## Plan Link

[定义域完整性的系统加固](../plans/domain-integrity.md) — 阶段 `1b`：再用一道含对数真数约束的题，连续第二次独立无遗漏。

## Capability Target

面对含 `ln a` 和 `ln x` 的恒成立不等式，在无提示下独立写出 `a>0`，并在同构变形为 `f(t)=ln t/t` 的比较过程中，主动确认除量的正性、定义域对参数边界的约束以及开区间上确界的取等情况。

## Evidence Target

- **Primary (1b)**: 学生拿到题后独立写出 `a>0`，并在后续步骤中至少一次主动引用该约束（如确认除 `xae^x` 时符号不反向，或排除选项 A 的负数区间）。
- **Secondary (isomorphism generalization)**: 观察学生能否在 `ln t/t` 外壳下识别同构结构；与 Lesson 001 的 `e^u/u` 和 Lesson 002 的 `te^t` 对比泛化程度。

## Source

- Card: [mst_p0032_ex22](../cards/derivative/mst_p0032_ex22.card.yaml)（2025 江苏卓越联盟月考 T8）
- Public source policy: [demo notes](../materials/demo-notes.md#source-policy)；原教材页未进入公开仓库。

## Prerequisites

- Lesson 001（`e^u/u` 同构 + 定义域遗漏→自查纠正）
- Lesson 002（`te^t` 同构 + `a>0` 独立写全）
- 导数基础：`f(t)=ln t/t` 的单调性分析
- 恒成立转参数范围的基本框架

---

## Block warmup（可选，可跳过）

**类型**: 交互回顾
**预计时间**: 2-3 分钟
**安全跳过条件**: 学生表示不需要回顾，或时间紧张

快速回顾前两题的定义域要点：
- Lesson 001 的 `mst_p0019_ex11`：`1+ln(2x)>0` → 左端点 `1/(2e)`
- Lesson 002 的 `mst_p0017_ex05`：`ln a` → `a>0`，同乘 `x/a` 时用它保证不反向

**目标**: 激活定义域优先的解题习惯，不做新教学。

---

## Block explanation（推荐）

**类型**: 讲解
**预计时间**: 3-5 分钟
**安全跳过条件**: 学生要求直接做题

呈现题目并点明结构特征：

> 题干：$x^2 + x\ln a - ae^x\ln x > 0$ 对 $\forall x\in(0,1)$ 恒成立，求 $a$ 的范围。
>
> 关键信号：
> 1. 出现 `ln a` → 实数范围内要求 `a>0`（定义域第一步）
> 2. $x^2 + x\ln a$ 可合并为 $x\ln(ae^x)$
> 3. 与 $ae^x\ln x$ 并置→提示同除以正量 $xae^x$，凑出 $\frac{\ln t}{t}$ 形式的同构比较
> 4. $f(t)=\frac{\ln t}{t}$ 在 $(0,e)$ 递增，在 $(e,+\infty)$ 递减；$f(1)=0$，$0<t<1$ 时 $f(t)<0$
> 5. $x\in(0,1)$ 是开区间 → 上确界 $1/e$ 可取等（$a=1/e$ 仍满足严格不等式）

**注意**: 讲解只做结构导航，不给完整推导。学生需独立完成变形和判断。

参考来源：[card solution](../cards/derivative/mst_p0032_ex22.card.yaml)

---

## Block practice（必做）

**类型**: 练习
**预计时间**: 8-12 分钟
**不可跳过**

学生独立完成 `mst_p0032_ex22` 的完整求解。

**教练观察要点**（不做提示，只记录）:
1. 是否在第一步独立写出 `a>0`
2. 是否主动确认除 `xae^x` 时各项为正
3. 同构识别：能否将不等式转化为 `f(ae^x) > f(x)` 形式
4. `f(t)=ln t/t` 的单调性分析和符号判断
5. 从 `ae^x > x` 到 `a ≥ 1/e` 的推导，开区间上确界的取等判断
6. 最终选 D 而非 B（B 排除了 `a=1/e`，D 排除了 `a≤0` 的区间）

**卡点预案**（来自 card fallback）:
- 未写 `a>0` → 回补函数三要素与定义域
- 不会合并 `x^2 + x ln a` → 回补指数对数基础
- 不会对 `f(t)=ln t/t` 求导判单调 → 回补导数单调极值基础
- 把上确界误当作不可取 → 回补开区间恒成立中端点的处理

Card reference: [mst_p0032_ex22](../cards/derivative/mst_p0032_ex22.card.yaml) rubric steps 1-5

---

## Block interaction（推荐，可在 practice 后合并）

**类型**: 交互讨论
**预计时间**: 3-5 分钟
**安全跳过条件**: practice 中学生表现流畅且 self-check 完整

讨论题：
1. 这道题的定义域约束和上一题（`mst_p0017_ex05`）有什么相同和不同？
2. `f(t)=ln t/t` 和之前见过的 `g(u)=e^u/u`、`F(t)=te^t` 三种同构外壳，你在识别时觉得哪个最难？为什么？
3. 选项 A 和 B 都包含负数或零——只看选项能否先排除它们？这算不算定义域在帮你做题？

**目标**: 强化"定义域不是验算，是决策工具"的认识；收集同构泛化的学生自评。

---

## Block quiz（可选，快速收束）

**类型**: 小测
**预计时间**: 2 分钟
**安全跳过条件**: practice 已充分展示 `1b` 证据

口述或书写一句话总结：*这道题里，定义域在哪个步骤帮了你？*

**目标**: 快速确认学生是否形成了可表述的元认知。

---

## Reflection

（课堂结束后填写）

## Lesson Summary

（课堂结束后填写）

## Aliases

- Q-DOMAIN-EX22: ../cards/derivative/mst_p0032_ex22.card.yaml

## Traces

（课堂中通过 trace_append 追加）
