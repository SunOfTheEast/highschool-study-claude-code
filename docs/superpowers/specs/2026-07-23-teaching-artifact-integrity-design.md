# 教学产物发布与 Session 所有权设计

状态：讨论通过，书面自审完成，待用户复核

日期：2026-07-23

## 一、问题

真实课程暴露出的四个现象可以统一抽象为：

> LLM 生成的可执行 Markdown 产物未经注册、准入校验和所有权确认，就直接
> 进入了运行时。

Plan 与 Lesson 不是普通文章，而是同时承载内容、引用和运行控制的半结构化
产物。Coach 写出的文件目前会直接进入前端索引和 Tutor Session，运行时没有
检查“它是否已经成为一份可上课的教学产物”。

1. Coach 写出了新 Plan，却没有把它登记到 `ROADMAP.md / Plan Graph`，因此
   首页无法看见它。
2. 新 Plan 复制了旧 Plan 的 `coach_session`，运行时只按 Session ID 查找文件，
   因而把旧 Coach 历史接到了新 Plan。
3. Lesson Block 的 `Uses` 引用了题卡，但没有对应的 `## Aliases`。Tutor
   无法写 Trace，随后通过搜索和猜测不断重试。
4. 名为 `reflection` 的 Block 实际写成了 `Kind: dialogue`。Tutor 无法调用
   `lesson_close`，重试失败后却仍在聊天里声称已经结课。

这不是题卡、Trace 或 Pi Session 本身失效，也不需要增加一个通用规则引擎。
本设计采用四个小原语：

```text
register → validate → bind-owner → commit-receipt
```

- Plan 从文件变成 Roadmap 可见节点时显式注册；
- Lesson 从 `prepared` 变成 `active` 时执行准入校验；
- Session 使用运行时 owner 元数据绑定到 Plan 或 Lesson；
- Agent 只能根据写工具的成功回执宣布事实已经落盘。

教学目标、课堂顺序和评价仍由 Skill 与 Agent 决定。

### 开源模式来源

- [Backstage Software Catalog](https://backstage.io/docs/features/software-catalog/life-of-an-entity/)
  将源文件经过注册、处理和关系拼接后才作为最终实体对外可见；
- [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/)
  在内容被查询和渲染前校验 schema 与引用；
- [Kubernetes Validating Admission Policy](https://kubernetes.io/docs/reference/access-authn-authz/validating-admission-policy/)
  在对象进入运行阶段前接受或拒绝，但不负责替作者改写对象；
- [Kubernetes OwnerReference](https://kubernetes.io/docs/concepts/overview/working-with-objects/owners-dependents/)
  使用独立身份信息确认 owner，避免组件操作不属于自己的对象；
- [Pi Session custom entry](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/session-format.md)
  可以持久化扩展状态且不进入 LLM 上下文；
- [PydanticAI MCP error behavior](https://pydantic.dev/docs/ai/api/pydantic-ai/mcp/)
  区分重试、失败回传与直接传播工具错误。

本设计只借用这些边界，不引入它们的数据库、控制器或完整内容编译系统。

## 二、目标与非目标

### 目标

- 新 Plan 只有在写入 Roadmap 后才算创建完成。
- frontmatter 中的 Session ID 只有其 Pi custom owner 与当前 Plan 或 Lesson
  完全一致时才可复用。
- 缺少题卡 alias 或合法 Reflection Block 的 Lesson 不能启动 Tutor。
- 明确区分可修正的工具参数错误和不可重试的教学产物结构错误。
- Tutor 只有在事实成功落盘后，才能声称 Trace 已记录或 Lesson 已关闭。
- 保持 Markdown-first、两个 Agent 和现有 Session 层级不变。

### 非目标

- 不新增数据库、索引服务、状态机、裁判 Agent 或通用规则引擎。
- 不把 Plan/Lesson 创作改造成一套完整结构化表单或 DSL。
- 不迁移历史 Markdown，不增加旧格式兼容分支。
- 不修改题卡、Trace、能力投影或一题多解的语义。
- 不借此重构无关前端、路由或 Pi runtime。

## 三、原则：Skill 负责教学语义，运行时只检查机械事实

Skill 继续决定：

- 为什么建立这个 Plan；
- Lesson 用哪些积木、题卡和提示策略；
- Reflection 问什么；
- 学生表现应如何评价。

运行时只判断无需教学推理的事实：

- Plan 文件是否存在、ID 是否一致、Roadmap 是否已经链接它；
- Session 内的 custom owner 是否与当前 scope 完全一致；
- 按当前契约作为题卡引用的 `Uses` alias 是否有声明并能解析为真实题卡；
- 是否恰有一个显式写成 `Kind: reflection` 的 Block；
- 结课所需的顶层章节是否存在。

这些检查相当于 Markdown 的轻量类型检查，不推断教学相关性，也不自动修补
Coach 的内容。

只有“缺失后运行时无法正确执行”的条件才阻断：

- 缺 alias、alias 不能解析、缺唯一 Reflection Block、缺结课章节：阻断；
- 题量、课堂节奏、提示策略、教学相关性：不阻断，继续由 Coach Skill 判断。

## 四、Plan 注册

### 4.1 Coach 工具

Pi Coach 新增一个 Session 可见工具：

```ts
plan_register({
  planId: string
})
```

模型只填写 `planId`。运行时固定从当前 learning set 推导
`plans/<planId>.md`，不接受模型提供文件路径或 Session ID。

工具依次完成：

1. 读取 `plans/<planId>.md`；
2. 校验 frontmatter 的 `kind: plan` 和 `id === planId`；
3. 从一级标题读取真实 Plan 标题；
4. 如果 `ROADMAP.md / Plan Graph` 尚未链接该规范路径，追加一个链接；
5. 校验 Plan 中已有的 `coach_session` 是否包含与该 Plan 完全一致的
   StudyForge custom owner；不属于则写为 YAML `null`；
6. 重读 `ROADMAP.md`，返回规范 Plan 摘要。

重复调用是幂等的：不得产生第二条同路径链接，也不得清除一个 owner 匹配的
有效 Coach Session。

工具成功返回前，Coach 不得告诉学生“Plan 已创建”。新 Plan 的建议创作顺序
固定为：

```text
写 plans/<planId>.md（coach_session: null）
  → plan_register({ planId })
  → 重读 ROADMAP.md
  → 告知学生新 Plan 已可进入
```

### 4.2 Roadmap 写入边界

注册函数只操作 `## Plan Graph`：

- 以规范相对路径 `plans/<planId>.md` 判重；
- 使用 Plan 的真实标题生成 Markdown 链接；
- 不重排、不重写现有 Plan 描述；
- `Plan Graph` 不存在或 Plan 文件无效时直接失败，不猜章节。

### 4.3 首页刷新

前端每次进入 `/` 时重新请求 `/api/learning-set`，再渲染首页。这样
`plan_register` 写入 Roadmap 后，学生返回首页即可看到新 Plan；不新增一套
Roadmap 专用事件协议。

## 五、Session 所有权校验

Pi 的 `SessionInfoEntry.name` 是展示名称，用户或扩展可以修改，不承担身份
语义。StudyForge 改用 Pi 原生、不会进入模型上下文的 custom entry：

```ts
const SESSION_OWNER_TYPE = 'studyforge.session-owner.v1';

type SessionOwner = {
  role: 'coach' | 'tutor';
  ownerId: string;
  ownerPath: string;
};
```

新建 Session 时，运行时在设置展示名称之外追加一次：

```ts
manager.appendCustomEntry(SESSION_OWNER_TYPE, {
  role,
  ownerId,
  ownerPath,
});
```

打开已存 Session 时：

1. 从 owner Markdown 读取已有 Session ID；
2. 用 `SessionManager.list(root)` 找到同 ID 的文件；
3. 打开该文件并读取 `studyforge.session-owner.v1` custom entry；
4. 只有它恰有一条且 `role + ownerId + ownerPath` 全部匹配时才复用；
5. ID 不存在、owner 缺失、重复或不匹配时，忽略旧 ID 并新建 Session；
6. 新建后把真实 Session ID 写回 owner frontmatter。

这个规则同时作用于 Coach 和 Tutor。它不解析聊天内容，也不复制或迁移旧
Session。错误引用的 JSONL 仍原样保留，只是不再挂到错误的教学对象上。
旧 Session 没有 owner entry 时直接新建；本设计不增加名称回退兼容。

`Coach · <planId>` 与 `Tutor · <lessonId>` 仍保留为界面展示名称，但不再参与
所有权判断。

## 六、Prepared Lesson 校验

`WorkspaceRegistry.startLesson()` 在任何状态写入和 Tutor 创建之前，对
`status: prepared` 的 Lesson 调用：

```ts
validatePreparedLesson(root, lessonPath)
```

校验范围固定为以下四项：

1. 存在顶层 `## Aliases`、`## Reflection`、`## Lesson Summary` 和
   `## Traces`；
2. 每个 Block 的非空 `Uses` 项都在 `## Aliases` 中精确声明；
3. 每个被使用的 alias 都能从 Lesson 相对路径解析到真实 problem card；
4. 全课恰有一个 Block 的 Node State 显式包含 `Kind: reflection`。

这里沿用当前 Lesson/学生课堂本的契约：`Uses` 是题卡 alias；视频、讲义等
材料仍由 material Block 的内容与来源链接承载。本次不顺手扩展材料 schema。

Block 名叫 `reflection` 不能替代第四项。当前读取投影可继续把该名字显示为
Reflection，但启动校验必须读取原始 Node State，和 `lesson_close` 的真实
要求一致。

校验失败时：

- Lesson 保持 `prepared`；
- 不写 `status: active`；
- 不创建或复用 Tutor Session；
- 启动 API 返回 `PREPARED_LESSON_INVALID` 和具体问题列表；
- 前端提示“这节课还没备完整”，列出问题并让学生返回 Coach 修改。

`paused` Lesson 已经通过过启动边界，恢复时不重复校验。

## 七、结构错误与 Agent 行为

即使文件在启动后被手工修改，写工具仍需给出可行动的错误。

错误只分两类，不建立通用错误策略引擎：

- 参数缺失、枚举错误等模型可以就地修正的问题：允许现有的一次重试；
- `LESSON_*` 教学产物结构错误：不可重试，返回 Coach 修正源文件。

### 7.1 Trace alias

缺少 alias 时，`trace_append` 错误至少包含：

- 稳定码 `LESSON_ALIAS_MISSING`；
- Tutor 请求的 alias；
- 当前 Lesson 允许的 alias 列表；
- 明确指令：这是 Lesson 结构错误，不要搜索、猜测或改用相近名称。

alias 存在但不能解析到真实题卡时使用独立稳定码
`LESSON_ALIAS_INVALID`，并返回 alias 与目标路径。

### 7.2 Reflection 关闭

`lesson_close` 找不到唯一 active Reflection Block 时，错误至少包含：

- 稳定码 `LESSON_REFLECTION_NOT_ACTIVE`；
- 当前 active Block 的 ID 与实际 Kind；
- 期望条件：恰有一个 `Kind: reflection` 且 `Status: active` 的 Block。

### 7.3 Tutor fail-stop

Tutor Skill 增加一条窄规则：

- 上述 `LESSON_*` 错误属于备课结构错误，不是参数填写错误；
- 不调用 `card_search`、`trace_search` 或文件搜索来猜替代值；
- 不重复同一个失败调用；
- 明确告诉学生本次事实尚未落盘，并请返回 Coach 修正；
- `trace_append` 成功前不得声称证据已记录；
- `lesson_close` 成功前不得声称课程已正式结束。

普通的模型参数错误仍沿用现有一次修正机会，本设计不增加全局重试门。

### 7.4 成功回执

所有事实写工具成功后都返回最小规范回执：

```ts
{ ok: true, ownerPath: string, factId?: string, status?: string }
```

- `plan_register` 返回注册后的 Plan path；
- `trace_append` 返回真实 event ID 与 Lesson path；
- `lesson_close` 返回真实 Lesson path 与 `status: closed`。

Coach/Tutor 只能依据成功回执宣布“已创建”“已记录”或“已结课”。抛错、空
结果或缺少 `ok: true` 均表示事实尚未落盘。这里不增加输出拦截器，只把现有
工具回执统一为清晰契约并写入 Skill。

## 八、Skill 修改

### Coach

备课 Skill 补充两个完成条件：

- 新 Plan 使用 `coach_session: null`，并在 `plan_register` 成功、重读
  Roadmap 后才宣布创建完成；
- 宣布 Lesson “可以上课”前，确认四个顶层章节、所有 `Uses → Aliases`
  映射和唯一 `Kind: reflection` Block 均已写入。

### Tutor

Tutor Skill 只增加第七节的结构错误 fail-stop 与“成功落盘后再宣称完成”。
不增加新的教学门、提示层级或评价规则。

纯 Skill 文本按仓库约定不编写措辞测试。

## 九、实现位置

预计只触及以下现有边界：

- `apps/pi-teaching-web/src/study/write-workspace.ts`
  - Roadmap Plan 注册写入；
- `apps/pi-teaching-web/src/study/`
  - Prepared Lesson 结构校验；
- `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
  - 启动前校验与 Session custom owner 所有权；
- `apps/pi-teaching-web/src/runtime/`
  - `plan_register`、Session owner helper、成功回执及可行动工具错误；
- `apps/pi-teaching-web/src/runtime/session-factory.ts`
  - Coach 工具注册；
- `apps/pi-teaching-web/src/server/app.ts`
  - Lesson 校验错误响应；
- `apps/pi-teaching-web/src/client/App.tsx`
  - 首页重取与启动错误展示；
- `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`；
- `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`。

若 Claude Code 插件中存在同一条备课或课堂规则，只同步 Skill 语义；公共 MCP
仍严格保持四个工具，不发布 `plan_register`。

## 十、验证

只为可执行契约增加聚焦测试：

1. `plan_register` 将真实 Plan 链接写入 Roadmap，重复调用不重复；
2. 新 Plan 中复制来的旧 Session ID 被清空或在打开时被拒绝；
3. 正确 ID 但 owner 缺失、重复或任一字段不匹配时不会被 Coach 或 Tutor
   复用；显示名称不参与判断；
4. 缺 alias、alias 目标无效、Reflection Kind 错误时，Lesson 启动失败且
   文件仍为 `prepared`；
5. 合法 Lesson 能正常变为 `active` 并创建 Tutor；
6. Trace 与 Reflection 结构错误返回稳定码和实际允许值；
7. 成功写工具返回规范回执，失败时不返回 `ok: true`；
8. 返回首页后能看见刚注册的 Plan。

最后运行 `apps/pi-teaching-web` 的 `bun run check`。只有前端首页刷新与启动
错误展示需要补充已有 E2E；Skill 文本不做测试。

## 十一、验收标准

在一份复制的导数学习集中执行一次最短真实流程：

1. Coach 新建 Plan，并通过 `plan_register` 出现在首页；
2. 即使 Plan 误带旧 `coach_session`，custom owner 不匹配时也得到独立
   Coach 历史；新 Session JSONL 中存在正确 owner entry；
3. 故意准备一份缺 alias 或 Reflection Kind 错误的 Lesson，点击开始后被
   阻止，文件状态不变；
4. Coach 修正后再次开始，Tutor 能写入 Trace；
5. 激活 Reflection 并关闭 Lesson，只有 `lesson_close` 成功后 Tutor 才宣布
   正式结束。

这五步通过即证明四个真实问题都在正确边界被解决，而不是依赖下一次模型
“刚好写对”。
