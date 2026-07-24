# 一题多解的实际方法证据与题卡另解设计

> CardAlternative 的身份、方法来源、生命周期和能力投影已由
> `2026-07-24-first-class-card-alternative-design.md` 修订；Trace 实际方法与题问级另解判断部分仍有效。

状态：已实施；自动回归通过；真实模型闭环验收未整体通过，剩余 P0 见验收报告

日期：2026-07-22

## 一、问题

当前题卡的 `graph.method.primary` 与 `graph.method.secondary` 描述的是题卡预设的参考解法，不是学生在某次课堂尝试中实际使用的方法。现有能力投影却从 Trace 找到题卡后，直接把该次尝试归因到题卡声明的所有方法。

这会在一题多解时制造错误证据。例如题卡预设“同构变形与换元法”，学生实际使用“参变量分离”并完整做对：

- 如果 Tutor 写 `correct`，当前投影会给学生没有使用的“同构变形与换元法”加分；
- 如果 Tutor 为避免错误归因而写 `incomplete`，又会歪曲解答本身正确这一事实；
- 学生给出的有效另解只留在课堂对话或自由文本中，无法成为以后读取题卡时可复用、可追溯的教学内容。

根因是三个不同事实被混在了一起：

1. 这次解答是否正确；
2. 学生这次实际使用了什么方法；
3. 题卡原先提供了什么参考方法与参考解。

本设计把三者重新分开，并让正确的替代路线沉淀为题卡旁挂的生成另解。

## 二、目标与非目标

### 目标

- `assessment` 只表示本次解答的正确性与完整性，不再承担方法归因。
- Trace 只保存经过学生确认的本次实际主方法和次方法；未确认路线保持未映射。
- Tutor 读取知识图谱的规范节点、aliases 与 metadata boundary，提出教学语义候选；学生确认它是否贴合自己的实际路线。
- 运行时只做 alias 解析、规范节点真实性校验和来源绑定，不建立复杂规则引擎。
- 能力投影只给本次实际使用的方法生成证据，并保留现有 attempt 聚合及主次方法权重。
- 至少有一问采用完全不同、完整且正确的核心推理链时，才可写入题卡旁挂的 `*.alternatives.md`，并索引回来源 Trace。
- 题卡读取同时返回原始题卡、active Trace 与 active Trace 支持的生成另解。
- Trace 被 supersede 后，能力投影与生成另解的可见性立即随 active Trace 刷新。

### 非目标

- 不新增裁判 Agent、人工审核门或独立的另解审批流程。
- 不通过模糊分数、关键词规则或自动分类器替代 Tutor 的语义判断。
- 找不到合适节点时不自动创建或扩充全局知识图谱。
- 不修改题卡原有的主方法、次方法和参考解。
- 不把方法投影升级为自动 mastery 判决；它仍然只是 Planner Attention 的备课信号。
- 不重新标注历史 Trace。没有实际方法绑定的旧 Trace 不再通过题卡预设方法获得推测性方法证据。
- 不改变现有 attempt 聚合键、正确性系数、支持系数或 `steady` 的跨题卡要求。

## 三、核心事实边界

### 3.1 题卡拥有参考方法

题卡现有的 `graph.method.primary` 与 `graph.method.secondary` 继续描述作者预设的参考路线。它们可用于检索、备课和介绍题卡，但不能证明学生实际使用了这些方法。

### 3.2 Trace 拥有实际方法

Trace 是本次课堂尝试的事实来源。它分别记录：

- `assessment`：解答是否正确、部分正确、错误或未完成；
- `support`：本次表现是否获得 Tutor 或外部支持；
- `methods`：学生本次实际使用的主方法与次方法；
- `note`：学生工作、Tutor 反馈和判断依据。

方法绑定是可选事实，而且学生是“这是不是我实际采用的方法”的最终确认者。首次 Trace 先保存正确性、支持情况和完整路线，不因 Tutor 找到一个相近合法节点就写入方法。Tutor 随后说明候选节点对应学生哪一个决定性步骤；学生确认后才用 superseding Trace 写入方法。学生否定、暂缓或认为词表没有精确节点时，active Trace 保持 `methods: null`，不产生方法能力证据。错误路线只有在学生已经明确识别或确认规范节点时才可带方法证据，不能由 Tutor 单方面归类。

### 3.3 题卡旁挂文件拥有生成另解

生成另解不写回题卡 YAML，也不混入原始参考解。每张题卡可以拥有一个同目录、同 basename 的旁挂 Markdown：

```text
mst_p0032_ex22.card.yaml
mst_p0032_ex22.alternatives.md
```

旁挂文件保存整理后的完整推导，并索引回来源 Trace。`来源 Trace + 题问` 是该另解的身份与真实性依据，不另设模型填写的另解 ID。

## 四、整体数据流

```text
学生提交解法
  → Tutor 判断正确性、完整性和实际路线
  → Tutor 读取 graph/vocabulary.yaml、aliases.yaml 与 metadata boundary
  → trace_append 先写 assessment、support、完整路线与 methods=null
  → Tutor 提出候选节点及其对应的学生决定性步骤
  → 学生确认后，superseding Trace 才写 actual methods
     学生否定、暂缓或无精确节点时，superseding Trace 保持 methods=null
  → 若至少一问完整、正确且核心推理链与已有解法完全不同
       → card_alternative_append 写入完整另解 Markdown
  → 能力投影只聚合 active Trace 中的 actual methods
  → card_search 与 trace_search.cardsByPath 合并返回题卡、Trace 与有效生成另解
```

整个流程由现有 Tutor 完成。无需切换 Agent，也无需启动单独的图谱匹配工作流。

## 五、图谱匹配

### 5.1 LLM 判断，运行时校验

图谱匹配分为两层：

1. **Tutor 负责提出候选**：根据学生完整推导，在规范 vocabulary、aliases 和节点 boundary 中寻找一个可能贴合实际路线的主方法及必要次方法，并指出候选对应学生写出的哪一步。题卡声明的方法只是候选，不是学生实际使用方法的证据。
2. **学生负责确认归属**：学生可以确认、改选、保留未映射或暂缓。未经学生明确确认的候选不进入 Trace methods，也不进入 BKT 投影。
3. **运行时负责真实性校验**：确认节点真实存在、把其他调用入口提交的唯一 alias 解析为规范节点名，并去除主次方法中的重复项。Pi Tutor 的工具 schema 直接列出当前学习集的规范方法名。

运行时不根据关键词自动猜方法，也不计算模糊匹配分数。规则层只能阻止不存在的节点被写入，不能推翻 Tutor 对教学语义的判断。

例如：

```text
学生表述：先把参数项单独移到右边，再研究左边函数的值域
alias 候选：参数分离、水平线交点
metadata boundary：核心路线符合“参变量分离”

Tutor 候选：参变量分离
候选依据：学生把参数项单独移到一侧
学生确认后：主方法=参变量分离，次方法=导数研究单调性
```

### 5.2 无法匹配时

如果路线正确但无法稳定映射到已有图谱节点：

- `assessment` 仍然可以是 `correct`；
- Trace 保留课堂观察，但不写方法绑定；
- 不产生方法能力证据；
- 仍可生成“未归类方法”的题卡另解；
- 不自动新增全局图谱节点。

## 六、Trace 契约

真实模型验收表明，嵌套联合对象容易被当前 Pi 模型序列化成字符串并连续传错参数；而让模型首次作答就直接填写合法枚举，又会诱发“找最近节点”的假证据。因此 session-bound `trace_append` 使用扁平、必填的状态与路线字段：

```ts
{
  blockId: string;
  cardAlias?: string;
  materialPath?: string;
  methodStatus: 'unmapped' | 'student_confirmed';
  methodRoute: string;
  methodPrimary?: string;
  methodSecondary?: string[];
  methodDecisiveStep?: string;
  methodConfirmation?: string;
  assessment: 'correct' | 'partially_correct' | 'incorrect' | 'incomplete';
  support: 'none' | 'tutor' | 'external';
  note: string;
  supersedes?: string;
}
```

`methodStatus: unmapped` 表示当前没有经过学生确认的精确节点；运行时忽略所有方法字段并持久化 `methods: null`。`methodStatus: student_confirmed` 必须同时提供动态枚举中的 `methodPrimary`、学生实际写出的决定性步骤和确认摘要，否则整次写入以 `INVALID_METHOD_CONFIRMATION` 失败。成功后仍只在持久 Trace 中保存既有 `methods` 事实，不新增第二套 method-resolution schema。

运行时继续从当前 Tutor Session 和 Lesson alias 绑定真实 Lesson、Block、题卡路径、Plan、Session、时间及来源锚点；模型不提交图谱路径、题卡路径或另解编号。底层 domain 与公共 MCP 仍可接受唯一 alias 并规范化。

成功解析且经过学生确认后，Trace 持久化规范节点名，而不是原始 alias。若主方法合法而个别次方法无法解析，Trace 保留合法主方法及合法次方法，并在工具结果中返回未解析项；Tutor 只有再次得到语义确证与学生确认后才能写 superseding Trace。若主方法无法解析，则省略整个 `methods` 绑定，绝不自动猜测或提升次方法。无论哪种情况，assessment、support 与 note 都仍然写入。

学生拒绝或改选候选时也必须写 superseding Trace：拒绝保持 `methods: null`，改选只有在确认规范节点后才写 methods。若旧 active Trace 已绑定另解，需以新 active Trace 重新旁挂该另解，保证能力投影与题卡读取都只依赖 active Trace。

Trace 的 Markdown 表示保持可读，例如：

```text
Assessment: correct
Support: none
Primary method: 参变量分离
Secondary methods: [导数研究单调性]
Note: "学生将参数分离后，通过导数确定函数值域，推导完整。"
```

## 七、生成另解

### 7.1 写入工具

新增 Tutor Session 内可用的窄工具：

```ts
card_alternative_append({
  sourceTraceId: string;
  question: string;
  solution: string;
})
```

`sourceTraceId` 在当前 Tutor Session 绑定的 Lesson 中解析。单问题的 `question` 固定为“整题”；多问题必须使用题卡 `parts` 中可解析的具体题问，例如“第(2)问”。运行时从来源 Trace 自动取得题卡路径、规范方法节点、来源锚点和时间，因此模型不重复填写这些字段。

写入必须满足：

- 来源 Trace 存在且 active；
- 来源 Trace 绑定真实题卡；
- 来源 Trace 的 assessment 为 `correct`；
- `question` 明确指向整题或某一题问；
- `solution` 是非空 Markdown。

这些检查只是题卡真实性 fence，不引入新的教学裁判。“是否完全不同”由已经审阅学生推导的 Tutor 按下面的题问级标准判断，运行时不尝试用字符串规则代替这个教学判断。

### 7.2 什么才算另解

另解必须按题问比较。只有学生对至少一问给出了完整、正确，且核心推理链与该问原始参考解及已有有效另解完全不同的路线，才写入 `alternatives.md`。

对于单问题，整道题的核心推理链必须完全不同。对于多问题，只要求至少一问满足条件，但旁挂文件只保存发生变化的题问及其完整推导，不重复抄写其余未变化题问。

以下情况不算另解：

- 只更换字母、记号或叙述方式；
- 只把同一变形拆成更多步骤或合并成更少步骤；
- 只调整等价步骤的书写顺序；
- 只使用一个局部计算技巧，但入口、决定性转化和收束链条仍与已有解法相同；
- 只给同一条推理链换了另一个方法名称。

图谱方法节点是判断线索，不是“另解”的充分条件。方法节点不同但核心推理链相同，不算另解；方法节点相同的两条路线，只有在某一问从入口、决定性推理到结论的完整链条确实完全不同时，才可算另解。

Tutor 在写入前必须把学生对该问的完整路线与原始参考解及题卡已有的 active 另解逐一比较。不能确认“完全不同”时，只写 Trace 和实际方法证据，不生成另解。

### 7.3 文件格式

旁挂文件保持普通 Markdown：

```markdown
# 生成另解

## 参变量分离

来源：[lesson-003 / event-006](../../lessons/lesson-003.md#trace-event-006)

题问：整题
方法：参变量分离
次方法：导数研究单调性

### 解法

完整推导……
```

没有方法绑定时，标题和方法均写为“未归类方法”。同一个文件可以有多个同方法另解；来源 Trace 才是区分它们的稳定身份。

同一个来源 Trace 与题问重复调用 `card_alternative_append` 时更新对应章节，不追加重复章节。写入失败只影响另解沉淀，不回滚已经成立的 Trace。

### 7.4 更正闭环

旁挂文件保留历史内容，但普通题卡读取只返回由 active Trace 支持的章节。若来源 Trace 被 supersede：

- 原 Trace 不再参与能力投影；
- 原 Trace 对应的另解不再作为有效另解返回；
- 不需要在旁挂文件中维护第二套 active 状态。

若更正后的新 Trace 仍支持该另解，Tutor 以新 Trace 为来源重新写入即可。

## 八、能力投影

现有 attempt 聚合键保持不变：

```text
lessonPath + blockId + cardPath
```

投影变化只有一项：方法来源由 `card.methods` 改为 active Trace 的 `methods`。

```text
旧：Trace → Card → 题卡预设方法 → 方法信号
新：Trace → 本次实际方法 → 方法信号
```

同一个 attempt 内：

- 汇总所有 active Trace 的实际方法绑定；
- 同一节点最多产生一次方法证据；
- 某节点只要在任一有效 Trace 中作为主方法出现，本次按主方法权重计算，否则按次方法权重计算；
- assessment factor 与 support factor 沿用现有 attempt 聚合；
- 主方法权重继续高于次方法权重；
- 不读取题卡预设方法补齐或猜测缺失绑定。

`steady` 继续要求多个不同 `cardPath` 的独立 attempt。一张题的多条 Trace、多个步骤或多个实际方法都不能伪造跨题稳定性。聚合结果仍只进入 Planner Attention，作为备课时值得注意的信号。

## 九、题卡读取与课堂展示

现有两个关联读取入口都返回完整的题卡上下文：

- `card_search` 从题卡查 active Trace 与有效生成另解；
- `trace_search.cardsByPath` 从 Trace 反查题卡时，返回同样的有效生成另解。

返回结构分为三个清楚的部分：

```text
题卡原始内容
├── 原始参考解与预设方法
├── complete active Trace history
└── active Trace 支持的生成另解
```

工具返回给 Tutor 的私有内容与学生可见内容必须分开：

- Coach 备课可以查看全部有效另解，用于方法比较、追问设计和避免重复编题。
- Tutor 可以私下读取全部原始题卡、Trace 与有效另解。
- 学生第一次作答前只看到原始题干，不显示另解标题、方法节点、推导摘要或 Trace 结论。
- 学生已经提出自己的路线后，Tutor 可以使用对应另解完成评价、比较或补全。
- 学生明确要求完整解答后，Tutor 才能展示完整另解。
- 已经做过的题继续由 Trace 标识为已暴露，不能作为新的无提示迁移证据。

本设计不新增学生专用题卡接口或输出门。防剧透边界写入 `run-lesson` 与备课 reveal policy，由 Tutor 只投影当前允许的 Student View。

## 十、最小失败处理

- 学生未确认、否定或暂缓：课堂 Trace 仍写入且保持 `methods: null`；不产生方法能力证据。
- 图谱名称无法解析：课堂 Trace 仍写入；合法主方法及合法次方法只有在学生确认后才保留，未解析项单独返回；主方法无法解析时省略整个方法绑定。
- 来源 Trace 不存在、不 active、没有题卡或 assessment 不是 `correct`：拒绝另解写入，保留原 Trace。
- 同一来源 Trace 与题问重复写入：更新对应章节，保持幂等。
- 找不到图谱节点：允许正确 Trace 和未归类另解，不产生方法投影。
- 来源 Trace 被 supersede：读取与投影时自动失效，不物理删除历史内容。

除此之外不增加审核队列、后台修复任务、置信度阈值或自动建图流程。

## 十一、Prompt 与 Skill 调整

`run-lesson` 需要明确：

1. 评价学生工作时分别判断正确性、支持情况和实际方法，不用 `assessment` 代替方法判断。
2. 首次 Trace 使用扁平的 `methodStatus: unmapped` 保存实际路线；Tutor 在进入下一 Block 前提出至多一个候选并指出对应的学生步骤，学生确认后才用 superseding Trace 写规范方法。题卡方法只作候选，路线不可识别或学生不认可时保持未映射。
3. 方法明确但做错时，只有学生已经明确识别或确认规范节点才写实际方法；否则保留失败路线但不制造方法绑定。
4. 只有至少一问的完整核心推理链与该问参考解及已有 active 另解完全不同，才先写 Trace，再用返回的 Trace ID、题问和完整推导写入生成另解；无论当场还是后续比较时才确认，都必须先持久化再向学生承认这是另解。
5. 方法节点和另解始终属于 Tutor 私有上下文，遵守现有 zero、ladder 和 Student View 防剧透规则。
6. 接受学生异议时，先写 superseding Trace；后续能力信号和另解可见性只读取 active Trace。

Coach 的备课与进度检查 Skill 需要停止把题卡方法当作学生实际方法。它们读取方法能力时使用新的 Trace 投影；题卡预设方法只用于题目结构和参考解法说明。

## 十二、验收测试

### 12.1 Trace 与图谱绑定

1. `methodStatus` 与 `methodRoute` 为必填扁平字段；嵌套 method-resolution 对象不再出现在 Pi 工具契约中。
2. 未经学生确认时持久化 `methods: null`；合法方法名本身不能绕过确认。
3. `student_confirmed` 缺少主方法、决定性步骤或确认摘要时拒绝整次写入。
4. 规范节点名与合法 alias 均能持久化为规范节点名，主次方法重复时只保留主方法角色。
5. 合法 primary 不会因非法 secondary 丢失；非法项单独返回。primary 无法解析时不写入 Trace methods，但 assessment、support 与 note 保留。
6. 学生确认、否定或改选均通过 superseding Trace 形成 correction closure；普通读取只使用 active Trace。

### 12.2 能力投影

1. 学生使用题卡参考方法做对，只给实际绑定的方法生成正向证据。
2. 学生使用其他已有图谱方法做对，只给另解方法生成正向证据，题卡预设方法不加分。
3. 学生确认了实际方法但做错，为该实际方法生成失败证据；未经确认的失败路线保持未映射。
4. 一次 attempt 有多条 Trace 时，每个实际方法最多计一次证据。
5. 多个方法节点不会增加该 attempt 的题卡计数；`steady` 仍要求多个不同题卡。
6. 没有 methods 的历史或新 Trace 不再从题卡预设方法获得推测性证据。

### 12.3 生成另解

1. active、correct、card-bound Trace 所支持的某一题问只有在核心推理链完全不同时，才创建题卡旁挂 Markdown。
2. incorrect、inactive 或 cardless Trace 不能创建另解。
3. 正确但未归类的方法可以生成“未归类方法”另解。
4. 只换记号、拆并步骤、调整等价步骤顺序或使用局部计算技巧，不会生成另解。
5. 多问题中只有一问完全不同时，只保存该问的完整替代推导，不复制其他题问。
6. 同一来源 Trace 与题问重试写入不会产生重复章节。
7. 来源 Trace 被 supersede 后，普通题卡读取不再返回对应另解。

### 12.4 读取与防剧透

1. `card_search` 与 `trace_search.cardsByPath` 同时返回完整 active Trace 和有效生成另解。
2. Coach 与 Tutor 私有上下文可以读取生成另解。
3. 首次作答前的 Student View 不包含另解标题、方法节点、推导摘要或答案。
4. 学生提出路线或明确索要解答后，Tutor 才按 reveal policy 使用另解。

### 12.5 真实课程验收

使用导数学习集中出现过的一题多解场景复测：

```text
题卡参考主方法：同构变形与换元法
学生实际主方法：参变量分离
学生实际次方法：导数研究单调性
学生确认：上述节点贴合自己的实际路线
assessment：correct
support：none
```

验收结果必须满足：

- Trace 如实保存 `correct`；首次方法未确认时保持未映射；
- 学生确认后只给“参变量分离”和实际次方法生成能力证据；未确认时两个节点都不加分；
- “同构变形与换元法”不因题卡声明而自动加分；
- 题卡旁生成来源可追溯的另解；
- 再次读取题卡时同时取得原始内容、Trace 与该另解；
- 在学生第一次作答另一张题前，不泄漏任何生成另解内容。

## 十三、必须保留与可以替换

### 必须保留

- Trace 的 assessment、support、note、来源绑定与 supersede 机制；
- 题卡原有的 graph goal、主方法、次方法和参考解；
- attempt 级聚合、主次方法权重、不同题卡计数和 Planner Attention 定位；
- 题卡读取自动附带完整 active Trace；
- zero、ladder 与 Student View 的防剧透规则。

### 可以替换

- 删除“任意 Trace 自动继承题卡全部预设方法”的投影路径；
- 进度检查与备课 Skill 中把题卡方法当作学生实际方法的说明；
- Tutor 为避免错误方法归因而把正确另解写成 `incomplete` 的临时做法。

完成后，正确性、实际方法、参考方法和生成另解各自只有一个清楚的事实来源。一题多解不再迫使 Tutor 在“承认学生做对”与“避免错误能力加分”之间二选一。
