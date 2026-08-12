# Source-First 首次学生纵向验收

**日期：** 2026-08-13  
**分支：** `codex/source-first-book-learning`  
**结论：** 一份真实大书已经贯通“渐进读取 → 自由学习 → 题卡 → 对象记忆 → Roadmap → Plan → 两节正式课”。第一课暴露并保留了一个真实来源召回失败；修复后，同一个 Plan 在第二课精确召回已处理的第 25 页，并把它写入 Lesson `Uses`，课堂与记忆闭环通过。

## Run Identity

- 验收从 `103599c` 的本地工作树开始；运行中产生的两个修复提交为 `297a5ca`、`7a26dec`。
- 最终复验 DMG：`StudyForge_0.1.0_aarch64.dmg`。
- 最终复验 DMG SHA-256：`a4a406266976142e19465798a85f94cc500beef86de0e35a4bb0cd5bf2519aeb`。
- 验收跨越了修复前后两个本地构建；修复前构建被后续构建覆盖，旧哈希未保留，不能把最终哈希倒填给前半程。
- 教师：`openai-codex/gpt-5.6-sol`，`high`。
- Scout：`openai-codex/gpt-5.6-terra`，`high`。
- 视觉：设置为 `auto`；真实页投影记录命中 `openai-codex/gpt-5.6-luna`。自动路由把 Luna 配置为 `low`，但页投影本身只持久化模型，不持久化 thinking，报告不把后者冒充运行回执。
- 原始 Session、OAuth 与模型凭据均只留在权限为用户私有的隔离验收根中，不提交仓库。

## Real Source

- 合法持有的导数学习 PDF：103,064,800 字节，547 个物理页，362 个 PDF 书签节点。
- 导入 revision 1 后，原件字节数保持 103,064,800；Material 清单中的 SHA-256 与导入时计算值一致。
- 导入立即生成页清单与目录，不做整书 OCR；只有物理第 25 页被实际处理。
- 第 25 页原生隐藏文本质量不足，真实路由为 `vision`；Luna 产生可搜索分页正文，其他 546 页仍为 `pending`。
- 本轮只摘录定位事实和极短内容特征，不把原书页面、整段正文或截图提交仓库。

## Student Journey

下表的 Session 用时是首条持久消息至最后一条持久回复的墙钟时间，包含模拟学生阅读与作答，不等于纯模型延迟。

| 阶段 | 学生可见动作 | 实际模型 / Session | 墙钟 | 耐久结果 |
| --- | --- | --- | ---: | --- |
| 打开真实 DMG | 进入一个隔离的新学习集 | 本地 Desktop | — | App Home、Documents 与原有 StudyForge 隔离 |
| 导入书 | 从 Desktop 选取 103 MB PDF | Runtime 路径导入 | — | Material revision 1、547 页清单、362 节目录 |
| 渐进读页 | 打开并处理物理第 25 页 | Luna 视觉 worker | 未单独持久化 | 仅 `page-0025` 成为 `visual-text`，模型名可核验 |
| 自由学习 | 用不完整理解追问共同外壳与严格单调性 | Sol `high` / Free Learning | 264 s | 一张来源为第 25 页的题卡；对象记忆首次形成 |
| Meta | 讨论是否需要长期路径，阅读完整方案后自然确认 | Sol `high` / Meta | 156 s | 只创建 Roadmap，不在 Meta 内偷建 Plan |
| Roadmap | 商议第一个学习阶段 | Sol `high` / Roadmap | 110 s | Plan 001 建立，维持约五课的动态估计 |
| Plan 首次备课 | 商议一小时、两题、重选路的第一课 | Sol + Terra | Scout 23 s；物化约 2 min | 真实书中未找到满足全部条件的两题；学生同意后改为教师自编 |
| Lesson 001 | 两道新外壳，检查选路、区间与跨区间边界 | Sol `high` / Lesson | 552 s | Lesson 关闭；旧记忆追加“提示后收口”，没有伪写为独立掌握 |
| Plan 第二次备课（修复前） | 点名回到书中第 25 页和已保存题卡 | Sol + Terra | Scout 17.293 s | **失败证据保留：** Scout 在语义资产索引中找关键词，没有读取现成分页投影 |
| Plan 第二次备课（修复后） | 在同一个 Plan 要求重新定位，不接受重建 | Sol + Terra | Scout 26.259 s；整次准备约 158 s | 精确返回分页投影；Lesson 002 绑定原书页和旧题卡 |
| Lesson 002 | 原书回忆、旧题卡对照、递减新题、陌生外壳收口 | Sol `high` / Lesson | 320 s | 两个新外壳均无方向提示独立完成；Lesson 关闭，Plan 仍 active |

## Source and Asset Evidence

- 自由学习保存的第一张题卡固定引用 Material revision 1、物理第 25 页；学生界面显示人类可读来源，不展示内部 ID 或 locator 语法。
- 第一课经学生确认只保存第二张教师自编题；它的 `sources` 诚实为空，没有伪装成书中原题。
- Lesson 002 的第一个 Block 精确写入：

  ```text
  Uses: materials/material-001/projections/1/pages/page-0025.txt
  ```

- Lesson 002 的第二个 Block 绑定第一课保存的题卡；后续两道教师新编检验不伪造 Material 来源。
- 书籍分页投影中的原例与 Lesson 002 学生题面一致；Coach 完整核验后才物化课堂。

## Memory Continuity

对象记忆始终是同一个对象，Learning History 只追加，不改写旧条目：

1. 自由学习：学生最初认为共同外壳足以直接脱壳；教师用反例澄清严格单调与实际输入区间后，学生完成近迁移。
2. Lesson 001：学生能独立识别共同函数和跨区间失效，但第二题最后收口使用了“边界与变化速度”的方向提示；历史明确记录提示依赖。
3. Lesson 002：在交叉幂比较和 `xe^{-x}` 两个新外壳中，学生均无提示构造严格递减函数、核对区间并反向收口。

当前判断因此只推进到“严格递减反向脱壳已能实际迁移”；仍保留“复杂题里共同函数不明显时能否主动迅速发现”的未知项。INDEX 的下一检验方向也更新为这一边界，没有把一次课扩大成全局能力标签。

## Course Continuity

- Roadmap、Plan、Lesson 各自拥有独立原生 Session，没有复制上下文或共用一个老师 Session。
- Roadmap active；Plan 001 active；Lesson 001、Lesson 002 closed。
- Lesson 002 明确 `After` / `Depends on` Lesson 001；课程树显示 2/2 已关闭，但没有擅自结束整个 Plan。
- 第二次备课同时使用原书分页、第一课题卡和对象记忆中的未稳边界：来源、资产与学生模型在 Plan 层汇合，课堂只得到本课所需部分。
- 结课后旧历史仍在，新的 Lesson 证据追加到对象记忆；没有回写或删除自由学习与第一课条目。

## Defects Found and Fixed

### 1. 系统文件选择后的路径权限断裂

真实 DMG 中，Runtime sidecar 不能可靠地继续读取系统选择器返回的 Desktop 路径。修复为由 Tauri 主进程把选中的 PDF 复制到 App Home 内受管 staging，再把受管路径交给 Runtime；导入完成后只删除 staging 副本，绝不删除原书。Rust 测试验证了来源保留与删除边界。

无人值守的 Computer Use 仍无法替用户点击 macOS TCC 文件授权弹窗。本轮用同一原书的逐字节副本放入隔离 staging，随后走真实 Runtime 导入；因此“系统选择器自动点击”记为外部自动化限制，不冒充完整自动化通过。

### 2. 打包环境中的 PDF 图像页渲染失败

真实书页含图像 XObject 时，打包 sidecar 缺少 PDF.js 默认动态 Canvas 路径。修复为静态引入 `@napi-rs/canvas`、提供明确 CanvasFactory，并让 runtime self-test 生成含图像的 PDF 后实际建索引和渲染。DMG smoke 与 verify 均通过。

### 3. 精确书页被错误送进语义资产搜索

修复前 Scout 把“第 25 页”与课堂主题一起搜索 `asset-recall.tsv`，即使 `page-0025.txt` 已存在也返回“找不到”。修复后的亮线是：点名书页先按规范文件名在 `materials/` 内精确定位；页码决定身份，主题只核验用途；只有没有精确页码的 Note / 题卡才走语义召回。相同 Plan 的真实复验由 3 次操作的失败变为 2 次操作成功。

### 4. 包校验把 stderr 警告拼进 JSON

runtime self-test 已返回成功 JSON，但 PDF.js 的非致命 stderr 警告导致 verifier 解析失败。修复仅让结构化自检回执读取 stdout；签名、架构与其他命令仍保留 stdout + stderr 检查。

## Result

| 层 | 结果 | 证据摘要 |
| --- | --- | --- |
| DMG 启动与隔离 | PASS | 最终 DMG 启动；独立 App Home / Documents；验收后只读镜像已卸载 |
| 系统选择器无人值守 | BLOCKED | macOS TCC 需真人授权；未绕过安全弹窗 |
| 大书导入 | PASS | 103,064,800 字节、547 页、362 书签；revision 与 SHA 固定 |
| 打包 PDF 渲染 | PASS | 真实图像页可渲染；runtime self-test、smoke、verify 通过 |
| 低成本视觉路由 | PASS | 第 25 页投影真实记录 Luna；其余页未预处理 |
| Free Learning → 题卡 | PASS | 自然确认后保存；来源固定到 revision 1 / 第 25 页 |
| 对象记忆 | PASS | 三段演变只追加；提示依赖、独立表现与未知边界均保留 |
| Meta → Roadmap → Plan | PASS | 三种 Session 分离；自然确认门工作；层级所有权正确 |
| 第一课来源要求 | FAIL（已留证） | 首课未找到合适书中两题，经学生同意后改用自编题，不能算来源课 |
| 精确页召回修复 | PASS | 同一个 Plan 重试后精确绑定 `page-0025.txt` |
| 第二课正式教学 | PASS | 原书 + 旧题卡 + 新检验；Lesson closed；Plan 未被误关 |
| 学生可见投影 | PASS | 走查未出现原始 ID、tool 参数、私有记忆、答案提前泄漏或 API 错误 |

## Automated Verification

- `bun run check`：595/595 非 E2E 测试通过；TypeScript、Vite build 通过。
- `cargo test --manifest-path src-tauri/Cargo.toml`：9/9 通过。
- `bun run desktop:smoke`：runtime、Pi、OAuth bootstrap、子代理、PDF import/render、Bedrock 均通过。
- `bun run desktop:verify`：arm64、sidecar 系统库、adhoc 签名、资源与 runtime self-test 通过。
- `bunx playwright test tests/e2e/source-first-book.spec.ts tests/e2e/desktop-onboarding.spec.ts`：4/4 通过。

## Remaining Costs and Next Action

- 精确页 Scout 已降到 26.259 s，但完整 Lesson 物化仍约两分钟；两者是不同延迟，下一步若优化应针对 Worker 产物生成，不再继续压缩已经收敛的精确召回。
- 第一次备课只有少量已处理书页，无法从整本书中挑出两道符合全部条件的题，这不是检索器应靠遍历解决的问题。首版应继续“按需处理页段 + 必要时经学生同意自编”，不要偷偷全书 OCR。
- 视觉页投影尚未持久化 thinking 回执；若以后必须审计实际 thinking，应扩充运行回执，而不是从配置反推。
- 隔离验收根保留供人工复核；没有自动删除真实证据，也没有把书、Session 或记忆提交仓库。
