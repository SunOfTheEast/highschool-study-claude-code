# 参与 StudyForge

感谢你愿意帮助 StudyForge。当前项目仍处于早期预览阶段，最有价值的贡献是能够改善真实
学生体验、教学边界或本地可靠性的具体问题。

## 开始之前

- Bug、文档错误和小型可逆修复可以直接提交 Issue 或 Pull Request。
- 新的持久数据结构、Agent 权限、生命周期、学习事实或大范围界面改造，请先开 Issue 说明真实情境、现有失败和预期边界。
- 不要提交真实学生的私人对话、学习集、考试材料、API Key、OAuth 代码或未经授权的书籍。

## 本地开发

```bash
git clone https://github.com/SunOfTheEast/highschool-study-claude-code.git
cd highschool-study-claude-code/apps/pi-teaching-web
bun install --frozen-lockfile
bun run check
```

运行浏览器端：

```bash
STUDY_LEARNING_SET="$PWD/../../examples/derivative-m0/learning-set" bun run dev:server
bun run dev:client
```

桌面包和完整验证命令见
[App 开发者文档](apps/pi-teaching-web/README.md)与
[macOS 发布清单](apps/pi-teaching-web/docs/desktop-release-checklist.md)。

## 修改纪律

- 学习事实和资产以 Markdown/YAML 与原生 Session 为准；投影视图不能反过来成为第二事实源。
- 学生必须拥有课程目标、资产保存和生命周期动作的最终决定权。
- Runtime 只承担机械边界；教学判断、解释和诊断留给 Agent Skill。
- 保持来源可回溯：从书页形成的资产应固定到精确 Material revision 与 locator。
- 保存不等于掌握，教师解释也不等于学生已经独立完成。
- 优先删除没有当前消费者的旧路径，不为历史原型建立兼容层。
- 修改真实学习集前先复制；测试和示例不得携带私人学生状态。

## 提交前验证

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e
```

涉及桌面打包时还应运行：

```bash
bun run desktop:build
bun run desktop:verify
bun run desktop:smoke
```

如果某项真实模型验收因缺少凭据没有运行，请明确写“未验收”，不要用 mock 冒充。

## 许可证

提交贡献即表示你有权提交这些内容，并同意它们按仓库的
[GNU AGPL v3.0](LICENSE) 发布。第三方内容必须保留原许可证和来源。
