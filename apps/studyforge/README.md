# StudyForge App

`apps/studyforge` 是 StudyForge M0 的 React/Vite 前端、本地 Bun HTTP/WebSocket 服务和 Pi Package 入口。产品介绍、隐私边界与一键启动见[根 README](../../README.md)；课程文档契约见[Learning Set 指南](../../docs/guides/learning-set.zh-CN.md)。

## 开发

依赖和锁文件由仓库根目录统一管理：

```bash
bun install --frozen-lockfile
bun run --cwd apps/studyforge typecheck
bun run --cwd apps/studyforge test
bun run --cwd apps/studyforge build
bun run --cwd apps/studyforge test:e2e
```

开发模式使用固定的回环端口：API `65000`，Vite `65001`。`dev:server` 会显式允许 Vite 的本地 Origin。

```bash
STUDY_LEARNING_SET=/absolute/path/to/learning-set \
bun run --cwd apps/studyforge dev
```

## 环境变量

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `STUDY_LEARNING_SET` | `learning-set` | Learning Set 绝对或工作目录相对路径 |
| `STUDY_WEB_PORT` | `65000` | 本地 HTTP/WebSocket 端口 |
| `STUDY_PERSONA` | 未设置 | 可选表达层；当前原创 ID 为 `confident-mentor` |
| `STUDYFORGE_DEV_ORIGIN` | 未设置 | 额外允许的本地 HTTP 开发 Origin；必须是 `127.0.0.1` 或 `localhost` |
| `STUDYFORGE_E2E_API_PORT` | `65000` | E2E fixture API 端口 |
| `STUDYFORGE_E2E_CLIENT_PORT` | `65001` | E2E Vite 端口 |

生产式本地启动先构建，再以前台进程运行：

```bash
bun run --cwd apps/studyforge build
STUDY_LEARNING_SET=/absolute/path/to/learning-set \
bun run --cwd apps/studyforge start
```

服务只绑定 `127.0.0.1`。同源页面、本地开发 Origin 和无 Origin 的 CLI 请求可用；其他浏览器 Origin 的写请求与 `/events` WebSocket 会在副作用之前被拒绝。

## 作为 Pi Package 安装

从仓库根目录执行：

```bash
bun install --frozen-lockfile
bun run build
pi install "$PWD/apps/studyforge"
```

进入包含 `learning-set/` 的目录启动 Pi，然后运行 `/study-web`；也可以运行 `/study-web /absolute/path/to/learning-set`。Pi 负责模型认证，App 不读取或保存凭证。

## HTTP 与事件面

主要页面为 `/course`、`/course/plan/:planId`、`/course/plan/:planId/lesson/:lessonId` 与 `/knowledge`。API 包含：

- `GET /api/health`
- `GET /api/course`
- `GET /api/knowledge`
- `GET /api/sessions/:key/history`
- `POST /api/sessions/:key/messages`
- `POST /api/plans/:planId/start|complete`
- `POST /api/plans/:planId/lessons/:lessonId/start|close`
- `GET /api/plans/:planId/lessons/:lessonId/handout/:blockIds`

`/events` 通过 WebSocket 传输会话消息、经过安全投影的工具活动、运行状态、错误与文档失效通知。教师最终文本不被中间层改写。

更完整的 Runtime、Skill、Agent 与子上下文责任边界见 [M0 架构说明](../../docs/architecture/m0-runtime.zh-CN.md)。
