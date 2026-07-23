# Problem Block 与 Trace 题卡绑定设计

日期：2026-07-23

## 一、结论

StudyForge 正式采用以下课堂语义：

> 每一次题卡作答都是一个独立 `problem` Block；每个 `problem` Block
> 必须且只能通过 `Uses` 绑定一张真实题卡。

Block 可以很多。多题训练拆成多个 problem Block；两题比较先分别完成两个
problem Block，再使用 dialogue 或 reflection Block 比较。无题卡讲解、追问和
讨论使用 dialogue，视频或讲义使用 material。

## 二、问题与根因

当前 Lesson 已经保存：

```text
Block ID -> Uses alias -> Aliases cardPath
```

但 Pi `trace_append` 又让 Tutor 模型重复填写可选 `cardAlias`。模型省略后，Pi 将
`undefined` 转成 `null`，底层因为需要支持视频、讨论等无卡 Trace 而合法写入
`Card: (none)`。

当前底层还只验证 Block 和 alias 分别存在，没有验证 alias 是否属于指定 Block。
所以仅把 `cardAlias` 改成必填仍不能阻止“Block A 绑定 Block B 的合法题卡”。

## 三、事实所有权

| 事实 | Durable owner | 写入者 |
| --- | --- | --- |
| 题干、参考方法、步骤和图谱 metadata | Card YAML | 题卡生产流程 |
| Lesson 局部 alias 到真实题卡路径的映射 | Lesson `Aliases` | Coach 决策，`lesson_prepare` 编译 |
| 某个课堂节点计划使用哪张题卡 | Block `Uses` | Coach 决策，`lesson_prepare` 编译 |
| 学生某次实际作答绑定的题卡 | Trace `cardPath` | Pi 运行时从 Block 绑定并冻结 |
| 正确性、帮助依赖、实际路线和方法确认 | Trace judgment fields | Tutor 判断与学生确认 |
| Planner Attention、能力节点和题卡历史 | Projection | 从 active Trace 重建 |

Lesson 的 `Uses` 是课堂设计，Trace 的 `cardPath` 是已经发生的课堂事实。运行时只在
写入时从前者取得绑定；写入后必须持久化真实 `cardPath`，不能在读取时根据当前
Lesson 临时推导。

## 四、Lesson 约束

### 4.1 Problem Block

`kind: problem` 时：

- `uses.length` 必须等于 `1`；
- 该 alias 必须存在于当前 Lesson 的 `Aliases`；
- alias 必须解析到真实 `highschool-study.problem-card.v1` 文件。

以下结构都无效：

```text
Kind: problem
Uses:
```

```text
Kind: problem
Uses: Q-01, Q-02
```

### 4.2 其他 Block

- dialogue、material、reflection 不承担题卡作答证据；
- 它们可以没有题卡，生成的 Trace 可以保持 `cardPath: null`；
- 两题比较使用已完成 problem Block 的 Trace 作为来源，不把两张题塞进同一个
  problem Block。

### 4.3 同一题卡的再次使用

- 同一课堂语义下重做，使用 route `repeat` 重复原 Block；
- 教学目的、支持条件或验收角色不同，创建另一个 problem Block，可以再次使用同一
  alias；
- 聚合继续使用 `lessonPath + blockId + cardPath`，不会把同卡多个步骤伪装成不同
  题卡。

## 五、Pi Trace 写入

Pi Tutor 的 `trace_append` 不再接受 `cardAlias`。模型继续填写：

```text
blockId
methodStatus / methodRoute / confirmed method fields
assessment
support
note
supersedes
optional materialPath
```

运行时执行：

```text
current Session ownerPath
  -> read exact Lesson
  -> find exact blockId
  -> if kind == problem, require exactly one Uses alias
  -> pass that alias to the existing core appendTrace
  -> core resolves and freezes cardPath in the Trace
```

保留 `blockId`，因为学生可能在 reflection 中更正前一个 problem Block；此时
`supersedes` 和原 Block 身份仍有意义。题卡选择不再由模型重复填写。

任何 problem Block 基数错误都属于 `LESSON_*` 结构错误：不写 Trace，不重试猜测，
返回 Coach 修正 Lesson。

## 六、公共 Claude Code MCP

公共 MCP 没有 Pi 的 Session-bound Lesson 运行时，因此本次不删除它的
`lessonPath`、`blockId` 或 nullable `cardAlias` 参数，也不改变四工具表面。

本次实现只缩小 Pi Tutor 的模型合同。公共 MCP 的进一步 Block/alias 交叉校验可以
单独设计，不能为了 Pi 修复而破坏现有无卡材料 Trace。

## 七、下游行为

成功写入 problem Trace 后：

- `card_search` 返回该卡完整 active `traceHistory`；
- `trace_search` 返回 Trace，并在 `cardsByPath` 中反解唯一题卡；
- Evidence View 的 `card` 不为空；
- `card_alternative_append` 可以通过正确 active Trace 找到题卡；
- 方法已经由学生确认时，Planner Attention 和能力图才聚合该 attempt。

题卡绑定与方法绑定是两条独立轴。修复题卡绑定不会把
`methodStatus: unmapped` 自动升级成方法证据。

## 八、验证

自动化验证必须覆盖：

1. Blueprint 拒绝零卡和多卡 problem Block；
2. 首次准入同样拒绝手写的零卡和多卡 problem Block；
3. Pi `trace_append` 的公开参数中不再包含 `cardAlias`；
4. Tutor 只传 `blockId` 时，Trace 自动写入该 Block 的真实 cardPath；
5. Block A 不可能绑定 Block B 的题卡；
6. dialogue/material/reflection 的无卡 Trace 仍然可用；
7. 写入后，题卡搜索、Trace 反查和 Evidence View 三条读取链均恢复；
8. 现有 Pi 单元测试、类型检查和生产构建通过；
9. 使用复制的导数学习集完成一节短课，确认真实模型无需填写 `cardAlias`。

不为 Skill 措辞编写字符串测试。

## 九、非目标

- 不修改 Card、Trace 或知识图谱的持久化 schema；
- 不增加数据库、索引服务、规则引擎或新 Agent；
- 不从最近一次 `source_resolve` 推断题卡；
- 不在读取时补猜历史 cardPath；
- 不自动迁移或静默改写既有 cardless Trace；
- 不把未确认的方法映射进能力图。
