# Safe Card Recall Sidecar 实现报告

日期：2026-08-05

分支：`codex/gentle-judgment-isomorphic-acceptance`

范围：Material Scout 检索分工、题卡 sidecar、学生可见进度、子会话负担导出

状态：实现和确定性验证已完成；完整 Roadmap → 第一个 Plan 长周期验收尚未执行

## 请审计者重点判断

这份报告不是请求审计措辞细节，而是请判断以下架构是否可行：

1. 用学习集内的安全 TSV sidecar 加速题卡召回，同时保留非题卡自由文本检索，是否是合适
   的混合边界？
2. “Scout 浅召回、Coach 完整数学核验”的责任划分是否成立？
3. 当前剩余长尾主要来自宽查询下的模型推理，而不是文件工具；应优先约束 Coach brief、
   单独降低 Scout thinking，还是需要更机械的交集执行？
4. 在原生 `grep` 有 100 条 match limit 和单行 500 字符预览限制时，当前
   `matched / inspected` 契约是否值得保留？
5. 是否存在足以阻止长周期验收的设计缺陷？

## 一、结论摘要

最终实现采用“普通文件 sidecar + 原生文件工具”，没有新增数据库、向量索引或专用结构化
检索 Runtime：

```text
Coach 形成一个材料槽位 brief
→ Scout 读取冻结词表
→ Scout grep graph/card-recall-index.tsv
→ Scout 只按规范字段、公开题面和可见排除项做浅筛
→ Scout 返回一个候选和查询边界
→ Coach 完整读取正式题卡并承担数学、路线和教学核验
```

题卡使用 sidecar；video、reading、临时讲义和非正规材料仍走 brief 指定范围内的自由文本
搜索。sidecar 缺失时，Scout 退回现有字段 `grep` 和前六行题面读取，不让整个备课流程失效。

同一份当前格式单槽位 brief 的结果，从直接搜索题卡的 137 秒、15 次工具调用，改善到 TSV
sidecar 的 61 秒、4 次调用；正式题卡、答案和评分细则读取均为 0。它证明了数据布局有实际
收益，但没有证明长尾延迟已经解决。

最重要的反例是：把历史旧 brief 原样重放时，第一组两个 Scout 虽然合计只有 8 次工具调用，
父等待仍达到 438 秒，其中一个 child 产生 46,359 reasoning tokens。旧 brief 要求 3–5 个
候选和路线级判断，又没有当前格式的精确检索词；模型在宽召回结果上长时间推理。该回放随后
被停止，不作为 sidecar 的最终 GREEN。

## 二、问题与原始基线

保存下来的真实长周期 RED 包含 5 个 Scout：

| 指标 | RED |
|---|---:|
| 父调用墙钟时间合计 | 933 秒 |
| 工具调用 | 162 |
| `read` | 88 |
| `grep` | 41 |
| `ls` | 28 |
| `find` | 5 |
| reasoning tokens | 约 101,000 |
| 读取题卡 | 59 次、41 张不同卡 |

原始行为同时包含三个问题：

- fresh Scout 每次重新发现词表、schema 和检索路径；
- Scout 深读答案、评分细则并判断完整路线，Coach 随后再次核验；
- “如实说明没有候选”被解释成近乎遍历题族。

只改 Scout/Coach 提示词的第一轮 B，把五次父墙钟时间降到 704 秒，但工具调用反而从 162
变成 164，说明职责说明有帮助，却没有解决召回布局和模型现场交集。

## 三、最终 sidecar 设计

### 3.1 文件与字段

文件：`examples/derivative-m0/learning-set/graph/card-recall-index.tsv`

每行对应一张卡，列固定为：

```text
path
goal
method
structure
choice_count
part_count
stem
```

- `goal`：`graph.goal.primary` 加 part-level goals，去重并保序；
- `method`：`graph.method.primary + secondary`，不收录 subroute；
- `structure`：`graph.structure.primary + secondary`，不收录 evidence；
- `stem`：只取顶层公开题面，内部换行和 tab 合并为空格；
- 不收录 `answer`、`rubric`、`solution`、路线、取等条件、教师判断或来源解析。

当前导数学习集：

| 指标 | 数值 |
|---|---:|
| 题卡数据行 | 519 |
| UTF-8 文件大小 | 252,554 bytes |
| 文本字符数（不含表头） | 165,604 |
| 完整不超过 500 字符的行 | 496 / 519 |
| 最长元数据前缀 | 232 字符 |

最长元数据前缀不超过 232 字符，因此即使原生 `grep` 把长行截到 500 字符，首次返回仍至少
包含 268 字符公开题面。只有未被排除的候选恰好在截断处存在关键歧义时，Scout 才读取该条
索引行。

### 3.2 为什么从 JSONL 改成 TSV

第一版 sidecar 使用 JSONL。相同 brief 已做到零正式题卡读取和正确 JSON 输出，但仍耗时
126 秒、执行 8 次工具调用。完整 CoT 显示原生 `grep` 会把每个命中行截到 500 字符；JSON
字段名、内容修订 ID 和转义使题面落在截断位置之后，模型因此又读取了 6 段索引。

TSV 删除了召回不需要的修订 ID 和重复字段名，并把规范元数据排在题面之前。相同 brief
下降到 61 秒、4 次调用。这个格式变化直接对应工具接口，不是为了追求更短提示词。

### 3.3 生成和陈旧检测

生成器：`apps/pi-teaching-web/scripts/build-card-recall-index.ts`

```bash
cd apps/pi-teaching-web
bun scripts/build-card-recall-index.ts ../../examples/derivative-m0/learning-set
```

生成器按相对路径排序，遇到缺失图谱字段或空题面会失败，不静默生成残缺行。仓库测试把
重新生成内容与已提交 TSV 做 byte-for-byte 比较，并验证 519 个路径均存在。

2026-08-05 新鲜幂等验证：

```text
rows: 519
sha256: 24ba40247894df99ee00bb52f4e65d544c92c4911b3c973974dfc6540633a7bd
重新生成前后 SHA-256 相同
```

当前只对仓库示例学习集提供一致性门。外部学习集若修改题卡，需要在其发布流程中主动重新
运行生成器；Runtime 目前不会自动生成或校验 sidecar。

## 四、Scout 与 Coach 的最终职责

### 4.1 当前 Coach brief

Coach 为每个真实材料槽位提供：

- 教学目的；
- 素材类型与可见工作量；
- 应避免的结构和已使用材料精确 ID / 路径；
- 真正改变适配判断的学生事实；
- 可选规范 `goal / method / structure` 和短 `text` 词；
- 只有组合可能过窄时才给出的放宽顺序。

Coach 不再把 Plan/Lesson 路径交给 Scout，不要求固定候选数、完整路线、数学答案、穷尽证明
或 `search_start`。父 Session 先把沿当前 Plan Tree 得到的事实压缩进 brief，避免 Scout
重新解释课程文档。

### 4.2 Scout 亮线

题卡检索顺序：

```text
读 graph/vocabulary.yaml
→ 必要时用 graph/aliases.yaml 归一图谱词
→ 选最有区分度的必需字段作为 anchor
→ 对该字段 OR 词 grep card-recall-index.tsv
→ 在返回行上核对其他字段、题面、工作量和公开排除项
→ 首个无可见风险候选即停止
```

Scout 不读取正式候选题卡，不读答案/评分细则，不解题，不判断隐零点、取等条件和完整路线。
只有首项存在具体可见风险时才找一个实质不同的备用项。

输出是无代码围栏 JSON：

```json
{
  "slot": "slot-A",
  "candidates": [
    {
      "asset_path": "cards/derivative/example.card.yaml",
      "asset_kind": "problem-card",
      "metadata_fit": "规范特征和题面适合本槽位",
      "risk": null
    }
  ],
  "search_boundary": {
    "query": {
      "goal": ["求参数范围"],
      "structure": ["指对复合结构"]
    },
    "matched": 5,
    "inspected": 1
  }
}
```

当前契约规定 `inspected <= matched`：`matched` 是完整 query 命中行数，`inspected` 只计算
其中实际按工作量和排除项浅筛的行。这个计数修订已经写入 Scout，但尚未再跑真实模型验证。

### 4.3 Coach 深核验

Coach 选择首项后才完整读取正式题卡，并负责：

- 数学答案是否正确；
- 预期路线是否走得通；
- 定义域、隐零点、端点和取等条件；
- 是否泄露希望观察的能力；
- 难度、计算量、来源陌生度和课堂作用；
- 最终写入 Lesson 的材料与编排。

若首项失败，Coach 才读取备用项；均失败时只允许在已批准边界内发出一次更明确或按授权
放宽的检索，不把深核验重新交回 Scout。

## 五、学生可见进度和开发可观测性

实现复用原生 `subagent` start/update/end 事件，将 `study-material-scout` 投影成安全的
`material-search` conversation item。学生只看到：

- `正在启动材料检索`；
- `正在筛选材料`；
- `正在查看候选材料`；
- `正在比较候选`；
- 已返回任务数 / 总数；
- 父调用经过时间和累计工具操作数；
- 完成或调整状态。

UI 不显示 token、费用、模型、brief、检索词、路径、题面、候选、CoT、子 Session 路径或
原始错误。检索卡活跃时隐藏重复的“老师正在思考”。刷新后从父 Session 的最终结果恢复
状态。

开发侧的 CoT exporter 可选跟随 child Session，分别报告父墙钟等待和并行 child 计算量，
并统计 child usage、工具分布和完整本地 CoT。完整证据不进入学生界面，也没有提交到 Git。

## 六、真实模型实验

### 6.1 当前格式单槽位

三次运行使用同一学习集、同一模型和同一 absolute-value backup brief：

| 实现 | 父墙钟 | 工具 | child input | child output | 正式题卡读取 | 输出 |
|---|---:|---:|---:|---:|---:|---|
| 无 sidecar，字段路径手工交集 | 137 秒 | 15 | 33,594 | 17,306 | 4 次、含 1 次越过题面 | 带围栏和解释 |
| JSONL sidecar | 126 秒 | 8 | 17,958 | 14,843 | 0 | 合法 JSON |
| 紧凑 TSV sidecar | 61 秒 | 4 | 10,491 | 7,397 | 0 | 合法 JSON |

TSV 相对无 sidecar：

- 父等待下降约 55%；
- 工具调用下降约 73%；
- child input 下降约 69%；
- child output 下降约 57%；
- 消除了正式题卡、答案和评分细则读取。

TSV 这次仍用了两次 `grep` 和两次 `read`：一次读取规范词表，一次读取被 500 字符截断的
单条索引；模型另外使用一次规范字段交集正则。它返回空候选是合理的，因为完整 query 命中
的 5 张卡均被 brief 的零点个数、多选或长题/隐零点排除。

该次输出把 `inspected` 写成 11、`matched` 写成 5，暴露口径歧义。源码已经修正为
`inspected <= matched`，但没有再支付一次真实模型运行验证该措辞。

### 6.2 旧 brief 兼容回放失败

旧长周期第一组包含两个 brief，仍要求“3–5 个候选”“两条路线都走通”等深层结论，且缺少
当前格式的窄规范词：

| 指标 | 结果 |
|---|---:|
| 父墙钟 | 438 秒 |
| aggregate child compute | 645 秒 |
| 工具调用 | 8 |
| child output 合计 | 69,580 |
| 正式题卡读取 | 0 |

其中一个 child 只执行 4 次工具，却用了 437 秒和 46,359 reasoning tokens。它在 sidecar
返回的宽候选集合上进行长时间语义比较；这说明 sidecar 已经把 I/O 压下来，但无法替代一个
边界正确、足够具体的 Coach brief，也无法自动阻止高 thinking 模型追求更优候选。

后续旧 brief 回放被人工停止。它不能支持“sidecar 综合 B 已通过”，只能证明旧 brief 与新
分工不兼容。

### 6.3 thinking 档位的证据问题

Scout frontmatter 写的是 `thinking: medium`，但上述真实 child Session 实际记录：

```text
thinkingLevel: high
```

验收 harness 的父进程使用 `--thinking high`。因此现有性能数据是 high-thinking 行为证据，
不能声称已经验证 medium。需要进一步确定这是 harness 继承、模型只支持特定档位，还是
`pi-subagents` 的解析/优先级行为。若架构通过，thinking 应作为单独变量实验，不能和检索
格式一起改后宣称因果。

## 七、当前验证结果

2026-08-05 在当前树重新执行：

```bash
cd apps/pi-teaching-web
bun run check
```

结果：

- TypeScript typecheck：PASS；
- Bun tests：83 PASS、0 FAIL、6641 assertions；
- Vite production build：PASS；
- 唯一警告：主 JS chunk 601.48KB，大于 Vite 默认 500KB 提示线；与本检索改动无直接关系。

索引测试覆盖：

- 519 张源卡对应 519 行；
- 稳定路径排序和 byte-for-byte 一致性；
- 每行恰好七列；
- 所有路径真实存在；
- 三类规范字段非空；
- 选项数、小问数为非负整数；
- 代表题题面和可见数量保留；
- 代表题答案内容不进入 sidecar；
- 500 字符预览覆盖率和元数据前缀上限。

## 八、提交与主要文件

相关提交：

```text
20b9d98 fix: bound material scout to shallow recall
2e50b5c feat: show safe material search progress
af59ab9 feat: export subagent load metrics
e6d7bee docs: activate safe card recall sidecar
aab92f2 docs: plan safe card recall index
a554849 docs: clarify card index anchor recall
272c4b7 feat: add safe card recall index
30c93ca refactor: compact card recall index
```

主要实现文件：

- `apps/pi-teaching-web/resources/subagents/study-material-scout.md`
- `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/references/material-preparation.md`
- `apps/pi-teaching-web/scripts/build-card-recall-index.ts`
- `apps/pi-teaching-web/tests/m0/card-recall-index.test.ts`
- `examples/derivative-m0/learning-set/graph/card-recall-index.tsv`
- `apps/pi-teaching-web/src/projection/material-search.ts`
- `apps/pi-teaching-web/src/client/components/MaterialSearchActivity.tsx`
- `apps/pi-teaching-web/scripts/export-pi-cot.ts`

权威设计：

- `docs/superpowers/specs/2026-08-04-session-specific-teaching-skill-tree-design.md`
- `docs/superpowers/plans/2026-08-05-bounded-observable-material-scout.md`

## 九、尚未完成或尚未证明

以下项目必须明确保持为未验证：

1. 尚未运行采用当前 Coach brief 和 TSV sidecar 的 Roadmap → 第一个 Plan 完整长周期；
2. 尚未验证 Plan 中每一次材料检索都能稳定维持约一分钟或更短；
3. 尚未真实验证 video / reading / 非正规材料的自由文本 fallback；
4. `inspected <= matched` 的最终措辞尚未跑真实模型；
5. 当前 broad anchor 可能触发原生 `grep` 100-match limit，届时 `matched` 无法证明是全量精确值；
6. 外部学习集的 sidecar 更新仍依赖发布者主动运行生成器；
7. high → medium 是否能进一步降低延迟且不损伤首击守住率，尚未做隔离实验；
8. UI 安全进度已有确定性测试，但 TSV 版本尚未再做一次浏览器内真实长检索 smoke。

## 十、希望 Kimi 给出的判断

请优先回答以下问题：

1. 这套架构是否足够合理，可以进入完整长周期验收？
2. TSV sidecar 是否只是恰当的数据布局，还是已经隐性演化成一个应由 Runtime 管理的索引？
3. 对 519 张卡和未来更大题库，一次 anchor grep 加模型行内过滤是否可持续？
4. 对宽查询的 100-match limit，建议：
   - 强制 Coach 提供更窄规范词；
   - sidecar 预计算更细特征；
   - 允许一次规范字段正则交集；
   - 还是改为机械交集能力？
5. `matched / inspected` 是否提供了足够审计价值，还是应该改为更诚实的
   `returned / screened`，或直接删除计数？
6. 面对“4 次工具但 7 分钟推理”的长尾，应先修 brief、thinking 优先级，还是 Scout 的停止
   判断？
7. 是否看到会导致答案泄露、sidecar 陈旧、错误召回或非题卡兼容性退化的缺口？

在这些问题得到判断前，不把当前实现宣称为完整长周期 PASS。
