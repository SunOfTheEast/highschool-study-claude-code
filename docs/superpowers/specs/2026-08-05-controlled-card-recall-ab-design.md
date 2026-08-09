# 受控题卡召回 A/B 实验设计

日期：2026-08-05

状态：已批准并开始运行；thinking 档位在首对 smoke 后按模型能力做了一次透明修订

## 目标

回答一个窄问题：在相同规范 brief、相同当前 Scout、相同模型和有效 thinking 下，使用
`graph/card-recall-index.tsv` 是否在降低检索负担的同时保持最终可用题卡质量。

本轮不把“模糊教学需求如何翻译成规范词”与“规范词如何召回题卡”混在一起。真实产品路径
中的 Coach 翻译能力另做第二轮：模糊需求交给真实 Plan Coach，由它生成槽位 brief，再调用
当前 Scout。把模糊需求直接交给当前 Scout 只属于健壮性补测，不进入本轮主结论。

## 两个实验臂

两臂都使用当前提交中的 `study-material-scout.md`，只改变学习集是否带有 sidecar：

```text
同一冻结 brief
├── A · direct-fallback：学习集不含 graph/card-recall-index.tsv
│   └── 当前 Scout 走规范字段 grep + 前六行题面 fallback
└── B · sidecar：学习集含相同提交生成的 graph/card-recall-index.tsv
    └── 当前 Scout 走 TSV anchor grep + 行内交集
```

A 不是历史深读版 Scout，不能在报告中写成“旧 Scout”。它是当前契约的直接字段检索基线，
用于隔离 sidecar 数据布局的效果。历史 Coach/Scout 与当前完整路径的对照属于后续端到端实验。

## 固定变量

- 来源提交：`6a3a81899b61fc60d08ca50ccda66b38c51ab737`，运行时同时记录 dirty state。
- 学习集来源：`examples/derivative-m0/learning-set` 的两个只读临时副本。
- Agent：同一份 `apps/pi-teaching-web/resources/subagents/study-material-scout.md`。
- Pi CLI：`0.81.0`。
- Provider / model：`deepseek / deepseek-v4-flash`；不可用时停止，不替换模型。
- Thinking：`high`；每个 Session 必须从 JSONL 核对，若实际不是 high，该次无效。
- 工具：`read,grep,find,ls`；禁用扩展、Skills、上下文文件和 prompt templates。
- 每次运行都是 fresh Session；同一道题每臂运行两次，共 16 次。
- A/B 成对运行，单对并发，避免一臂系统性落在不同时间窗口；实验最大并发为 2。
- brief 不含目标路径、目标 ID、答案、命中统计或“库中一定存在”提示。
- 不设置 timeout、工具预算、候选数目标或预期答案。
- 精确查询没有授权放宽；空结果必须只描述当前切片。

## 四道主任务

下面的“隐藏目标”和统计只供实验管理员判分，永不进入 Scout prompt。

### T1 · 非齐次构造比较

给 Scout 的完整 brief：

```text
槽位：T1-非齐次构造短题
公开教学目的：训练学生从“导数与函数项同时出现”的关系中识别构造入口，利用题设特殊点锁定单调性，最后比较若干函数值。
材料种类与工作量：problem-card；一问、四选一，约 10–15 分钟。
应避免：多问综合题；只需直接代值计算的题。
学生事实：基本求导没有问题，但不容易识别相似代数结构。
建议检索词（只用于召回）：
- goal: 数值比较
- method: 局部逼近与找点
- structure: 非齐次结构
放宽顺序：无；只报告当前查询切片。
```

- 隐藏目标：`cards/derivative/mst_p0131_x2f_log_compare_ex19.card.yaml`
- 单项命中：118 / 142 / 120；三项联合：1；仅满足两项的干扰卡：72。
- 目的：检验三个宽字段的稀有交集，目标同时使用 secondary method。

### T2 · 充分性辨别

给 Scout 的完整 brief：

```text
槽位：T2-充分性辨别多选题
公开教学目的：让学生检查一个看似自然的构造是否真的足以推出全区间单调，再选择与题设同向的构造，并利用已有函数性质判断其余选项。
材料种类与工作量：problem-card；一问、四个选项，约 15 分钟。
应避免：长解答题；纯粹计算型比较。
学生事实：会求商函数导数，但容易把“导数的下界有时为负”误认为已经证明导数恒正。
建议检索词（只用于召回）：
- goal: 数值比较
- method: 充分/必要性探路
- structure: 指对复合结构
放宽顺序：无；只报告当前查询切片。
```

- 隐藏目标：`cards/derivative/mst_p0125_exponential_construct_ex06.card.yaml`
- 单项命中：118 / 109 / 366；三项联合：1；仅满足两项的干扰卡：164。
- 目的：检验干扰最密集的浅召回，不允许 Scout 用解题来排除候选。

### T3 · 存在参数分隔

给 Scout 的完整 brief：

```text
槽位：T3-存在性参数短题
公开教学目的：训练学生把“存在同一个常数，使两个因子恒异号”转换成两条函数能够被水平线分隔，再比较一边的最小值与另一边的最大值。
材料种类与工作量：problem-card；单问选择题，约 15 分钟。
应避免：多问综合题；依赖大规模分类讨论的题。
学生事实：会求常见指对函数的极值，但不习惯把量词条件翻译成图像与极值关系。
建议检索词（只用于召回）：
- goal: 求参数范围
- method: 拟合与夹逼
- structure: 同构结构
- text: 恒成立
放宽顺序：无；只报告当前查询切片。
```

- 隐藏目标：`cards/derivative/mst_p0179_product_gap_m_range_ex35.card.yaml`
- 单项命中：185 / 87 / 193；三项联合：1；仅满足两项的干扰卡：99。
- 目的：检验宽 goal/structure、较窄 method、题面 text 和单问工作量的联合筛选。

### T4 · 极值点偏移综合题

给 Scout 的完整 brief：

```text
槽位：T4-阶段末综合题
公开教学目的：训练学生先确定唯一极值点与唯一零点，再围绕极值点构造左右差函数，最终比较极值点和零点的位置。
材料种类与工作量：problem-card；无选项、三问左右，可用于 45–60 分钟综合训练。
应避免：单问短题；单纯求参数范围题。
学生事实：已经掌握导数判单调，但还需要把取点、隐藏零点和极值点偏移组织成完整证明。
建议检索词（只用于召回）：
- goal: 数值比较
- method: 显隐点探路
- structure: 极值点偏移结构
放宽顺序：无；只报告当前查询切片。
```

- 隐藏目标：`cards/derivative/mst_p0244_ln1px_minus_x_plus_halfx2_minus_kx3_extreme_zero_offset_ex21.card.yaml`
- 单项命中：118 / 100 / 24；三项联合：1；仅满足两项的干扰卡：19。
- 目的：检验 part-level goal、长题面截断和三问工作量；目标的 primary goal 不是数值比较。

## 判分

结果质量优先于速度。

每次运行分别记录：

1. **结构守约**：无全目录枚举、无 `graph/VOCABULARY.md`、无答案/rubric/solution、无正式
   题卡深读、输出为无围栏 JSON、`inspected <= matched`、空结果不声称穷尽全库。
2. **精确命中**：返回隐藏目标路径。
3. **可用替代**：若不是隐藏目标，完整读取正式卡后，仍满足公开教学目的、材料工作量和排除
   条件，并且数学与路线核验通过。可用替代不会被机械判错。
4. **错误召回**：候选不满足 query、工作量或公开排除项。
5. **假空结果**：没有候选，但隐藏目标确实满足当前切片。
6. **负担**：墙钟时间、input/output/reasoning tokens、工具总数与分布、正式卡读取数。
7. **稳定性**：同臂两次是否给出同等级结果；不要求路径完全一致，只要求可用性一致。

主结论只允许是描述性的，不从 16 次小样本声称统计显著性。B 只有在可用候选率不低于 A、
没有新增边界违规，并且负担整体下降时，才能称为“速度改善且未观察到效果打折”。如果质量
下降，即使更快也判失败；如果质量相同但负担没有下降，则判 sidecar 无可见收益。

## 第二轮与补测

第一轮完成后再决定是否支付模型调用运行：

- **真实产品路径**：四份模糊教学需求分别交给 fresh Plan Coach，让 Coach 自己形成 brief，
  再调用当前 Scout；评价最终材料，而不是要求 Coach 复述本设计的规范词。
- **无规范词健壮性**：模糊需求直接交给当前 Scout；单独标注为 fallback，不进入 sidecar A/B。
- **符号边界题**：`y=|\ln x|` 垂直切线卡，用 `text: [绝对值, |]` 检验符号 OR 与 secondary
  method/structure；不混入四道主任务汇总。

## 证据与安全

- 原始 stdout、Session JSONL、CoT 和临时学习集只保存在 `/tmp` 专用目录。
- Git 报告只写脱敏聚合指标、候选相对路径、命令版本和失败分类。
- 不提交 `auth.json`、模型密钥、完整 CoT、完整答案、Session 文件或临时学习集。
- 验收期间不修改 Scout、sidecar 或题卡；发现问题只记录，结束后另开修复轮次。

## 首对 smoke 后的协议修订

首对命令按原设计显式传入 `--thinking medium`，但 A、B 两份 Session 都记录为
`thinkingLevel: high`。本地 Pi 0.81.0 模型目录显示：

```json
{
  "minimal": null,
  "low": null,
  "medium": null,
  "high": "high",
  "max": "max"
}
```

Pi 的 `clampThinkingLevel()` 会从请求档位向上选择第一个受支持档位，所以 medium 对
`deepseek-v4-flash` 确定性地夹为 high。这不是一臂独有的配置漂移，也不是结果出现后选择
更有利的档位。修订只把冻结条件改成模型真实支持的 high；模型、Agent、brief、题目、判分
与两臂数据均不改变。首对实际已经在 high 下对称运行，因此保留为 `T1-*-r1`；余下调用显式
使用 `--thinking high`。Agent frontmatter 的 `thinking: medium` 对该模型不生效，作为独立
产品事实写入最终报告，本轮不修改它。
