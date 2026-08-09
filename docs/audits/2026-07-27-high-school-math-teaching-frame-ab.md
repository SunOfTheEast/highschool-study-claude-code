# 高中数学教学 Frame 真实模型 A/B 验收

## Run Identity

- 日期：2026-07-27
- A（基线）：`fa540ed32455c4e528980ff2161113b1adbca9ba`
- B（候选）：`d09d1d5d5cc835e3f36e09bd9d1b23d7e25888f3`
- Provider / model / thinking：`deepseek / deepseek-v4-pro / high`
- A、B 代码 worktree 在开课前后均无修改；真实课程只写入隔离副本。
- 隔离证据根目录：`/tmp/studyforge-math-frame-ab-GQj4fT`
- 匿名包：
  - `pair1-blind.md`
  - `pair2-blind.md`
  - `blind-evaluation-result-randomized.md`
  - `blind-mapping.json`

| 运行 | Coach Session | Tutor Session | Lesson |
| --- | --- | --- | --- |
| A1 | `019fa3c5-418e-7af6-b922-d62314724d0a` | `019fa3c8-e77d-7873-b6ab-0b0a4b029a46` | `lesson-structure-diag-01` |
| B1 | `019fa3c5-67de-7c50-95b7-c273df060194` | `019fa3cb-6197-7b0b-819c-f861248262ef` | `lesson-001` |
| A2 | `019fa3c5-67d7-7e95-a3d5-3bd96ecbe8d2` | `019fa3cb-619d-7e83-adf3-1669b2fab733` | `lesson-001` |
| B2 | `019fa3c5-67de-7286-a09d-9c6801e3fa52` | `019fa3c8-e77e-7fc9-adf3-05429ba28004` | `lesson-001` |

## Controls

- 四个运行使用独立 learning-set、Pi 配置和 Session 目录。
- 题卡、图谱、材料、人格、深度模式、Provider、model 和 thinking level 一致；A 使用实施前资源，B 使用四层教学 Frame 与 `LEARNING_GUIDE.md`。
- 空白 Roadmap 当前没有可进入的 Coach，因此四组都预置了同一份中性
  `structure-recognition` Plan。此后备课、开课、互动与关课均从学生界面完成。
- 配对内首轮请求完全相同；学生由同一验收者模拟，只依据当时可见内容作答。
- 运行时统一使用 `raw-stream` 便于观察；盲评包从原始 Pi JSONL 按生产默认
  `safe` 规则重投影，删除含工具调用的 assistant turn、工具结果、隐藏推理和私有配置。
- 匿名包使用密码学随机顺序生成；独立评审完成逐项表格后才读取映射。本次随机结果
  为两组 `X = B`、`Y = A`。
- 验收期间未修改 Prompt、产品代码或学习资产。

## Paired Teaching Evidence

### 配对一：抑制“见参数即分类”

| 运行 | 课堂任务 | 可观察结果 |
| --- | --- | --- |
| A1 | 同一真题的极值热身、含参证明与反思 | 学生独立从参数下界和正系数压到边界，并形成“先看系数符号与上下界”的规则；没有新题迁移。 |
| B1 | 一道参变量分离诊断题与结构反思 | 学生独立由参数位置和系数符号选择分离，形成四项自查清单；没有新题迁移。 |

- B1 的课堂序列更短、更聚焦；诊断题与认知目标直接相连。
- 两边都没有执行学生明确要求的“最后独立判断一次”。口头规则不是新的独立表现，
  因此迁移证据都记为不足。
- B1 课前商议直接给出了题目以及“先换元、再参变量分离”的最优路线；A1 也提前给出
  了“下界型、同构拆分”的方法方向。课前剧透是共同未解决的问题，B 未证明改善。

### 配对二：区分结构识别与机械计算

| 运行 | 主任务 → 迁移任务 | 可观察结果 |
| --- | --- | --- |
| A2 | `mst_p0016_ex01` → `mst_p0020_ex12` | 学生先完成非参考路线；Tutor 一度把同题当成后续正式练习，经学生指出后跳过重复；随后独立完成幂指外壳迁移。 |
| B2 | `mst_p0016_ex01` → `mst_p0016_ex02` | 主任务、复盘、不同外壳迁移连续推进；学生独立把方程外壳统一为 `te^t` 并完成求解。 |

- B2 避免了 A2 的同题重复，课堂更短，且及时形成“统一变量与函数形状”的判断规则。
- 两边都取得真实的新题迁移证据；A2 的迁移数学跨度更大，B2 的迁移更紧凑自然。
- B2 的持久化 Lesson Summary 写成“**三个** Block 全部完成”，随后却列出
  `intro → main-task → reflect → transfer-task` 四个 Block。这是候选侧的轻微事实计数错误，
  不影响 Trace 和关课状态，但阻止本轮宣称无事实回归。

## Blinded Quality Comparison

随机解盲后，两组匿名课堂的 `X` 都是 B。

| 维度 | 配对一 B / A | 判定 | 配对二 B / A | 判定 |
| --- | ---: | --- | ---: | --- |
| Target | 5 / 5 | 相当 | 5 / 5 | 相当 |
| Task sequence | 5 / 4 | B 更好 | 5 / 4 | B 更好 |
| Student thinking | 5 / 5 | 相当 | 5 / 5 | 相当 |
| Intervention | 5 / 5 | 相当 | 5 / 5 | 相当 |
| Transfer evidence | 2 / 2 | 相当且不足 | 5 / 5 | 相当 |
| Classroom quality | 4 / 4 | 相当 | 5 / 3 | B 更好 |

可定位证据：

- 配对一 B 课堂回合 1–6 形成“诊断作答 → 确认决定性步骤 → 学生生成自查规则”，
  比 A 的计算热身更聚焦。
- 配对一两边都没有第二道题，不能从反思文字推定迁移。
- 配对二 A 课堂回合 3–4 出现学生指出同题重复；B 没有这一停顿。
- 配对二两边都在新外壳中先写判断依据再独立计算，迁移证据均成立。

预先约定的“明显改善”要求 B 在**两组**中都至少改善四项，并且没有事实回归。
B 分别只改善一项和两项，因此没有达到门槛。

## Runtime Invariants

- 四节 Lesson 最终均为 `closed`；每次关课都由学生明确选择结束。
- Coach 与 Tutor 使用不同 Session，Lesson frontmatter 绑定的 Tutor Session 与运行记录一致。
- 所有 problem Trace 都绑定真实题卡和真实 Block；四组分别形成 3、1、2、2 条 active
  学习证据，方法确认使用 supersede 收束初始未映射 Trace。
- 所有作答均为 `support: none`；未把 Tutor 后续补充计入学生独立证据。
- Planner Attention 只引用 active Trace；同一题卡同一 attempt 未被 superseded 行重复计数。
- `safe` 匿名包不含 Teacher Control、工具参数、隐藏答案、私有推理或凭据。
- 学生可见数学结论均正确；除 B2 的 Block 数量文案外，未发现事实状态错误。
- 原仓库 `examples/derivative-demo/learning-set` 未被真实课程写入。

## Result

`INCONCLUSIVE`

B 在两组中都改善了任务编排的聚焦度，并在配对二明显改善课堂节奏；这说明四层
Frame 的方向有价值。但改善面没有达到预设阈值，配对一仍无新题迁移，课前方法剧透仍然
存在，而且候选 Summary 有一处轻微计数错误。本轮不能称为“教学质量明显改善”，也没有
证据表明整体发生系统性退步。

## Remaining Uncertainty

- 模拟学生能力较强，四道主任务都能独立完成，因而没有真实触发“有限提示后再独立验证”；
  Intervention 维度主要验证了“不打断”，没有充分验证“学生卡住时怎么教”。
- `raw-stream` 便于验收者观察运行，但不是生产默认视图；盲评使用 `safe` 重投影，
  真实学生作答仍可能受到验收时可见的工具旁白影响。
- 只有两组短课，模型采样波动尚不能排除。
- 两组使用不同但等价目标的真实题卡，能够比较教学行为，不能比较题目本身难度。

## Next Action

1. 只改两个已重复出现的教学行为，不扩张共享内核：
   - Coach 的无剧透摘要只说任务功能，不提前给出最优方法；
   - 能力标准或学生请求包含迁移时，Lesson 必须留出一项不同外壳的独立任务。
2. 用一名会在关键步骤真实卡住的中等水平模拟学生再跑两组配对课，专门观察提示时机、
   提示剂量和提示后的独立结束证据。
3. 修正 B2 这类 Summary 数量自相矛盾后，再按同一四项门槛复验；在新证据出现前，
   不继续往通用 Prompt 追加枚举。
