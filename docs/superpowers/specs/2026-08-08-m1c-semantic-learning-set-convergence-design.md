# StudyForge M1c：语义学习集与学习路径合流设计

**状态：** 已逐项讨论确认，待书面复核

**日期：** 2026-08-08

**产品基线：** M1b `3abab14`；M1 设计同步 `586de33`

## 一、核心结论

M1c 不再增加一种“更正式的学习对象”，而是让 M1b 已经成立的 Note、题卡、原始资料、
教师记忆和课程树通过同一组语义词语与严格来源关系互相找到。

它完成一条统一但不混同的学习路径：

```text
原始资料（Material）──选择 locator──┐
空白自由讨论 ───────────────────────┼── 真实学习或备课 ──确认── Note / 题卡
既有学习资产 ────────再次使用───────┘                              │
Material / Note / 题卡 ────────────────────────────────────────────┼── 平坦语义标签与可重建关系
自由学习 ───────────────┐                                          ├── 教师对象记忆
正式 Lesson ────────────┼── 真实学习证据 ──────────────────────────└── 学生学习足迹投影
独立作答 ───────────────┘

Meta Session ──讨论并确认长期方向── Roadmap → Plan → Lesson
```

自由学习、Meta、Roadmap、Plan 和 Lesson 仍是不同 Session。合流发生在资产、记忆、来源和
语义索引之间，不通过 Session 自动转换实现。

## 二、版本边界

### 2.1 M1c 新增什么

1. 新资产使用动态、平坦、带主次的语义标签；旧题卡通过兼容投影进入同一检索面。
2. 标签、来源和对象记忆建立可重建关系，使内容与学生认知可以互相召回而不互相冒充。
3. 书籍、PDF、图片、讲义等原始资料可以入库、建立检索入口，并在真实使用中渐进沉淀为
   Note 或题卡。
4. 学习集根增加 Meta Session；学生确认后由它创建 Roadmap，Roadmap 再负责第一个 Plan。
5. 自由学习与正式课程共享资产和记忆，已有自由学习证据能够服务正式课程，正式课程留下的
   历史也能服务后续自由学习。
6. 从既有 canonical 事实生成面向学生的学习足迹，不新增第四种事实日志。

### 2.2 M1c 不做什么

- 不引入图数据库、embedding 服务或通用 recall 工具；
- 不把标签图、邻居图或学习足迹变成新的 canonical 真相；
- 不因导入资料、保存资产、查看答案或浏览标签而更新教师记忆；
- 不在导入整本书时默认批量生成 Note、题卡或课程；
- 不把自由学习自动升级成 Lesson，也不把正式 Lesson 降级成自由对话；
- 不引入 SRS、BKT、掌握分数、统一能力等级或自动复习排程；
- 不实现分享、社区、发布市场或跨用户权限；
- 不在本期完成知识图可视化和页面级视觉润色；这些统一进入 M1d。

### 2.3 比较过的方案

**对象化知识图谱。** 为标签、知识点、方法、题型和关系分别建立节点与边。它能表达很多
结构，但会重新制造旧 StudyForge 中“每增加一个名词就增加一种对象”的耦合，写入和迁移
成本都过高。不采用。

**平坦语义标签加可重建关系。** 资产和对象记忆只声明少量核心与相关词语；图、邻居、反向
来源和检索索引全部从这些事实生成。它最符合当前 Markdown、Scout 和渐进式披露架构。
采用。

**向量库或图数据库先行。** 检索速度可能更高，但会提前引入第二套事实面和新工具，而当前
数据量尚未证明原生文件与 sidecar 不够。延后到 M1d 之后的真实瓶颈评估。

## 三、一个事实一个所有者

| 事实或判断 | 唯一持久所有者 | 其他位置只能做什么 |
| --- | --- | --- |
| 原始资料在某个 revision 的真实内容 | Material revision | 建索引、OCR、页级投影 |
| Note 或题卡某个资产 revision | 当前 revision 的 canonical 文件，或被替换后唯一的 immutable archive | 生成读者投影 |
| 某个资产 revision 直接来源于什么 | 该资产 revision 的 `sources` | 生成反向来源边 |
| Note、题卡或 Material 涉及哪些语义 | 独立 tag sidecar | 生成词表、邻居和召回索引 |
| 对象记忆对应什么语义 | 对象标题与既有 memory 分桶 | 投影到统一语义索引 |
| 正式课堂中发生了什么 | Lesson Block Classroom Log | 对象历史引用 Block |
| 自由学习中实际说过什么 | 原生 Pi Session | 对象历史引用完整 Session |
| 独立作答与答案查看 | 只追加 activity 记录 | 生成足迹和最近状态 |
| 学生在某对象上学到哪里 | 对象记忆 | 标签只提供召回入口 |
| 学生明确表达的互动需求 | 偏好记忆 | Session 保留原话来源 |
| 长期、阶段和课堂承诺 | Roadmap / Plan / Lesson | Meta 或 Coach 只能提出草案 |
| 标签别名与合并重定向 | alias / redirect 记录 | 词表投影规范化 |
| 语义邻居、反向来源、足迹和列表 | 可重建投影 | 不接受独立语义写入 |

资产内容、标签、学生认知和学习活动彼此相关，但没有任何一个能够代替另一个。

## 四、平坦语义层

### 4.1 只有两级标签

所有新 Note、题卡，以及已经完成语义标注的 Material，使用两组动态标签：

```yaml
core:
  - 沉淀溶解平衡
  - 平衡常数
related:
  - 固体活度
  - 离子浓度
```

- `core` 表示理解或使用该资产时绕不开的核心语义，可以有一个或多个；
- `related` 表示确实存在、但不是资产主要作用的背景、方法或结构；
- 不再要求所有学科都填 `goal / method / structure / subroute` 等固定维度；
- 标签使用短而稳定、具有真实学科含义的词语，不写句子式评价或学生状态；
- 标签不是 mastery、难度、正确性、偏好或课程阶段字段。

新 Note 与题卡至少有一个 `core`，`related` 可以为空。Material 可以先完成原始入库与机械
索引，之后再增加语义标签，不能为了填标签阻塞上传。模型只选择语义词语；Runtime 绑定
资产身份、时间和 metadata revision。

### 4.2 标签 sidecar 与资产 revision 分离

标签不进入 Note 或题卡的资产 revision。这里的资产 revision 就是 M1b 已有的 `revision`，
固定该版内容和形成来源；每个稳定学习资产另用独立 sidecar：

```yaml
schema: studyforge.semantic-tags.v1
subject:
  kind: note
  id: note-001
revision: 3
core:
  - 沉淀溶解平衡
related:
  - 平衡常数
updated_at: 2026-08-08T20:00:00.000Z
```

逻辑目录为：

```text
semantics/
├── assets/       # Note、题卡、Material 的 tag sidecar
├── aliases.yaml  # 同义归一与重定向决定
└── indexes/      # 全部可重建
```

标签修改只增加 metadata revision，不增加题卡或 Note 的资产 revision，也不会让既有作答看起来
绑定了另一版题目。资产 revision 与标签 revision 可以独立进行 stale-write 检查。

标签描述稳定资产身份。保持同一语义对象的正常内容修订可以沿用标签；如果内容已经换成另一
个知识对象，应创建新资产，而不是把旧资产连身份一起替换。

### 4.3 动态词表不成为第二份标签事实

canonical 标签来自真实 sidecar 和旧题卡兼容投影。`semantics/INDEX.md` 或机器索引只是当前
标签集合的可重建视图，不要求模型同时写一份中央词表。

遇到新词时可以直接成为 canonical 标签。后来确认两个词同义时，只新增 alias 或 redirect：

- 别名表示相同语义，可以在查询时自动归一；
- redirect 表示旧 canonical 词已合并到新词；旧 sidecar 不批量改写，原引用继续可解析；
- alias / redirect 不允许循环，也不能把“相关”伪装成“同义”。

自动化只应用已经存在的 alias / redirect。未收录的新词可以原样进入 sidecar；相似度召回只能
提示“可能需要整理”，不能自行生成同义关系。新增 alias / redirect 必须作为一次显式语义
metadata 变更提交，Runtime 只校验形状、目标存在性与无环，不替模型判断两个词是否同义。

### 4.4 对象记忆与标签只建立路由关系

对象记忆不再复制一份 tag sidecar。对象标题天然提供核心语义锚点，已有 memory 分桶标题
提供相关锚点；统一索引直接从这两个 canonical 位置投影。资产和对象记忆因此可以通过同一
个词语互相找到，却不会形成第二份对象身份。

承重边界是：

> 对象记忆不能机械继承来源资产的标签；只由教师根据学生真实表现选择它真正对应的对象和
> 必要背景。

一张同时标有“导数、绝对值、三次函数、极值点偏移”的题卡，可能只暴露“分段点识别”的
学习问题。打开或完成这张卡都不会自动创建四份对象记忆。

### 4.5 知识关系图是投影

关系图可以从以下事实随时重建：

- 资产具有 `core` / `related` 标签，对象记忆具有标题与分桶；
- 多个标签在同一对象上共同出现；
- 一项资产直接来源于另一项资产或 Material locator；
- alias / redirect 把多个用词归一。

由此可投影出标签—资产、标签—对象记忆、资产—来源和标签共现邻居。M1c 不再持久化一份
需要双写的“知识图正文”。图投影损坏时删除重建，不影响任何 canonical 资产或记忆。

### 4.6 旧题卡兼容

现有 519 张题卡及冻结 `graph/vocabulary.yaml` 不改写：

- `goal / method / structure` 中的 primary 值投影为 `core`；
- 同一三组中的其他值、secondary 与 subroute 投影为 `related`；
- fallback、evidence、detail terms 和答案字段不冒充标签；
- 旧 `graph/aliases.yaml` 继续只服务旧题库的查询展开，不复制进新 alias 事实，也不据此自动
  宣称两个新标签同义；
- 兼容结果进入统一 recall index，但不是新 sidecar，也不增加旧卡 revision。

新资产只写平坦标签。Scout 和资产浏览读取统一索引，因此新旧题卡可以共同召回，而不要求
一次性迁移旧库。

## 五、严格来源链

### 5.1 `sources` 的唯一含义

`sources` 只表示内容的直接来源或必要依赖：去掉这条关系后，就无法完整说明该资产是怎样
形成的。

它不表示：

- 某项资产曾经被选入对话上下文；
- 两项内容语义相似；
- 学生浏览、作答或学习过该来源；
- 创建资产的 Session。

三类关系保持分离：

```text
sources = 形成链
tags    = 语义关系
session = 发生现场
```

### 5.2 来源绑定具体 revision

新来源引用只有两种形状：

```ts
type SourceReference =
  | { kind: 'note' | 'problem-card'; id: string; revision: number }
  | { kind: 'material'; id: string; revision: number; locator: string | null };
```

`locator` 必须来自对应 Material revision 的实际 locator index，例如 `page-0042`；模型只使用
当前 Session 已绑定的短别名，Runtime 解析并校验稳定 ID、revision 和 locator。

来源 revision 后来更新时，既有资产仍指向当时版本，不自动漂移到最新版。新写入拒绝
不存在的 revision、未知 locator、自引用和 revision 级来源环。这里检查的是不可变 revision
形成的有向关系，而不是粗暴禁止两个稳定资产在先后 revision 中互相吸收内容。

本文的“资产 revision”同时固定该版内容与 `sources`。修正来源即使不改学生可见正文，也要
创建一个新资产 revision；旧 revision 及其旧来源不回写。标签仍属于独立 metadata revision。

Note 或题卡更新时，Runtime 在同一原子事务中把将被替换的旧 canonical bytes 保存到该资产
的 immutable revision archive，再写入新 current revision。一个 revision 在任一时刻只有一
个读取位置：当前文件或历史 archive；来源解析器可以据 revision 精确打开。M1c 上线前已经
丢失的历史 revision 不猜测补造，只报告 unresolved legacy revision。

M1b 已有 `{kind,id}` 来源以 `legacy-unpinned` 读取，不能静默绑定当前 revision。资产下一次
经用户或教师真实复核后才可以固定到具体版本。

### 5.3 反向来源不双写

“这张题卡派生了哪些 Note”或“教材这一页产生了哪些资产”由来源索引反向生成。资产只写
正向 `sources` 一次；反向索引失败不回滚已成功的 canonical 资产，并可随时重建。

## 六、原始资料与渐进蒸馏

### 6.1 Material 是来源资产，不是学习结论

学生导入资料时，Runtime 建立稳定 Material 身份和不可变 revision：

```text
materials/<material-id>/
├── manifest.yaml
├── revisions/<revision>/original.<ext>
└── projections/<revision>/...   # 可重建的文本、页、章节和召回索引
```

manifest 保存 Runtime 绑定的 ID、revision、内容哈希、标题、类型、导入时间和原始文件名。
更新资料创建新 revision，旧 revision 保留，使既有来源引用仍可核查。

M1c 前已经位于 `materials/` 下的散装文件继续以 legacy read-only 入口浏览和选择，不原地
改写，也不假装已有不可变 revision。它要成为新资产的 pinned source 时，学生先通过普通
导入动作把该文件保存为受管 Material；保存资产时不能静默完成这次迁移。

PDF、图片或媒体的 OCR、页级 Markdown、章节入口、短关键词和 locator index 都是该 revision
的检索投影，不是几百个新的学习资产。投影失败时原资料仍然成功入库，并显示为“尚未完成
索引”，可以机械重试。

### 6.2 默认导入只做入库与检索入口

导入一本书默认只执行：

```text
保存 Material revision
→ 建立可打开的来源入口
→ 生成可重建 locator / 关键词索引
→ 停止
```

它不自动创建 Note、题卡、对象记忆、Roadmap 或掌握记录。导入行为可以出现在活动足迹中，
但只能表述为“加入资料”，不能表述为“学习了资料”。

### 6.3 资产在真实使用中形成

学生可以从 Material 页面选择一页或多个 locator 进入自由学习；Coach 备课时也可以让 Scout
召回相关 Material locator。讨论或备课真正形成可复用内容后，才沿现有保存门创建 Note 或
题卡，并写入准确来源 revision。

因此学习集的生长是：

```text
原书仍是原书
→ 某段被真实使用
→ 学生看见拟保存内容
→ 明确确认
→ 形成 Note / 题卡
```

学生明确要求“整理整本书”时可以启动独立 Worker 批量建立检索投影或生成候选草稿，但它
不是默认导入动作。候选草稿不能直接冒充 canonical 学习资产，也不更新记忆；批量资产发布
需要单独的可见复核，不属于 M1c 最小闭环的通过条件。

## 七、Meta Session 与 Roadmap

### 7.1 Meta 属于学习集，不属于课程树

Meta 是学习集根级、可恢复的原生 Session。它只解决一个问题：学生是否要把当前零散学习、
资料和需求组织成一个长期 Roadmap，以及这个 Roadmap 的公开方向是什么。

Meta 可以按需读取：

- `LEARNING_GUIDE.md`；
- 紧凑的资产与标签覆盖概述；
- `memory/INDEX.md` 及真正相关的对象记忆；
- 可重建学习足迹摘要；
- 学生本次明确选择的资料或资产。

它不枚举完整资产库，不把资料覆盖范围解释成学生能力，也不替 Roadmap 设计第一个 Plan。

### 7.2 创建顺序

```text
学生进入 Meta
→ 讨论为何需要长期学习、希望发生什么变化
→ 教师结合已有证据提出 Roadmap 级公开方案
→ 学生明确确认或修正
→ Runtime 原子创建 ROADMAP.md
→ 打开新的 Roadmap Session
→ Roadmap 按自己的问诊与批准门制定第一个 Plan
```

学生拒绝长期课程时，Meta 停止物化；自由学习与资产库照常可用。`ROADMAP.md` 已存在时，
首页长期课程入口直接进入 Roadmap，不创建第二份并行 Roadmap。

### 7.3 空白与已有证据共用同一 Roadmap 逻辑

- 没有历史证据时，Roadmap 使用现有自然问诊和必要短探针；
- 已有自由学习、作答和对象记忆时，Roadmap 先读压缩结果，再按需核查来源；
- 资料或资产很多但没有学生表现时，只能说明“可用材料丰富”，不能跳过诊断；
- 无论证据多少，第一个 Plan 都由 Roadmap 与学生讨论并确认，不由 Meta 预写。

## 八、自由学习与正式课程合流

### 8.1 合流的是资源，不是 Session

所有教学 Session 可以在各自权限内使用同一学习集的：

- Note、题卡和 Material；
- 平坦标签、别名与来源关系；
- `memory/INDEX.md` 和按需对象记忆；
- 学生明确选择的上下文。

自由学习仍然无预设目标、允许发散并由学生显式结束。Lesson 仍然属于 Plan，拥有 Blocks、
Teacher Control 和 Classroom Log。任何一方都不因对话长度、内容成熟或产生资产而改变类型。

### 8.2 记忆在主线、支线与日常之间流动

自由学习形成的对象记忆可以被后续 Roadmap、Plan 和 Lesson 召回；正式课堂留下的对象历史
也可以在自由学习遇到相关问题时按需使用。独立作答则通过题卡 revision 和真实 activity
进入下一次对话上下文。

这相当于主线任务、支线任务和日常活动共享同一个角色成长历史，但每种活动仍保留自己的
规则和事实来源。旧记忆只能帮助选择教学动作，不能覆盖学生眼前表现。

### 8.3 正式备课使用学习资产

- 学生已经点名的精确资产直接进入备课上下文，不调用 Scout 重新发现；
- 未绑定路径的学习集候选继续交给 fresh-context Scout；
- Scout 只读取安全的标签、公开题面和 Material 检索投影，不读取学生笔记、作答或记忆；
- Coach 完整读取准备采用的候选，并独占数学、来源和教学适配核验。

备课若采用自编题，先以内联内容完成已批准 Lesson 的准备。准备结束后向学生说明拟保存的
题卡内容；学生明确确认后才持久化题卡并把精确路径挂回该 Lesson。学生拒绝保存不删除或
重写已经准备好的课堂，题卡持久化失败也不把 Lesson 伪装成未准备。

M1c 不因此给所有 Plan、Roadmap 或 Lesson 开放通用资产写权限。自由学习保留 M1b 的
`save_note` / `save_problem_card`；正式备课只获得上述自编题的窄确认通路。

## 九、Scout 与语义邻居

### 9.1 统一索引，不统一深读

统一 recall index 将新 sidecar 和旧题卡兼容标签排在安全行中。它可以包含资产路径、类型、
`core`、`related` 和允许公开的短题面或标题，不包含答案、教师依据、学生笔记、作答或记忆。

Scout 仍只做特征召回与浅筛；Coach 继续深读最终候选。语义图不能把路线核验重新下放给
Scout。

### 9.2 别名与邻居的边界

- 别名表示同一个意思，可以自动归一，不算改变查询；
- 语义邻居只表示相关，会改变查询，只有 brief 明确允许放宽时才能使用；
- 邻居用于提出下一条查询切片，不用于证明当前候选更优。

### 9.3 数量停止门保持不变

```text
规范词与别名归一
→ 执行当前查询
→ 达到 brief 所需数量，立即返回
→ 数量不足时，只按 brief 明确允许的顺序放宽
→ 放宽后达到数量，立即返回
→ 未授权放宽则返回当前已经找到的数量
```

找到足够合格项后，不为更典型、更干净或更优的候选继续遍历邻居。空结果只说明当前查询
切片为空，不宣称全库不存在。M1c 不增加固定 wall-clock、全局候选上限或语义穷尽门。

## 十、学习足迹是可重建投影

### 10.1 它回答什么

学习足迹面向学生回答：“我最近从哪里出发，做过哪些真实活动，留下了什么，还能回到哪里？”
它不回答“我掌握了多少分”。

投影可以合并：

- Roadmap、Plan、Lesson 的真实生命周期入口；
- 自由学习 Session 的创建、继续和显式结束；
- Note、题卡和 Material 的创建或 revision；
- 题卡作答与答案查看；
- 对象 `Learning History` 的事件身份、对象标题、时间和来源入口。

M1c 的默认学生足迹 API 不直接暴露教师内部判断正文。它先提供对象标题、发生时间和稳定
入口；M1d 再逐页设计学生主动回顾“来时路”时怎样展示更完整、但不失真的对象历史。

“主线、支线、日常”只是前端组织比喻，不写成新的 domain enum。每个足迹条目仍链接自己的
canonical 来源。

### 10.2 不建立 footprint log

足迹没有独立写工具和 canonical 日志。Runtime 从节点文档、Pi Session 元数据、activity、
资产 revision 和对象历史生成统一时间线；需要加速时可以缓存，但缓存必须可删除重建。

来源被纠正后，足迹随重新投影变化；旧 Classroom Log、Session、作答或 Learning History
不会为了修正足迹而回写。

## 十一、上下文与模型负担

M1c 不把整个词表、关系图、资料目录或足迹注入每个 Session：

- `memory/INDEX.md` 继续作为有记忆读取职责角色的紧凑常驻入口；
- 学生明确选择的资产与 Material locator 才进入当前对话；
- Meta 读取紧凑覆盖概述，只有讨论需要时展开具体资产或记忆；
- Scout 在 fresh context 中读取统一 recall index；父 Coach 不先发现候选；
- Tutor 遇到预案外问题时从 memory L0 开始，不同时注入对应完整 Lesson；
- 关系图和足迹默认由前端/API 投影，不能借“方便联想”进入系统提示。

M1c 的性能收益来自缩短召回路径，而不是让每个模型同时知道更多。

## 十二、模型与 Runtime 的最小契约

### 12.1 模型只提交不可约语义

- 新资产的 Note/题卡内容；
- 少量 `core` / `related` 标签；
- 当前绑定上下文中真正影响内容的来源短别名；
- Meta 中公开讨论后形成的 Roadmap 方案；
- 教师记忆中已有 M1a 契约要求的对象判断。

### 12.2 Runtime 绑定权威

- 学习集、Session、角色与写入权限；
- 资产、Material、revision、metadata revision、时间与路径；
- 来源短别名到精确 asset revision 或 Material locator 的解析；
- stale-write、来源环、alias 循环和路径边界校验；
- 原子写入、幂等回执与投影失效通知；
- 统一 recall index、反向来源、邻居图和学习足迹的重建。

### 12.3 现有工具的扩展面

- `save_note` / `save_problem_card` 增加平坦标签与 pinned source 解析，仍受学生确认门约束；
- Material 导入由用户上传动作触发，不由 Tutor 凭路径猜测；
- Meta 获得一个只在明确确认后创建 `ROADMAP.md` 的窄物化工具；
- 正式备课只增加自编题确认后的窄持久化能力；
- 记忆读取仍使用原生 `Read` / `Grep`，不新增通用 recall 工具。

## 十三、原子性、修正与失败边界

1. 新 Note / 题卡内容、准确来源和初始 tag sidecar 同一次成功或全部不发生；Material 可先
   完成原始入库，语义 sidecar 后补；召回索引随后可重建。
2. 标签单独更新只修改 sidecar 并增加 metadata revision，不改资产 revision。
3. stale 资产 revision 与 stale metadata revision 分别拒绝，不静默覆盖。
4. Material 原始内容保存成功但 OCR/索引失败时保留 Material，并明确显示未索引；重试不创建
   第二个 revision。
5. 新写入来源无法解析、revision 不存在、locator 不存在或形成环时拒绝资产写入，不自动换成
   最新来源。
6. alias / redirect 成环时拒绝该语义变更；既有标签与索引保持可用。
7. 任何投影重建失败都不能损坏资产、来源、记忆、Session 或课程文档。
8. Meta 创建 Roadmap 失败时保留已确认的对话，但不留下半个 `ROADMAP.md` 或自动重试物化。
9. 自编题保存失败不回滚已经准备好的 Lesson；修复后只重试同一题卡写入与精确挂载。
10. 内容相似不会触发自动资产合并；标签相近不会触发对象记忆合并。

## 十四、三个真实情境

### 14.1 导入一本化学书，慢慢长成学习集

学生导入《化学反应原理》PDF。系统保存 Material revision 并建立页码、章节和关键词入口，
没有生成课程、Note、题卡或“已学习”记录。

学生从“沉淀溶解平衡”章节选择 Ksp 附近页面进入自由学习，问“为什么 Ksp 只写离子浓度，
固体去哪了”。Tutor 读取选中 locator；学生经过比较后重新解释出纯固体活度进入常数。学生
确认保存一份 Note：

- `core`：沉淀溶解平衡、平衡常数；
- `related`：固体活度；
- `sources`：该书当前 revision 的准确页面 locator。

对象记忆只记录学生在提示后的真实重新解释及未检验边界，不因导入或保存 Note 产生。以后
Meta 与学生确认建立长期化学 Roadmap，Roadmap 再结合这条对象记忆制定第一个 Plan。

### 14.2 没有资料，讨论本身形成独立 Note

学生在空白学习集中自由问：“阿伦尼乌斯方程里的指数为什么会对温度这么敏感？”对话没有
带入任何 Material 或题卡。学生通过比较两个温度下的指数项，形成自己的解释并确认保存。

Note 有标签但 `sources` 为空；创建 Session 仍由 provenance 单独记录。它可以与以后导入的
化学资料通过标签成为邻居，却不能事后伪造为“来源于那本书”。真实解释同时可以支持对象
记忆，漂亮 Note 本身仍不证明理解。

### 14.3 正式课程调用自由学习历史与旧题库

学生已经在自由学习中暴露“表面形式变化后不主动寻找不变量”，随后进入导数 Roadmap。
Plan 备课需要两道“绝对值 + 三次函数 + 参数主元”训练题：

1. Coach 从对象记忆知道要观察独立启动，但不把旧判断写进 Scout；
2. Scout 从统一索引读取旧 `graph` 兼容标签与新平坦标签；
3. 别名自动归一，找到两道合格题后立即停止，不沿邻居寻找更优题；
4. Coach 深读两张题卡并完成数学与教学核验；
5. Lesson 中学生出现与旧记忆不同的新表现时，以当前表现为准并在课末追加新的对象历史；
6. 后续自由学习再次遇到同类问题时，可以召回这次正式课堂留下的变化。

主线课程、自由学习和独立作答因此共享历史，但没有任何 Session 被改造成另一种类型。

## 十五、左右互搏审计

| 可能的冲突 | M1c 边界 |
| --- | --- |
| 导入整本书看起来像“学了很多” | 导入只产生 Material 与检索投影，不产生认知判断 |
| Note 很成熟，被误当成学生独立理解 | 资产只持有内容；记忆必须引用真实表现并写明帮助 |
| 标签很多，自动生成大量对象记忆 | 标签只召回；对象记忆只能由教师根据表现创建 |
| 对话选中过一张卡，资产自动把它写成来源 | 只有真正影响内容的绑定项进入 `sources` |
| 来源更新后旧资产悄悄指向新版本 | 来源固定 revision；旧引用不漂移 |
| 标签修正让旧作答绑定另一版题 | tag metadata revision 与资产 revision 分离 |
| 自由讨论越来越完整，被升级成 Lesson | Session 类型永不由内容或时长推断 |
| Meta 看到历史后直接创建第一个 Plan | Meta 只创建确认后的 Roadmap；Plan 由 Roadmap 讨论 |
| 足迹成为第四份学习日志 | 足迹完全从 canonical 来源投影，无写入工具 |
| 语义邻居让 Scout 再次追求最优 | 邻居只在 brief 授权放宽时使用，数量满足立即停止 |
| 新标签要求重写 519 张旧题卡 | 旧 graph 只读兼容投影，不迁移、不双写 |
| 知识图损坏导致资产不可用 | 图是可删除重建的索引，不取得事实所有权 |

## 十六、验收

### 16.1 确定性验收

1. 新 Note、题卡创建时原子生成内容、pinned sources 与初始 tag sidecar；Material 无标签也
   能先完成入库和机械索引。
2. 标签更新只增加 metadata revision；题卡资产 revision、旧 attempt 和答案门状态不变。
3. 旧 519 张题卡无需修改即可进入统一 recall index，冻结词表仍可使用。
4. legacy-unpinned 来源不会被静默绑定当前 revision；新来源拒绝缺失 revision、locator 和环。
5. Note / 题卡更新会保存可解析的旧 revision；M1c 前缺失的历史只报告 unresolved，不补造。
6. tag、alias、来源和对象关系可以重建索引；删除全部投影不损坏 canonical 内容。
7. 导入资料不创建 Note、题卡、记忆、Roadmap 或掌握字段；索引失败可恢复。
8. Meta 未确认时不能创建 Roadmap；确认后只创建 Roadmap，不创建 Plan。
9. 已有自由学习证据和完全空白两种 Roadmap 入口都沿现有诊断与批准门工作。
10. 自由学习与正式课程可以读取对方留下的对象记忆，但 Session 类型和事实来源不变。
11. 足迹可从节点、Session、activity、资产和对象历史完全重建，没有 footprint log。
12. Scout 自动处理别名；未授权时不沿邻居，授权放宽时仍在达到 brief 数量后停止。
13. 自编题被拒绝保存时 Lesson 仍可上课；确认保存后只产生一张卡和一个精确 Uses 挂载。

### 16.2 真实模型验收

使用三个 §十四情境分别运行至少一次真实链路，重点观察首击行为：

- 教师是否先教学生，而不是为了打标签、存资产或创建课程打断对话；
- Meta 是否用普通语言讨论长期方向，并把第一个 Plan 留给 Roadmap；
- Tutor 是否把资产、记忆和当前表现分开；
- Scout 是否在得到所需数量后结束；
- 学生是否能够理解来源、保存和进入课程的公开动作，而无需理解 revision、sidecar 或投影；
- 新语义层是否缩短检索，而没有增加整图注入和长时间无反馈。

自动化只报告证据与风险；M1c 是否通过、是否进入发布，最终判断权仍属于项目负责人。

### 16.3 M1d 接口而非视觉承诺

M1c 只保证下列可用接口与朴素入口：

- Material 导入、索引状态、打开与选择 locator；
- 资产标签和准确来源的读取；
- Meta Session 与确认后的 Roadmap 跳转；
- 可重建学习足迹 API；
- 标签、来源、邻居和对象记忆的查询投影。

M1d 再逐页检查首页、资产库、Material 阅读、Meta、课程页、足迹与关系图的视觉层级、交互和
可解释性。M1c 不用临时复杂 UI 绑死这些页面。

## 十七、实施依赖顺序

M1c 是一个产品闭环，不拆成多个对外版本；实现计划按依赖顺序切片：

1. 平坦 tag sidecar、pinned sources、旧 graph 兼容与统一索引；
2. Material revision、locator 投影与按需进入 Session；
3. Meta Session、Roadmap 物化门和正式备课自编题通路；
4. 学习足迹投影、跨 Session 召回和三个真实情境验收。

前一切片必须保持可回归，后一切片不能通过临时双写重新定义前面的事实所有权。

## 十八、已确认决策

- 旧 Trace 文档与现行记忆链路已经清理；M1c 不恢复中间痕迹层。
- 旧 `graph` 采用兼容投影，新资产不迁移回固定 `goal / method / structure` schema。
- 标签 metadata revision 与资产 revision 分离。
- Meta 属于学习集；Meta 创建 Roadmap，Roadmap 创建 Plan，Plan 创建 Lesson。
- 原始资料默认只入库并建立检索入口，真实使用后才沉淀资产。
- 学习足迹是可重建投影，不是新事实层。
- 自由学习与正式课程通过资产和记忆合流，不通过 Session 转换合流。
- 资产标签与对象记忆共享语义路由，但绝不自动互相生成或更新。
- `sources` 只表示形成链；标签表示语义；Session 表示发生现场。
- 别名可自动归一；语义邻居只有 brief 授权时才能放宽查询，并继续服从数量停止门。
- M1c 只留功能接口，M1d 再统一逐页检查前端。
