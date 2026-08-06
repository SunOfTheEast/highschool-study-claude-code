# StudyForge M0 Runtime 架构

M0 的目标不是把聊天记录包装成课程，而是让课程事实、会话责任和模型工具边界都能从本地文件与可执行契约中复查。当前实现位于 [`apps/studyforge`](../../apps/studyforge/README.md)。

## 唯一课程控制树

```text
learning-set/
├── LEARNING_GUIDE.md
├── ROADMAP.md
├── plans/<plan-id>/
│   ├── PLAN.md
│   └── lessons/<lesson-id>.md
├── cards/
├── graph/
└── materials/
```

Lesson 是严格的 Plan-local 子节点：规范路径是 `plans/<plan-id>/lessons/<lesson-id>.md`。Plan ID 在 Roadmap 中唯一；Lesson ID 只需在所属 Plan 中唯一。父节点读取证据时只能沿自己的 Tree 链接下钻。空 Lesson Tree 就表示没有课堂证据，目录里未链接的文件不得被扫描、引用或冒充历史。

Roadmap 始终为 `active`。Plan 状态为 `prepared → active → completed`，Lesson 状态为 `prepared → active → closed`。状态来源只有子文档 frontmatter；父文档中的自然语言不是状态缓存。

## 每个节点一个 Pi Session

Roadmap、每个 Plan、每个 Lesson 分别拥有原生 Pi Session。Session owner 由节点种类、ID、路径、父 ID 与父路径共同确定；展示标题不能替代身份。Lesson Session key 为 `lesson:<plan-id>:<lesson-id>`，因此不同 Plan 可以各自拥有 `lesson-001`。

新节点不会复制父节点或兄弟节点的转录。父节点需要历史时重读子 Markdown；需要更细证据时再读取对应 Lesson Block。Pi JSONL 保留原始对话和原生工具历史，但不被编译成第二套教学事实。

长 Plan Session 只在语义边界使用 Pi 原生 compaction：一次回复已结束、成功写入本 Plan 的 Lesson 文档，且活动上下文达到 200,000 tokens。摘要只是同一 Session 的工作索引；原始 Markdown 与 JSONL 仍是可回读证据。

## 四层责任边界

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| Runtime | 解析严格文档、分配 ID/owner、状态迁移、原子写入、HTTP/WebSocket、资源组装 | 教学判断、课程目标、替学生批准 |
| Skill | Roadmap/Plan/Lesson 的讨论顺序、诊断、备课流程、讲解和支架技巧 | 绕过 Runtime 改状态、发明持久事实层 |
| Agent role | 当前节点的职责、证据范围、可创建的子节点 | 承担另一个 Session 尺度的决策 |
| Persona | 表达节奏、幽默、比喻和语气 | 数学事实、权限、学习集原则、学生决策权 |

Runtime 生成路径和节点绑定参数，模型不提交任意目标路径。文档候选必须先完整解析，再以原子替换提交；源文件在提交前变化时写入失败，不能覆盖并发修改。

## 节点工具面

| 节点 | 可用工具 |
| --- | --- |
| Roadmap | `read`, `grep`, `find`, `ls`, `edit`, `write` |
| Plan | `read`, `grep`, `find`, `ls`, `edit`, `write`, `subagent`, `artifact_export` |
| Lesson | `read`, `grep`, `find`, `ls`, `classroom_log_append`, `classroom_update` |

Roadmap 只物化学生确认的未来 Plan。Plan 只创建或修改 `prepared` Lesson，并可在学生需要时用 `artifact_export` 发布只含 `Student View` 的讲义。Lesson 没有原生 `edit/write`；课堂事实只能通过绑定当前 Lesson 与 Block 的两个结构化工具追加或迁移。

生命周期动作属于 UI 和 Runtime。模型回复、页面刷新、导航或学生继续做题都不会自动开始、结束或完成节点。

## 隔离的工作上下文

Plan 可以调用两个打包的只读子 Agent：

- **Material Scout** 接受 Coach 的教学检索意图，用规范特征和自由文本做小批浅召回，只读元数据与题干。找到 Coach 要求数量的合格候选即停止，不追求全库最优。Coach 负责全文深读、数学正确性、路线、教学适配和最终写入。
- **Lesson Reviewer** 只在已选材料存在潜在剧透、矛盾或重大教学风险时做有界复核。它不重新备课、不替 Coach 选题，也不写课程事实。

两个子上下文都没有 Persona，不接收面向学生的角色扮演，也不能写 Learning Set。前端只投影安全的进度、耗时与完成状态，不展示其私有推理或文件细节。

## 本地服务与数据

Bun 服务固定绑定 `127.0.0.1`。生产页面同源；Vite 开发 Origin 必须显式声明。所有非 GET 请求以及 `/events` WebSocket 都在任何副作用前校验 Origin。没有 Origin 的本地 CLI 与测试请求仍可使用。

课程 Markdown 位于用户选择的 Learning Set。Pi 管理模型认证与 Session JSONL。浏览器显示原始教师最终文本，工具活动单独折叠；Lesson 普通视图不展示 `Teacher Control`。StudyForge 不提供云同步、远程访问或多用户隔离。

## M0 明确没有什么

M0 没有独立课堂事件池、长期学生画像、能力分数、跨 Plan 派生记忆、向量库、后台索引或统一上下文服务。若直接文档设计在重复真实课程中出现可定位的失败，M1 才会增加可追溯的认知流变与个性化投影；在那之前不能让派生结论反过来篡改原始课堂证据。
