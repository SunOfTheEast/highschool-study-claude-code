# StudyForge Pi 教学前端

这是 `highschool-study` Markdown 学习集的本地 Pi 前端。一个 Plan 对应一个长期 Coach Session；每节 Lesson 对应一个独立 Tutor Session。学生始终使用同一网页，但 Coach 与 Tutor 的历史不会互相复制，只通过 Lesson 文件、Trace 和带来源摘要交接。

## 环境

- Bun 1.3 或更新版本
- Pi（本仓库当前使用 `@earendil-works/pi-coding-agent`）
- 已配置的 Pi 模型；只浏览学习集和运行无模型测试时不需要模型凭据

安装 Pi：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

## 安装与验证

从仓库根目录执行：

```bash
cd apps/pi-teaching-web
bun install
bun run check
bunx playwright install chromium
bunx playwright test
```

如果网络使用额外 CA，可把本机 CA 文件传给 Chromium 安装命令：

```bash
NODE_EXTRA_CA_CERTS=/path/to/ca.pem bunx playwright install chromium
```

## 直接启动网页

```bash
cd apps/pi-teaching-web
STUDY_LEARNING_SET="$PWD/../../examples/derivative-demo/learning-set" bun run start
```

打开 <http://127.0.0.1:65000>。服务只监听本机，Bun 同时提供 API、WebSocket 事件流和构建后的前端。

开发模式使用两个进程：

```bash
STUDY_LEARNING_SET="$PWD/../../examples/derivative-demo/learning-set" bun run dev:server
bun run dev:client
```

前端地址为 <http://127.0.0.1:65001>。需要查看完整 Lesson 源文档时，可给服务端命令增加 `--authoring`；普通学生模式永远不返回 Teacher Control、答案、rubric 或解法字段。

## 作为 Pi Package 安装

本地路径安装不会复制项目，因此先保留仓库并安装依赖、构建前端：

```bash
cd /path/to/highschool-study-claude-code/apps/pi-teaching-web
bun install
bun run build
pi install "$PWD"
pi list
```

进入包含 `learning-set/` 的目录：

```bash
cd /path/to/study-project
pi
```

然后在 Pi 中运行：

```text
/study-web
```

也可以指定学习集路径：

```text
/study-web ./examples/derivative-demo/learning-set
```

该命令启动本地服务、打开浏览器，并在 Pi Session 结束时关闭服务进程。

## 学生使用流程

1. 首页阅读 Roadmap 概述并进入一个 Plan。
2. 在父级 Coach Session 讨论方向、复盘旧课或请求备课。
3. 从侧边栏打开 Coach 生成的 Lesson；未开始前只有无剧透课堂本。
4. 点击“开始上课”后才创建该 Lesson 的 Tutor Session。
5. Tutor 推进结构化课堂节点，学生可以上传 PNG、JPEG 或 WebP 草稿。
6. 学生确认结束后 Lesson 关闭，界面回到 Coach；课后可查看真实 Session/Trace 驱动的回放。

右侧“方法证据”只是 Trace 的主/次方法加权投影。点击任一节点都能回到原始 Trace 和安全题卡元数据；它不是独立的掌握度事实。

## 真实模型 smoke checklist

建议先复制示例，避免测试写入仓库样例：

```bash
cp -R examples/derivative-demo /tmp/studyforge-derivative-smoke
cd /tmp/studyforge-derivative-smoke
pi
```

依次确认：

- 打开 Coach，读取并复盘上一节 Lesson；
- 让 Coach 按需加载备课 Skill，准备一节至少含两张真实题卡且不剧透的 Lesson；
- 启动 Tutor，确认它拥有独立 Session；
- 分别提交文字与一张图片；
- 让 Tutor 追加一条绑定题卡/课堂步骤的 Trace；
- 暂停并继续同一个 Tutor Session；
- 由学生明确确认结束 Lesson；
- 返回原 Coach Session 做课后复盘。

遇到问题时先运行 `bun run check`；模型调用失败通常需要在 Pi 中用 `/login` 或环境变量配置提供商凭据。
