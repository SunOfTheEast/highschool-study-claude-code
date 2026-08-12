# StudyForge 发布可用性收口实施计划

> **实施方式：** 当前会话内按任务顺序执行。每个任务先写失败测试，再做最小实现；每批通过聚焦测试后提交一次。不得改动用户已有的无关脏文件。

**目标：** 以 `docs/audits/2026-08-12-student-experience-release-audit.md` 为唯一产品依据，修完 7.1–7.3 的发布阻塞、资料阅读小缺陷和两项上下文结构债；不把书籍来源主路、PDF 阅读器、标签治理或新的学习事实塞进本轮。

**架构原则：** 学习事实仍由现有 Markdown/YAML、原生 Pi Session、复习事件与语义 sidecar 拥有。前端只增加可见投影和人类入口；Runtime 只增加机械信息，不替模型做语义判断。复习候选规模与模型正文上下文解耦；常驻教学核心只保留跨学科原则。

**技术栈：** TypeScript、React、Bun test、Vite、Tauri、Pi Agent Runtime。

---

## Task 0：冻结实施依据，消除文档左右互搏

**文件：**
- 修改：`docs/superpowers/specs/2026-08-12-student-value-loop-release-closure-design.md`
- 新建：`docs/superpowers/plans/2026-08-12-release-usability-closure.md`

1. 在旧候选设计顶部标明“已失效”，明确列出被撤回的三项：保存与复习拆开、固定五项、新增诊断 Skill。
2. 把本计划与总审计设为本轮唯一实施入口；不重写旧文档正文，以便保留决策过程。
3. 检查 E-18、完整 PDF 阅读器、标签治理、新 schema、移动端和跨学习集画像只作为明确排除项出现，不成为本轮实现任务。

**验证：**

```bash
rg -n "已失效|唯一实施依据" docs/superpowers/specs/2026-08-12-student-value-loop-release-closure-design.md
rg -n "不把书籍来源主路|不在本提交实现|不得改动用户已有的无关脏文件" docs/superpowers/plans/2026-08-12-release-usability-closure.md
```

## Task 1：修复 OAuth 后推荐模型回填，并公开数据边界

**文件：**
- 修改：`apps/pi-teaching-web/src/client/desktop/ModelSettings.tsx`
- 修改：`apps/pi-teaching-web/src/client/desktop/FirstRun.tsx`
- 修改：`apps/pi-teaching-web/resources/help/first-learning.md`
- 修改：`apps/pi-teaching-web/resources/help/macos-installation.md`
- 测试：`apps/pi-teaching-web/tests/e2e/desktop-onboarding.spec.ts`
- 测试：`apps/pi-teaching-web/tests/desktop/desktop-ui.test.tsx`
- 测试：`apps/pi-teaching-web/tests/desktop/help-content.test.ts`

1. 扩展现有 OAuth E2E：模型目录初始为空，页面内 OAuth 完成后目录刷新；首次设置应自动出现 `gpt-5.6-sol/high` 与 `gpt-5.6-terra/high`，按钮可直接完成并进入首页。
2. 在 `ModelSettings` 中分别跟踪教师和 Scout 字段是否被学生手动碰过。目录变化时只回填“尚未手动修改且当前为空”的字段；不得覆盖已经保存或手选的模型。
3. First Run 与两份帮助文档使用同一事实边界：学习文件保存在本机；发消息时，本轮消息及回答所需的相关内容由学生选择的模型服务处理；不会无条件上传整个学习集。
4. 跑聚焦测试并提交。

**验证：**

```bash
cd apps/pi-teaching-web
bun test tests/desktop/desktop-ui.test.tsx tests/desktop/help-content.test.ts
bun run test:e2e -- tests/e2e/desktop-onboarding.spec.ts
```

## Task 2：让失败可见、等待状态真实且不重复

**文件：**
- 修改：`apps/pi-teaching-web/src/client/components/CalendarDayPanel.tsx`
- 修改：`apps/pi-teaching-web/src/client/pages/AssetsPage.tsx`
- 修改：`apps/pi-teaching-web/src/client/conversation-presentation.ts`
- 修改：`apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- 测试：`apps/pi-teaching-web/tests/m2/calendar-ui.test.tsx`
- 测试：`apps/pi-teaching-web/tests/m2/calendar-review-candidates.test.tsx`
- 测试：`apps/pi-teaching-web/tests/m1d/entry-and-dialogue-ui.test.tsx`
- 测试：`apps/pi-teaching-web/tests/m0/course-ui.test.tsx`

1. 先写日历创建、修改、删除、打开与立即复习 promise 拒绝时的组件测试：页面显示经 `publicErrorText` 清洗的可行动错误，不泄露内部标识，也不静默无响应。
2. 在 `CalendarDayPanel` 中只增加一个本地 `runAction` 包装器与一个错误状态；所有异步按钮复用它，不造全局错误框架。
3. 为 Material 导入补同样的可见失败回执；成功后仍清空表单。
4. 为对话工具进度加入 Session 语境：学习记录、材料检索、课程安排、资产保存分别使用真实发生的短文案；合并连续同类活动，不显示百分比，不让模型额外生成进度。
5. 跑聚焦测试并提交。

**验证：**

```bash
cd apps/pi-teaching-web
bun test tests/m2/calendar-ui.test.tsx tests/m2/calendar-review-candidates.test.tsx \
  tests/m1d/entry-and-dialogue-ui.test.tsx tests/m0/course-ui.test.tsx
```

## Task 3：资料架本地查找与保存复习回执

**文件：**
- 新建：`apps/pi-teaching-web/src/client/asset-library-filter.ts`
- 修改：`apps/pi-teaching-web/src/shared/contracts.ts`
- 修改：`apps/pi-teaching-web/src/study/learning-assets.ts`
- 修改：`apps/pi-teaching-web/src/client/pages/AssetsPage.tsx`
- 修改：`apps/pi-teaching-web/src/runtime/learning-asset-tools.ts`
- 修改：`apps/pi-teaching-web/src/projection/learning-asset-proposal.ts`
- 修改：`apps/pi-teaching-web/src/client/components/LearningAssetProposal.tsx`
- 测试：`apps/pi-teaching-web/tests/m1b/m1b-ui.test.tsx`
- 测试：`apps/pi-teaching-web/tests/m1c/m1c-ui.test.tsx`
- 测试：`apps/pi-teaching-web/tests/m2/learning-asset-proposals.test.tsx`

1. 先为纯过滤函数写测试：标题、学生可见正文、来源名与标签可命中；题卡标准答案、教师依据与 Recall 答案不可进入搜索投影；筛选不清掉已有多选。
2. 给 `LearningAssetSummary` 增加学生安全的 `searchText`。Note 只投影 Markdown 正文与 Recall 提示；题卡只投影题干与学生笔记。资料标题和原文件名由客户端同一输入筛选。
3. 在资料架增加一个朴素搜索框和可点击的现有标签筛选；不做语义排序、推荐或新的索引文件。读取仍复用一次服务端 library projection，筛选时不得再次读 519 张文件。
4. 扩展 save tool 的机械回执，明确本次是否是“新资产并已加入复习”。投影成功回执显示“已加入复习，明天首次出现”；修订资产只显示已保存。不得改变自动入队语义。
5. 跑聚焦测试并提交。

**验证：**

```bash
cd apps/pi-teaching-web
bun test tests/m1b/m1b-ui.test.tsx tests/m1c/m1c-ui.test.tsx \
  tests/m2/learning-asset-proposals.test.tsx
```

## Task 4：把 Material 定位从内部语法换成人类入口

**文件：**
- 修改：`apps/pi-teaching-web/src/client/pages/MaterialPage.tsx`
- 修改：`apps/pi-teaching-web/src/client/styles/m1c.css`
- 测试：`apps/pi-teaching-web/tests/m1c/m1c-ui.test.tsx`
- 测试：`apps/pi-teaching-web/tests/m1d/asset-detail-ui.test.tsx`

1. 将现有“Canonical locator”测试改成学生行为测试：PDF 显示页码输入与上一页/下一页；文本显示起止行与上一段/下一段；内部 `page-0062` 或 `lines-10-20` 仍由组件机械生成并传给 API，但不显示给学生。
2. 删除 canonical code 展示与自由文本输入。保留读取失败时的上一份成功内容。
3. 若桌面已有安全的“打开原件”接口则直接接入；若没有，本任务只保留页码/段落入口，不为一个按钮扩张 Tauri 权限面。
4. 跑聚焦测试并提交。

**验证：**

```bash
cd apps/pi-teaching-web
bun test tests/m1c/m1c-ui.test.tsx tests/m1d/asset-detail-ui.test.tsx
```

## Task 5：Note 预览与学生安全的内容历史

**文件：**
- 修改：`apps/pi-teaching-web/src/shared/contracts.ts`
- 修改：`apps/pi-teaching-web/src/study/learning-assets.ts`
- 修改：`apps/pi-teaching-web/src/server/app.ts`
- 修改：`apps/pi-teaching-web/src/client/pages/NotePage.tsx`
- 修改：`apps/pi-teaching-web/src/client/pages/ProblemCardPage.tsx`
- 修改：`apps/pi-teaching-web/src/client/styles/m1b.css`
- 测试：`apps/pi-teaching-web/tests/m1b/learning-assets.test.ts`
- 测试：`apps/pi-teaching-web/tests/m1d/asset-detail-ui.test.tsx`
- 测试：`apps/pi-teaching-web/tests/m1b/server-api.test.ts`
- 测试：`apps/pi-teaching-web/tests/m1c/server-api.test.ts`

1. 先写读取历史测试：只枚举当前资产自己的不可变 archive；按 revision 排序；legacy 题卡只有当前版本；不得读取目录中无关资产。
2. 在 Note 编辑器加入“编辑 / 预览”切换，预览当前未保存草稿的 Markdown 与 Recall 块。
3. 给 Note 和题卡的学生 view 增加只读 `contentHistory`。Note 历史包含标题与块；题卡历史只包含题干与学生笔记，不把 `teacherRationale` 暴露给客户端，历史答案也不绕过当前答案门。
4. 页面用折叠的“内容历史”展示旧版本，明确这是内容版本，不称为认知演变。
5. 跑聚焦测试并提交。

**验证：**

```bash
cd apps/pi-teaching-web
bun test tests/m1b/learning-assets.test.ts tests/m1d/asset-detail-ui.test.tsx
```

## Task 6：把已有关系带回资产详情页

**文件：**
- 修改：`apps/pi-teaching-web/src/client/semantic-graph.ts`
- 修改：`apps/pi-teaching-web/src/client/App.tsx`
- 修改：`apps/pi-teaching-web/src/client/pages/NotePage.tsx`
- 修改：`apps/pi-teaching-web/src/client/pages/ProblemCardPage.tsx`
- 修改：`apps/pi-teaching-web/src/client/styles/m1d.css`
- 测试：`apps/pi-teaching-web/tests/m1d/semantic-graph.test.tsx`
- 测试：`apps/pi-teaching-web/tests/m1d/asset-detail-ui.test.tsx`

1. 导出纯函数：基于当前 asset summary 与现有平坦标签返回最多三项可解释邻居；稳定排序沿用图谱逻辑。
2. App 打开 Note/题卡时取得现有 library 与 relations 投影，不新增关系事实。
3. 标签点击进入 `/knowledge?focus=tag:<标签>`；详情页展示“共享 ×× 标签”的 2–3 项并允许打开。禁止写成相似、推荐、先修、因果或掌握。
4. 跑聚焦测试并提交。

**验证：**

```bash
cd apps/pi-teaching-web
bun test tests/m1d/semantic-graph.test.tsx tests/m1d/asset-detail-ui.test.tsx
```

## Task 7：直接复习进入足迹

**文件：**
- 修改：`apps/pi-teaching-web/src/shared/contracts.ts`
- 修改：`apps/pi-teaching-web/src/study/learning-footprint.ts`
- 修改：`apps/pi-teaching-web/src/client/pages/FootprintPage.tsx`
- 测试：`apps/pi-teaching-web/tests/m1c/learning-footprint.test.ts`
- 测试：`apps/pi-teaching-web/tests/m1c/m1c-ui.test.tsx`

1. 先写事件投影测试：只投影有效 `reviewed`；最新 `corrected` 覆盖原结果，replacement 为 null 时移除；enrolled/removed/restarted 不进入足迹。
2. 为足迹增加 `asset-review` 来源和“复习结果”活动，文案为“没想起 / 吃力 / 顺利”，路线回到对应资产。
3. 不把专注计时或赴约打开冒充学习活动。
4. 跑聚焦测试并提交。

**验证：**

```bash
cd apps/pi-teaching-web
bun test tests/m1c/learning-footprint.test.ts tests/m1c/m1c-ui.test.tsx
```

## Task 8：标准 / 大字与高阶方法自然入口

**文件：**
- 新建：`apps/pi-teaching-web/src/client/readability.ts`
- 修改：`apps/pi-teaching-web/src/client/main.tsx`
- 修改：`apps/pi-teaching-web/src/client/desktop/ModelSettings.tsx`
- 修改：`apps/pi-teaching-web/src/client/theme-liubai.css`
- 修改：`apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- 修改：`apps/pi-teaching-web/resources/help/first-learning.md`
- 测试：`apps/pi-teaching-web/tests/desktop/desktop-ui.test.tsx`
- 测试：`apps/pi-teaching-web/tests/m1d/entry-and-dialogue-ui.test.tsx`
- 测试：`apps/pi-teaching-web/tests/m1d/visual-grammar.test.tsx`

1. 先写偏好测试：标准/大字写入本机 localStorage，并只通过根 `data-reading-size` 改 token；不使用整页 `transform`。
2. 收口字号下限：正文不低于 16px，重要按钮/标签不低于 14px，真实辅助说明不低于 13px；11/12px 只留装饰信息。两档都保持课程、图谱、日历和资产布局。
3. Free Learning 仅在空对话展示五个普通说法。点击只把文字填入输入框，不自动发送，也不显示 Skill 名：定位卡点、建立联系、挑战主张、比较概念、查相关研究。
4. 帮助页复用同一组例子；跑聚焦测试并提交。

**验证：**

```bash
cd apps/pi-teaching-web
bun test tests/desktop/desktop-ui.test.tsx tests/m1d/entry-and-dialogue-ui.test.tsx
```

## Task 9：复习 Session 使用轻量索引，正文按需读取

**文件：**
- 修改：`apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- 修改：`apps/pi-teaching-web/src/runtime/asset-review-context.ts`
- 修改：`apps/pi-teaching-web/src/runtime/resource-loader.ts`
- 修改：`apps/pi-teaching-web/resources/skills/references/learning-methods/batch-asset-review.md`
- 测试：`apps/pi-teaching-web/tests/m2/guided-asset-review.test.ts`
- 测试：`apps/pi-teaching-web/tests/m2/free-learning-contexts.test.ts`
- 测试：`apps/pi-teaching-web/tests/m1b/free-learning-session.test.ts`
- 测试：`apps/pi-teaching-web/tests/m2/calendar-review-candidates.test.tsx`

1. 先写 13 项以上 review Session 测试：创建成功；静态 resources 只有全部候选的轻量索引，没有 Note/题卡正文或标准答案；普通 open Session 仍保留 12 项边界与完整显式上下文。
2. Review brief 对每项只提供 alias、kind、title、tags、到期日、阶段、上次结果与精确受管路径。轮到某项时教师使用原生 `read` 读取该精确路径；不枚举目录。
3. `resource-loader` 在 `intent=review` 时不再注入 `renderSelectedAssetContext` 和整批 problem activity；普通自由学习语义不变。
4. `checkedSelectedAssets` 按 intent 选择边界：review 不受全文上下文 12 项限制，仍校验身份、重复和存在性；不得用固定五项替代。
5. Skill 明确：候选完整、一次处理多少由学生选择；只记录真正完成首次提取的项。
6. 跑聚焦测试并提交。

**验证：**

```bash
cd apps/pi-teaching-web
bun test tests/m2/guided-asset-review.test.ts tests/m2/free-learning-contexts.test.ts
```

## Task 10：拆分通用教学核心与按需数学方法

**文件：**
- 新建：`apps/pi-teaching-web/resources/teaching/teaching-core.md`
- 新建：`apps/pi-teaching-web/resources/skills/references/subject-methods/mathematics.md`
- 修改：`apps/pi-teaching-web/src/runtime/resource-loader.ts`
- 修改：`apps/pi-teaching-web/resources/skills/free-learning/SKILL.md`
- 修改：`apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- 修改：`AGENTS.md`
- 删除：`apps/pi-teaching-web/resources/teaching/math-teaching-core.md`
- 测试：`apps/pi-teaching-web/tests/m2/learning-method-resources.test.ts`
- 测试：`apps/pi-teaching-web/tests/m1b/free-learning-session.test.ts`

1. 先写资源契约测试：Free Learning、Roadmap、Plan、Lesson 常驻 `teaching-core.md`；常驻文件不含 mathematics、mathematical truth 或 Lesson Block 写入；数学 reference 只由 Free Learning/Tutor Skill 按需路由。
2. 把现有跨学科内容原义迁入通用核心：基于表现判断、保留局部正确、最小帮助、归还独立动作、学生决策权、可推翻判断和诚实记录。
3. 数学真实性、路线合法性、定义域/边界、反例与陌生外壳检验进入按需数学 reference。Lesson Block 写入责任只留在 Tutor Skill。
4. 不建立学科枚举器；当前由 `LEARNING_GUIDE.md` 决定学习集气质，数学问题由意图按需读取 reference。
5. 用 Skill 行为场景验证直接事实回答、数学路线、化学概念、历史材料辨析与语文文本细读；修改 Skill 后运行结构测试。
6. 跑聚焦测试并提交。

**验证：**

```bash
cd apps/pi-teaching-web
bun test tests/m2/learning-method-resources.test.ts
```

## Task 11：全量检查、真实模型与 DMG 发布验收

**文件：**
- 新建：`docs/audits/2026-08-12-release-usability-closure-acceptance.md`
- 仅在发现真实缺陷时修改对应实现和聚焦测试

1. 运行全量静态检查、单测、build 与核心 E2E；任何失败先定位根因，不为过测试降低语义。
2. 用固定 Sol high / Terra high 记录首个可见反馈、总耗时与工具阶段：普通问答、记忆写入、Roadmap、Plan、Lesson 备课、Scout 检索。
3. 首日教学真实模型验收四类：模糊困惑、真实错题、明确讲解、强学生复杂路线。看首击是否误诊、越权、强制保存或靠学生纠错；不以“最后答对”代替首击守住。
4. 重新打自签名 macOS DMG，执行 desktop verify；用新的临时 App Home 走 OAuth、设置、首页、资料搜索、Material 定位、Note 编辑预览、资产关系、直接复习足迹、13+ 项复习 Session、日历错误和标准/大字。
5. 真实走查三种赴约入口（Plan、有资产 Free、无资产 Free）。若只是角色推测而页面已有足够静态信息，不加自动模型 turn；若确有空白断点，只投影已有约定标题与时长。
6. 报告记录通过项、真实耗时、剩余风险和 DMG 路径。E-18 仍作为下一条独立产品主路，不在本提交实现。

**验证：**

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts tests/e2e/m1b-cycle.spec.ts \
  tests/e2e/m1c-cycle.spec.ts tests/e2e/m1d-ui.spec.ts tests/e2e/desktop-onboarding.spec.ts
bun run desktop:prepare
bun run desktop:sidecars
bun run desktop:smoke
bun run desktop:build
bun run desktop:verify
```

## 完成定义

- 总审计 7.1–7.3 每一项都有实现、自动回归或明确的真实走查结论；
- 学生端不要求输入内部 locator，不静默吞掉核心异步失败，不泄露历史内部标识；
- 保存自动入复习的既定语义保持不变，但成功回执公开；
- 13 项以上复习不再靠全文注入或固定五项规避；
- 通用教学常驻上下文不再携带数学与 Lesson 专属责任；
- 全量检查、核心 E2E、桌面打包自检与真实模型验收都有新鲜证据；
- 未触碰用户无关脏文件，未把来源优先大改混入本轮。
