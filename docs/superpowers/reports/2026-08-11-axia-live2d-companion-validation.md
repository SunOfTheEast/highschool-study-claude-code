# StudyForge 阿夏 Live2D 长伴随验收记录

**日期：** 2026-08-11

**范围：** 自由学习中的私有阿夏 Live2D 渲染器与公开静态降级

**状态：** 工程链路与公开降级已通过；私有模型制作和动态长伴随验收待完成

## 当前结论

阿夏的专属母图已经生成，并由用户确认“挺像的”。私有模型读取、Cubism Core 注入、惰性
渲染、课堂状态映射和静态回退已经落地；Roadmap、Plan、Lesson、Meta、Home、Assets 与知识
图谱均不会加载模型。公开 DMG 不包含母图、模型、Cubism Core、声音样本或可识别截图。

当前不能宣称 Live2D 成品通过。Cubism Editor 仍未完成许可接受与安装，因此尚未产出
`.moc3` 模型，也没有执行动态表情、嘴型、中断、后台恢复与 20 分钟资源稳定性验收。本报告
保留这个缺口，不用静态图片或自动化测试替代用户对长期伴随体验的最终判断。

## 固定版本

| 项目 | 版本或证据 |
| --- | --- |
| StudyForge DMG | `0.1.0`，arm64，ad-hoc 签名 |
| DMG SHA-256 | `41a345d53eaaf1f35949b7398b2581fbeb95db99840ee6346b67f739daa08ca9` |
| DMG 大小 | 68,935,488 bytes |
| PixiJS | `8.19.0` |
| Live2D engine | `untitled-pixi-live2d-engine 1.3.5` |
| Cubism Editor 安装包 | `5.3.03 arm64`，官方签名且 Apple notarized |
| Cubism SDK for Web | R5 |
| Cubism Core SHA-256 | `8741f739779b5d5210872bd3d7d99f0f1e56e6c87409e7d26d6bb4b80aa1ef47` |
| 验收系统 | macOS 26.3.1 (25D771280a)，Bun 1.3.14，Rust 1.97.1 |

## 自动化与发布包

- Live2D、Peer、媒体与桌面 API 聚焦测试：31 项通过；新增唯一音源边界测试通过；
- 全量检查：424 项测试通过，TypeScript 检查与 Vite 生产构建通过；
- 桌面 sidecar 冒烟：Runtime、Pi、OAuth 启动、Plan 子代理、子进程、PDF 与 Bedrock 通过；
  干净桌面的真实模型 Scout 因未登录 Provider 按预期未执行；
- 最终 DMG 构建与挂载验证通过：arm64、两个 sidecar、ad-hoc 签名和资源均有效；
- 发布包递归扫描会拒绝 `.moc3`、`.cmo3`、`.psd`、`.physics3.json`、`.exp3.json`、
  Cubism Core 和私有 `peer-axia/live2d/` 路径；本次 DMG 未命中；
- Live2D 引擎声明的可选 `@pixi/sound` 已在 Vite 构建层替换为 30-byte 无声音桩，并显式
  `config.sound = false`。现有 Peer TTS `<audio>` 与 Web Audio analyser 仍是唯一音源和嘴型来源。

## 真实 DMG 静态降级

在私有目录没有有效 `manifest.json + .moc3` 的真实条件下，从 DMG 启动 StudyForge：

1. 首页、学习集与现有 Session 正常恢复；
2. 新建自由学习后，静态阿夏常驻输入区右侧，没有公开错误或半加载 Canvas；
3. 发送“阿夏，你觉得判断函数连续和可导时，最容易混淆的是哪一步？一句话回答就好。”；
4. 约 10 秒后出现一条独立 Peer 回复，随后出现现有 TTS 的停止与静音控件；
5. 播放结束后控件自动收起并回到安静静态态，教师在同一轮正常续接；
6. 未观察到旧音频重播、文本顺序改变或僵尸 Canvas。

这证明 Live2D 不是自由学习、Peer、TTS 或教师续接的运行前提。可识别截图只在本地验收中
查看，未写入本报告、Git 或公开 DMG。

## 尚待真实模型完成后验证

- calm / thinking / speaking 无闪烁切换；
- `question / association / challenge` 三种克制表情；
- 真实 TTS 包络驱动 `ParamMouthOpenY`，停顿闭嘴和中断归零；
- 静音、停止、播放中发送新消息、隐藏/显示、刷新、离开 Assets 再返回；
- 20 分钟连续 Session 的 minute-1 / minute-20 CPU 与内存；
- 用户对动态阿夏“像不像、愿不愿意长期放在页面边缘”的最终判断。

唯一外部操作是由用户本人接受 Cubism Editor 的许可协议并完成 macOS 安装授权。完成后从
已经确认的母图制作私有模型，再续跑上述项目。
