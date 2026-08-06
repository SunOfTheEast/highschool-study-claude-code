# StudyForge Learning Set 契约

Learning Set 是课程事实与静态学习资产的本地目录。M0 使用严格解析：路径、父子身份、状态、Tree 元数据或 Lesson 区块不符合契约时直接报错，不猜测、不兼容旧格式。

## 最小目录

```text
learning-set/
├── LEARNING_GUIDE.md
├── ROADMAP.md
├── plans/
│   └── <plan-id>/
│       ├── PLAN.md
│       └── lessons/<lesson-id>.md
├── cards/
├── graph/
└── materials/
```

Lesson 必须位于所属 Plan 的 `lessons/` 内。不要再建立根级 `lessons/`。父节点只读取 Tree 中明确链接的子文档；把文件放进目录但不挂到 Tree，不会让它成为课程记忆。

ID 使用字母或数字开头，后续可含字母、数字、点、下划线和连字符。Plan ID 在 Roadmap 中唯一；Lesson ID 在所属 Plan 中唯一。路径不能是绝对路径、不能包含反斜杠或逃逸 Learning Set。

## Roadmap

```yaml
---
id: roadmap
kind: roadmap
status: active
session_id: null
---
```

正文必须有一个一级标题，并各有一个非空二级章节：`Overview`、`Long-term Goal`、`Observable Capability Standard`、`Test`、`Plan Tree`、`Current Position`。`Plan Tree` 可以为空。每条链接必须带 `After` 与 `Depends on`：

```markdown
- [plan-001 | 阶段标题](plans/plan-001/PLAN.md)
  - After:
  - Depends on:
```

Roadmap 永远是 `active`，负责长期能力方向和学生确认后的未来 Plan。

## Plan

```yaml
---
id: plan-001
kind: plan
status: prepared
parent_id: roadmap
parent_path: ROADMAP.md
session_id: null
---
```

Plan 状态只有 `prepared → active → completed`。正文必须包含：一级标题、`Stage Goal`、`Observable Capability Standard`、`Test`、`Lesson Tree`、`Current Position`、`Next Lesson Arrangement`。Lesson Tree 同样可为空，条目格式为：

```markdown
- [lesson-001 | 课堂标题](plans/plan-001/lessons/lesson-001.md)
  - After:
  - Depends on:
```

Plan 只创建或修改自己的 `prepared` Lesson。后续安排可依据已关闭 Lesson 调整，但 Coach 以建议和讨论为主，学生保留决定权。

## Lesson 与 Block

```yaml
---
id: lesson-001
kind: lesson
status: prepared
parent_id: plan-001
parent_path: plans/plan-001/PLAN.md
session_id: null
---
```

Lesson 状态只有 `prepared → active → closed`。正文先写一级标题和唯一的 `Lesson Goal`，再写至少一个 Block：

```markdown
## Block block-001：活动名称

### Node State

- Kind: dialogue
- Required: true
- Status: pending
- Depends on:
- Uses:

### Student View

学生当前可见的题目、材料或问题。

### Teacher Control

备课意图、观察点与支架边界；普通课堂视图不展示。

### Classroom Log
```

`Kind` 只能是 `dialogue | problem | material | reflection`；Block 状态只能是 `pending | active | completed | skipped`。`Required` 必须是 `true` 或 `false`。`Depends on` 与 `Uses` 是逗号分隔列表，空值保留字段名。依赖必须指向同 Lesson 内的其他 Block，不得自指或成环。

`Student View` 与 `Teacher Control` 必须非空。`Classroom Log` 必须存在，可以为空；有内容时每条事实使用 Markdown 列表项。课堂过程只追加真实发生的回答、提示、纠正与决定，不把后来总结伪装成当时事实。

## 静态学习资产

- `LEARNING_GUIDE.md` 给出本学习集的目标、范围与教学原则。
- `cards/` 保存 `highschool-study.problem-card.v1` YAML；`graph` 字段可为 Material Scout 提供规范目标、方法和结构特征。
- `graph/method_tree.yaml` 使用 `studyforge.method_tree.v1`，且必须只有一个根节点。
- `materials/` 可保存 Markdown、PDF、图片或媒体。进入课程前仍需核对来源、许可证和教学风险。

静态资产本身不是学生掌握证据。题卡被放进目录、被 Scout 看到或被写入 `Uses`，都不代表学生已经做过或学会。

## 隐私、来源与版本控制

公开 Git 中只放可再分发、来源可追溯的学习资产。每个题目、图片、教材节选和生成资产都要记录 provenance 与许可证。真实未成年学生记录、可识别课堂转录、Pi Session、模型凭证和派生画像必须留在访问受控的私有存储，不进入公开 commit、Issue、fixture 或示例包。

当前私有 beta 评估集不是公开模板；法律边界见[第三方说明](../../THIRD_PARTY_NOTICES.md)。创建新学习集时从最小空树开始，让 Roadmap 与学生先讨论，再物化第一个 Plan。
