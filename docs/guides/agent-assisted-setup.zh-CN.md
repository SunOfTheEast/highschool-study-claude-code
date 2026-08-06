# 使用 Work Agent 配置 StudyForge

这份指南适合让 Coding Agent / Work Agent 在本机仓库里协助安装、诊断和启动。Agent 可以操作仓库依赖与前台进程，但模型认证仍由用户在 Pi 中完成。

## 前提

- macOS 或 Linux；其他平台当前只给出未验收警告。
- Git 与 Bun 1.3.0 或更高版本。
- 一个来源与许可边界清楚、允许本地写入的 Learning Set。
- 至少一个已经通过 Pi OAuth 或 API Key 配置的模型提供商。

## 标准流程

从仓库根目录执行：

```bash
bun install --frozen-lockfile
bun run doctor
```

Doctor 是只读检查，不创建探针文件、不访问模型网络，也不输出认证文件路径或凭证值。它依次报告：

| ID | `pass` 的含义 | 失败时怎么做 |
| --- | --- | --- |
| `platform` | 当前是已验收的 macOS/Linux | 其他平台是 `warn`；可继续实验，但不要宣称受支持 |
| `bun` | Bun ≥ 1.3.0 | 由用户安装或升级 Bun，再冻结安装 |
| `app` | `apps/studyforge/package.json` 存在 | 确认进入了仓库根目录且检出完整 |
| `learning-set` | Roadmap、Plan-local Lesson 与静态资产通过严格解析 | 根据错误修正文档，不跳过解析器 |
| `write` | Learning Set 目录可保存课程状态 | 修正目录权限或选择可写副本 |
| `model` | Pi 已发现至少一个本地可用提供商 | 用户自行打开 Pi 的认证流程完成 OAuth/API Key 配置 |
| `port` | 回环端口有效且空闲 | 停止占用进程，或设置另一个 `STUDY_WEB_PORT` |

不要让 Agent 搜索主目录、认证目录或环境变量来“帮忙找 key”。不要把 OAuth token、API Key、Session JSONL 或真实学生记录粘贴进对话。Agent 只需看到 `model` 检查是否通过。

Doctor 通过后启动：

```bash
bun run start:demo
```

启动器会再次诊断、构建前端，然后在前台运行服务。它不会自动打开浏览器，也不会静默驻留后台。另开终端验证：

```bash
curl http://127.0.0.1:65000/api/health
```

预期得到包含 `"ok":true` 的 JSON。浏览器打开 <http://127.0.0.1:65000>。用 `Ctrl-C` 停止，信号会转发给子进程。

## 自定义 Learning Set、端口和表达层

```bash
STUDY_LEARNING_SET=/absolute/path/to/learning-set \
STUDY_WEB_PORT=65100 \
STUDY_PERSONA=confident-mentor \
bun run start:demo
```

`confident-mentor` 只改变表达，不改变教学职责、数学事实、学生确认门或停止权。服务始终只应绑定回环地址；不要用反向代理或端口映射把 M0 暴露给其他机器。

## 可复制给 Agent 的任务

```text
请在这个 StudyForge 仓库根目录协助我启动本地 demo。只安装 bun.lock 声明的依赖；运行 bun run doctor 并逐项解释七个检查。若 model 失败，只指导我在 Pi 中自行认证，不读取、打印或改写凭证。未经我确认，不改全局 Pi 配置、不更改 Learning Set 内容、不暴露回环服务。检查通过后运行 bun run start:demo，并用 /api/health 验证。
```

Learning Set 文档失败时，先阅读[严格契约](learning-set.zh-CN.md)。App 端口、环境变量与开发命令见 [App README](../../apps/studyforge/README.md)。
