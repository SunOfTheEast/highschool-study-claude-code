# StudyForge M0 唯一文档契约设计

**状态：** 待书面确认  
**日期：** 2026-08-02  
**方案：** A——保留原生文件工具，补齐唯一、可复制的持久化格式契约

## 1. 问题证据

M0 的真实模型周期尚未进入第一节课，已经出现三类资源与文档装配故障：

1. Pi 全局安装的旧 StudyForge Skill 覆盖了 M0 同名 Skill；该问题已通过只加载
   当前节点显式 Skill 修复。
2. Roadmap 同时受到“安排 Lesson Tree”和“Lesson 只能由 Plan 创建”两条相反提示，
   生成了不存在的 Lesson 链接；职责现已统一为 Roadmap 只创建 Plan。
3. 清空示例占位节点后，模型失去了格式范例。它能完成问诊和六课教学设计，却把
   Roadmap Tree 写成普通 Markdown 链接，并生成缺少 `parent_id`、`parent_path`、
   `session_id` 且章节名不符合解析器的 Plan。

第三类不是教学判断错误，也不是模型不会组织内容，而是持久化接口没有完整暴露给
写入者。严格解析器要求一种语法，Agent 静态上下文却没有提供那种语法。

## 2. 目标

让 Roadmap、Plan、Lesson Agent 在不增加领域工具的情况下，能够用 Pi 原生文件工具
稳定创建和更新可解析的节点文档。

成功标准：

- Roadmap 能创建一个 `prepared` Plan，并以合法 Tree 条目挂入 `ROADMAP.md`；
- 新 Plan 的 `Lesson Tree` 可以字面为空；
- Plan 能先创建合法 `prepared` Lesson，再把合法 Tree 条目挂入 Plan；
- 每次写入后 `/api/course` 仍返回 200；
- 模型工具面仍严格等于 `read`、`grep`、`find`、`ls`、`edit`、`write`；
- 不重新引入 Trace、Handoff、投影、权限门或兼容层。

## 3. 决策

新增一个静态资源：

```text
apps/pi-teaching-web/resources/contracts/m0-document-contract.md
```

资源加载器把它作为只读 Agent 文件注入所有三类节点 Session，使用固定虚拟路径：

```text
/virtual/studyforge-m0-document-contract.md
```

它是 M0 持久化语法的唯一说明来源。Skills 只拥有教学行为和节点职责，不再分别复制
一套 frontmatter、章节与 Tree 语法。

## 4. 契约内容

契约只包含模型实际需要写入的结构，不解释旧版本，也不枚举历史错误。

### 4.1 Tree 条目

Roadmap 挂 Plan：

```markdown
- [plan-001 | 阶段标题](plans/plan-001.md)
  - After:
  - Depends on:
```

Plan 挂 Lesson：

```markdown
- [lesson-001 | 课程标题](lessons/lesson-001.md)
  - After:
  - Depends on:
```

Tree 章节允许没有任何条目。空树是标题与下一标题之间零文本，不能放说明、注释、
占位符或尚不存在的路径。

### 4.2 Plan 模板

模板固定包含：

- `id`、`kind: plan`、`status: prepared`；
- `parent_id: roadmap`、`parent_path: ROADMAP.md`、`session_id: null`；
- `Stage Goal`；
- `Observable Capability Standard`；
- `Test`；
- `Lesson Tree`；
- `Current Position`；
- `Next Lesson Arrangement`。

不使用 `Direct Test`、`Entry Notes` 等替代标题。起点假设或学习约束写进现有语义章节，
不创建新的持久化区域。

### 4.3 Lesson 模板

模板固定包含：

- `id`、`kind: lesson`、`status: prepared`；
- `parent_id`、`parent_path`、`session_id: null`；
- 标题和 `Lesson Goal`；
- 至少一个合法 Block；
- 每个 Block 恰好包含 `Node State`、`Student View`、`Teacher Control`、
  `Classroom Log`。

Block 的枚举和字段沿用现有 M0 契约，不新增事件 ID、证据等级或摘要字段。

### 4.4 写入顺序

创建子节点必须按以下顺序执行：

```text
write 完整子文件
→ read 子文件确认身份与章节
→ edit 父节点 Tree 加入链接
→ read 父节点
```

父节点 Tree 中出现一个链接，就表示对应文件已经存在且可被严格解析器读取。不能先挂
链接再补文件，也不能预挂未来六节课的空路径。尚未物化的课程弧线继续保留在
`Next Lesson Arrangement` prose 中。

## 5. 上下文与复杂度

这份契约预计不足一千个中文 token，三类 Session 各注入一次。它会替代散落在 Skills
中的格式说明，因此净新增上下文很小，并减少相同语义在多处漂移的风险。

运行时只多读取一个静态文件；没有新状态、数据库、后台任务或工具 schema。模型仍然
拥有 Markdown 表达自由，但持久化骨架不再靠猜。

## 6. 验证

自动化验证：

1. 资源装配测试确认三类节点都只收到这份 M0 契约和各自指定 Skills；
2. 现有解析测试继续覆盖空 Tree、合法 Plan/Lesson、错误路径和非法章节；
3. 完整 `bun run check` 与浏览器 E2E 通过。

真实验证重新使用全新学习集副本：

```text
Roadmap 问诊
→ 创建首个六课 Plan
→ /api/course = 200
→ 开始 Plan
→ Plan 创建首节 Lesson
→ /api/course = 200
→ 开始真实课堂
```

若带完整契约后，在两个全新节点创建中仍重复出现结构性损坏，本方案判定失败。不继续
扩写提示词，转而单独讨论最小确定性节点创建工具；该工具不在本设计范围内。

## 7. 非目标

- 不让解析器接受任意普通 Markdown；
- 不把文档模板变成复杂 DSL；
- 不新增 `plan_create`、`lesson_create` 或其他领域工具；
- 不恢复旧记忆与证据系统；
- 不在这一步优化教学内容或前端；
- 不为旧学习集提供兼容迁移。

## 8. 自审结论

- 没有 TBD、兼容分支或隐藏扩展范围；
- 单一静态契约与 M0 的低复杂度方向一致；
- 失败退出条件明确，避免继续用提示词无限打补丁；
- 唯一新增成本是每个节点 Session 的一小段结构说明，换取可运行的持久化接口。
