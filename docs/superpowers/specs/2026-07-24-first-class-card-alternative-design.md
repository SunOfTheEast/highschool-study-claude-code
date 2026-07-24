# 题卡另解独立事实与方法投影修订设计

状态：已实施；自动回归通过

日期：2026-07-24

## 一、结论

题卡另解应当成为题卡旁挂文件中的独立事实，而不是来源 Trace 的一个派生视图。

每条另解只保存：

- 运行时生成的题卡内 ID；
- 对应题问；
- 完整解法；
- 一个经过学生确认的规范方法节点，或保持未归类；
- 完成这条路线时的支持程度；
- 用于追溯课堂原始记录的来源 Trace。

它不再继承来源 Trace 的方法绑定，也不因来源 Trace 后续被 supersede 而自动消失。只要另解绑定了真实方法节点，就可以直接参与现有方法能力投影；同一题卡仍只算一张题，不能借多条另解伪造跨题稳定性。

本设计不增加 `AlternativeEvidence`、统一解法注册表、裁判 Agent、自动分类器或新的长期状态层。

## 二、要解决的问题

现有实现把另解的方法直接复制自来源 Trace：

```text
CardAlternative.primaryMethod = sourceTrace.methods.primary
CardAlternative.secondaryMethods = sourceTrace.methods.secondary
```

这在“学生先完成第一种解法，随后又提出第二种解法”时不成立。来源 Trace 只能证明当次课堂作答使用了什么方法，不能证明后来整理出的另解属于同一个方法节点。

因此会出现两个错误：

1. Tutor 使用了真实存在的方法名，但把第二种路线硬套到了第一种路线的节点上；
2. Tutor 口头承认“这是另解”，却没有一个契约要求它单独确认并持久化另解自己的方法归属。

现有另解还有两个结构性问题：

- `来源 Trace + 题问` 被当作身份，相同来源和题问的第二条另解会覆盖第一条；
- 普通读取只返回 active Trace 支持的另解，来源 Trace 一旦被 supersede，已经验证过的另解也随之消失。

根因不是能力投影公式，而是另解没有独立身份、独立方法和独立生命周期。

## 三、事实边界

### 3.1 题卡

题卡 YAML 中的主方法、次方法和参考解仍表示作者预设的参考结构。它们可以帮助检索、备课和比较，但不能证明学生实际使用了这些方法。

### 3.2 Trace

Trace 仍表示一次课堂观察：

- 学生当次作答是否正确；
- 获得了什么支持；
- 当次实际使用了什么方法；
- 发生在哪个 Lesson、Block 和题卡上。

Trace 的方法只属于那次作答，不自动传播给题卡另解。

### 3.3 CardAlternative

CardAlternative 表示已经验证过的一条完整替代路线。它属于题卡，来源 Trace 只负责把它上溯到课堂原始记录。

CardAlternative 自己拥有：

```ts
type CardAlternative = {
  id: string;
  cardPath: string;
  question: string;
  solution: string;
  method: string | null;
  support: 'none' | 'tutor' | 'external';
  sourceTrace: string;
};
```

其中：

- `id` 由运行时按题卡生成，例如 `alt-001`；
- `cardPath` 由来源 Trace 绑定，模型不填写；
- `question` 指向“整题”或题卡中真实存在的某一问；
- `solution` 是该题问的完整替代推导；
- `method` 只能是学生确认贴切的规范节点；没有精确节点时为 `null`；
- `support` 表示形成这条替代路线时是否依赖 Tutor 或外部帮助；
- `sourceTrace` 只用于追溯，不控制另解是否有效。

运行时可以继续写入时间戳作为被动元数据，但时间戳不参与身份、真实性、方法归属或能力投影。

## 四、最小工作流

```text
学生给出一条不同路线
  → Tutor 验证至少一整问的核心推理链确实不同且完整正确
  → Tutor 从规范图谱中提出至多一个最贴切的方法节点
  → Tutor 用自然语言询问学生：这个节点是否贴切
      ├─ 学生确认：method = 规范节点
      └─ 学生否定、无法判断或没有精确节点：method = null
  → card_alternative_append 写入独立另解
  → 题卡检索和 Trace 反查都返回该另解
  → method 非空时进入现有方法能力投影
```

“是否是另解”和“应该绑定哪个方法”是两个判断：

- 先确认路线是否构成真正另解；
- 再询问方法节点是否贴切；
- 找不到贴切节点不会阻止另解落盘，只会阻止它产生方法能力信号。

## 五、什么仍然算作另解

沿用已经确认的题问级边界：只有某一整问的入口、决定性推理和收束链条都形成一条完整且不同的核心路线，才算另解。

以下情况不算另解：

- 只更换记号；
- 只拆分或合并等价步骤；
- 只调整等价步骤顺序；
- 只加入一个局部计算技巧；
- 只给同一路线换一个方法名称。

方法节点不同不是另解的充分条件；方法节点相同也不必然否定另解。最终判断对象始终是该题问的完整推理链。

## 六、方法绑定

### 6.1 学生确认

Tutor 可以根据图谱 vocabulary、aliases 和 metadata 提出候选，但不能直接替学生决定。

询问应当贴近学生刚才的路线，例如：

> 你这条路线的关键是先把参数固定，再研究表达式随变量的变化。把它归到“含参数分类讨论”贴切吗？如果不贴切，也可以先不归类。

学生确认后才持久化规范节点。学生否定、认为只是相近、暂时不想判断，或者图谱中没有精确节点时，持久化 `method: null`。

不要求学生自己输入图谱中的精确字符串。学生用自然语言改选时，Tutor 可以重新读取图谱并提出新的规范候选，再取得确认。

### 6.2 运行时校验

运行时只做真实性 fence：

- `method !== null` 时，必须是当前学习集图谱中的规范方法节点；
- 唯一 alias 可以在工具边界规范化为真实节点；
- 无法解析时拒绝该方法绑定，不猜测最近节点；
- 方法校验失败不应让 Tutor 捏造节点；Tutor 应改为征询学生后以 `method: null` 重试。

运行时不判断路线语义，不计算相似度，也不替学生确认贴切性。

### 6.3 单一方法节点

本版每条另解只保存一个代表其决定性路线的规范方法节点，不增加主方法、次方法数组。

题卡原有主次方法结构继续存在；Trace 也可继续记录当次作答的主次方法。CardAlternative 的单一 `method` 是另解自己的最小归属，不试图复制另外两套结构。

## 七、写入工具

Pi Tutor 继续使用一个 session-bound 工具：

```ts
card_alternative_append({
  sourceTraceId: string;
  question: string;
  solution: string;
  method: string | null;
  support: 'none' | 'tutor' | 'external';
})
```

工具边界负责：

1. 在当前 Lesson 中找到真实的来源 Trace；
2. 确认来源 Trace 在创建时是 active、`correct` 且绑定真实题卡；
3. 校验题问真实存在；
4. 校验并规范化非空方法节点；
5. 从来源 Trace 取得 `cardPath` 和来源锚点；
6. 生成该题卡下一个 `alt-NNN`；
7. 追加一个新章节，不按来源 Trace 和题问覆盖旧章节。

模型不能填写：

- 另解 ID；
- 题卡路径；
- Lesson 路径；
- 图谱路径；
- 来源锚点；
- 时间戳。

`card_alternative_append` 每次成功调用都创建一条新另解。它不承担模糊去重；Tutor 在调用前通过题卡读取看到已有另解，并判断新路线是否确实不同。

## 八、Markdown 持久化

每张题卡继续使用同目录、同 basename 的旁挂文件：

```text
cards/derivative/example.card.yaml
cards/derivative/example.card.alternatives.md
```

建议格式：

```markdown
# 题卡另解

<!-- studyforge-alternative id="alt-001" question="整题" -->
## alt-001 · 整题

- 来源 Trace: lessons/lesson-003.md#trace-event-006
- 支持: none
- 方法: 含参数分类讨论

### 解法

完整替代推导……
```

没有精确方法节点时：

```markdown
- 方法: 未归类
```

题卡路径由旁挂文件位置天然确定，因此不重复写入正文。解析器以 `id` 作为章节身份，不再以 `sourceTrace + question` 作为身份。

仓库中没有需要保留的正式旧版旁挂数据，因此不增加旧 marker、旧主次方法字段或旧覆盖语义的兼容层。临时验收数据可以按新格式重新生成。

## 九、生命周期与更正

CardAlternative 一旦写入，就不再依赖来源 Trace 的 active 状态：

- 来源 Trace 被 supersede，另解仍然出现在题卡读取结果中；
- 来源 Trace 仍可用于打开原始 Lesson 和课堂记录；
- 能力投影仍可用来源 Trace 找到原始 attempt；
- 只有对该另解本身的明确更正或删除才改变它。

本版不新增另解状态机，也不新增删除工具。学习集以 Markdown 为事实源，明确更正或删除就是按 `cardPath + id` 直接编辑或删除对应 Markdown 章节。

这条边界是刻意的：Trace 更正的是一次课堂观察，不能顺带撤销一条已经独立验证过的数学解法。

## 十、能力投影

### 10.1 保留现有聚合

现有 attempt 聚合键不变：

```text
lessonPath + blockId + cardPath
```

现有规则也不变：

- 正确性系数沿用当前定义；
- `support` 系数沿用当前定义；
- 同一方法在一次 attempt 中最多贡献一次；
- `steady` 至少需要两个不同 `cardPath`；
- 投影仍只是 Planner Attention 的备课信号，不是自动 mastery 判决。

### 10.2 另解如何进入投影

当 CardAlternative 的 `method !== null` 时：

1. 通过 `sourceTrace` 找到原始 Lesson、Block 和题卡；
2. 把该方法合并进对应 attempt 的方法集合；
3. 另解已经通过正确性验证，因此正确性按 `correct` 处理；
4. 使用 CardAlternative 自己的 `support` 系数；
5. 该方法按决定性路线的主方法权重计算；
6. 来源引用仍指向原始 Trace，同时题卡读取可以展示对应 `alt-NNN`。

聚合仍然只是一张 `attempt → method` 表，不增加新的证据对象。先按现有逻辑算出 Trace 在该 attempt 的系数；每条另解则得到
`1 × supportFactor`。同一方法出现多个候选贡献时，只保留系数最高的一条，角色按主方法处理。这样可以承认学生在同一题中独立完成了更强的路线，又不会让同一方法因为另解条数而重复加分或被平均稀释。没有另解的 attempt 完全保持当前计算结果。

如果同一个 attempt 中：

- Trace 与另解绑定同一方法，只算一次；
- 多条另解绑定同一方法，只算一次；
- 多条另解绑定不同方法，每个方法可以各得一次证据；
- 所有证据的 `distinctCardCount` 仍只增加同一个 `cardPath`。

因此，一张题卡可以证明学生在这张题上掌握了多条真实路线，但不能因为存了多条另解就满足跨题稳定性。

### 10.3 未归类另解

`method: null` 的另解：

- 正常写入；
- 正常被题卡检索和 Trace 反查返回；
- 可以供 Coach 备课和 Tutor 比较路线；
- 不进入方法能力投影。

## 十一、读取与召回

现有双向召回边界保持不变：

- `card_search` 读取题卡时附带该题卡的全部 CardAlternative；
- `trace_search.cardsByPath` 从 Trace 反查题卡时附带同一批 CardAlternative。

读取器不再按 active Trace 过滤另解。每条另解都返回自己的：

```text
id + question + solution + method + support + sourceTrace
```

另解仍属于 Coach/Tutor 私有材料。是否向学生显示继续遵守现有 Student View 和 reveal policy：

- 首次作答前不泄漏另解；
- 学生提出路线后可以进行比较或评价；
- 学生明确索要完整解答后才展示完整推导。

## 十二、最小失败处理

- 来源 Trace 不存在、不 active、不是 `correct` 或未绑定题卡：拒绝创建；
- 题问不存在：拒绝创建；
- 解法为空：拒绝创建；
- 非空方法无法解析为真实节点：拒绝该次调用，Tutor 改为询问学生或以 `null` 重试；
- 找不到精确节点：允许写入未归类另解；
- 来源 Trace 后续被 supersede：不自动隐藏、不自动删除、不自动改方法；
- 重复调用：生成新的 `alt-NNN`，不覆盖现有章节。

不增加自动修复、置信度阈值、审核队列、字符串相似度去重或后台重建任务。

## 十三、Prompt 与 Skill 约束

`tutor-lesson` 只需补充一条短闭环：

1. 先判断是否真的是另解；
2. 再提出一个最贴切的规范方法候选；
3. 询问学生这个绑定是否贴切；
4. 确认则传该节点，不确认则传 `null`；
5. 调用成功后才说已经保存。

Skill 不要求固定问句，也不要求学生掌握图谱术语。自然对话优先，核心约束只有“不能替学生确认”和“口头承认后要落盘”。

按照仓库约定，不为这几句 Skill 文本编写字符串断言测试。可执行契约、持久化和投影行为必须测试。

## 十四、受影响的实现面

实施时只需要修改以下现有链路：

1. `server/src/alternatives.ts`
   - 独立 ID、单一方法、支持程度、追加语义和不按 active Trace 过滤；
2. Pi `card-alternative-append`
   - 新增 `method` 与 `support` 参数，保持路径和 ID 由 session/runtime 绑定；
3. `server/src/method-signals.ts`
   - 将有方法绑定的另解合并进现有 attempt；
4. `card_search` 与 `trace_search`
   - 返回新的 CardAlternative 结构；
5. `tutor-lesson/SKILL.md`
   - 增加学生确认节点与成功后落盘的短闭环；
6. 架构与功能文档
   - 把“另解随 active Trace 失效”改为“来源仅作追溯”。

不新增公共 MCP 工具，不改变四个公共插件工具，不新增 Agent，不改变 Roadmap、Plan、Lesson 或 Trace schema。

## 十五、验收标准

### 15.1 独立事实

1. 来源 Trace 的方法为 A，另解经学生确认的方法为 B，最终旁挂文件和读取结果只把该另解绑定到 B。
2. 学生否定候选节点时，另解以 `method: null` 正常保存。
3. 同一来源 Trace、同一题问连续保存两条真实另解，得到不同 ID，前一条不被覆盖。
4. 来源 Trace 被 supersede 后，两条另解仍可读取。

### 15.2 方法真实性

1. 非空方法必须解析为当前图谱中的真实节点。
2. 题卡声明方法和来源 Trace 方法都不能自动填入另解。
3. 未归类另解不产生任何方法能力信号。

### 15.3 能力投影

1. 绑定方法 B 的正确、无提示另解为 B 增加一次方法证据。
2. 同一个 attempt 的 Trace 和另解都绑定 B 时，B 仍只增加一次。
3. 同一张题的两条另解绑定 B 时，B 仍只增加一次 attempt、一个 distinct card，并采用其中最高的有效系数。
4. 两张不同题卡分别提供 B 的独立证据时，distinct card 才达到 2。
5. `tutor` 与 `external` 支持继续使用现有较低系数，不发明另解专用权重。

### 15.4 双向召回

1. 题卡搜索返回全部另解及各自来源 Trace。
2. Trace 反查题卡返回同一批另解。
3. 读取器不因来源 Trace inactive 而隐藏另解。

## 十六、与旧设计的关系

本设计只修订
`2026-07-22-multiple-solution-method-evidence-design.md`
中 CardAlternative 的身份、方法来源、生命周期和能力投影部分。

旧设计中以下结论继续有效：

- Trace 记录学生当次实际方法；
- 题卡方法只是参考结构；
- 只有完整且不同的题问级路线才算另解；
- 学生确认方法归属；
- attempt 按 `lessonPath + blockId + cardPath` 聚合；
- `steady` 要求不同题卡；
- 题卡与 Trace 支持双向召回；
- Student View 继续防止另解提前泄漏。

以下旧结论被本设计替换：

- 另解不再复制 Trace 的主次方法；
- `sourceTrace + question` 不再作为另解身份；
- 同来源、同题问重试不再覆盖旧另解；
- 另解不再随来源 Trace supersede 自动失效；
- 能力投影除 active Trace 方法外，也读取有明确方法绑定的独立另解。

最终结构只有三类事实：题卡参考结构、课堂 Trace、题卡独立另解。三者通过路径和来源锚点互相追溯，但不再互相冒充。
