# StudyForge 阿夏 Live2D 长伴随验收记录

**日期：** 2026-08-11

**范围：** 自由学习中的私有阿夏 Live2D 渲染器与公开静态降级

**状态：** 轻量动态模型及真实 DMG 链路通过；精细面部绑定与长时稳定性仍待完成

## 当前结论

用户已经安装并授权 Live2D Cubism Editor。已经从确认过的阿夏母图制作出一个真正可编辑的
私有 `.cmo3` 工程，并导出 `.moc3`、纹理、`model3.json`、显示信息、三份表达文件和
Cubism Core。新 DMG 能从 StudyForge 私有目录鉴权读取完整包，在自由学习中创建真实
Live2D Canvas；模型就绪后静态立绘隐藏，离开自由学习则完全不加载。

这一版是可运行的轻量模型，不冒充精细成品。当前模型是一张完整立绘上的 5×5 Warp
Deformer，并为 `ParamAngleX` 制作了三键轻微摆动。`neutral / curious / skeptical` 已能以
不同头部倾向进入同一个模型，但眼睛、眉毛、嘴、头发和项链尚未拆成独立 ArtMesh；因此
参数虽然存在，尚没有真正可见的眨眼、口型和物理摆动。现有 TTS 与文字顺序没有被改写。

## 固定版本

| 项目 | 版本或证据 |
| --- | --- |
| StudyForge DMG | `0.1.0`，arm64，ad-hoc 签名 |
| DMG SHA-256 | `a8949b489c931e9746e3a96fa1323377dd192d80f32704a9a01dd0319772da54` |
| DMG 大小 | 68,935,422 bytes |
| PixiJS | `8.19.0` |
| Live2D engine | `untitled-pixi-live2d-engine 1.3.5`，带两个最小兼容补丁 |
| Cubism Editor | `5.3.03 arm64`，本机已安装 |
| Cubism SDK for Web | R5 |
| Cubism Core SHA-256 | `8741f739779b5d5210872bd3d7d99f0f1e56e6c87409e7d26d6bb4b80aa1ef47` |
| 私有可编辑工程 | `axia.cmo3`，3,476,716 bytes |
| 私有运行模型 | `axia.moc3`，15,424 bytes |
| 验收系统 | macOS 26.3.1 (25D771280a)，Bun 1.3.14，Rust 1.97.1 |

## 实际发现并修复的兼容边界

真实模型首次进入浏览器后暴露了两个不能靠单元测试猜出的第三方边界：

1. 私有纹理经鉴权读取后会变成 `blob:` URL；Pixi Assets 不能再从扩展名推断解析器，必须
   显式指定 `texture` parser；
2. Cubism Editor 5.3 导出的 Core 6 使用 `drawOrders`，而引擎 1.3.5 仍只读取旧字段
   `renderOrders`。

两处均通过固定版本的 Bun 依赖补丁解决，没有复制或改写引擎，也没有引入第二条音频链路。
另外修正了渲染失败清理顺序：Pixi 销毁后不再反查已经被置空的 Canvas，从而不会用二次异常
掩盖最初的模型错误。

私有 `model3.json` 还需保留空的 `Groups` 数组；这是当前轻量导出物对引擎适配器的机械兼容
字段，不代表模型已经具备眼睛或嘴部绑定。以后重新从 Editor 导出时必须一并保留。

## 自动化与发布包

- 全量检查通过：426 项测试、TypeScript 检查、Vite 生产构建；
- 新增 3 项精确边界测试：唯一音源、Blob 纹理 parser、Core 6 `drawOrders`；
- `bun install --frozen-lockfile` 能稳定重放依赖补丁；
- Tauri release 构建、两个 sidecar、ad-hoc 签名和 DMG 生成通过；
- 新 DMG 递归扫描未发现 `.moc3`、`.cmo3`、`.psd`、`.exp3.json` 或
  `live2dcubismcore.min.js`，私有形象仍不进入仓库与发布包；
- Live2D 引擎的可选 `@pixi/sound` 继续由无声音桩替代。现有 Peer TTS `<audio>` 与 Web
  Audio analyser 仍是唯一声音与嘴型状态来源。

## 真实 DMG 动态模型冒烟

从本轮新生成的 DMG 新挂载并启动 StudyForge，使用已有真实学习集与自由学习 Session：

1. 首页、学习集与历史 Session 正常恢复；
2. 打开已有阿夏会话后，私有 manifest、Core、模型、纹理和表达文件均成功读取；
3. 页面建立一个 Live2D Canvas，并在 renderer ready 后隐藏静态立绘；
4. 阿夏以动态模型出现在输入区右下角，既没有破图、公开错误，也没有僵尸双模型；
5. 历史 Peer 消息与教师续接顺序保持原样；
6. 同一 DMG 在缺少或损坏私有包时仍会安静退回静态立绘。

这证明从“私有 Cubism 工程 → 运行时包 → 鉴权 API → Blob 重建 → Core 注入 → Pixi
Canvas → 自由学习舞台”的发布链路已经闭合。

## 尚未通过的成品标准

- 独立眼睛、眉毛、嘴、前后发与项链图层；
- 可见且自然的眨眼、呼吸、发丝和项链物理；
- `question / association / challenge` 三种真正由眉眼与嘴形区分的表达；
- 真实 TTS 包络驱动可见的 `ParamMouthOpenY`，包括停顿闭嘴和中断归零；
- 静音、停止、播放中发送新消息、后台恢复等动态交互的完整人工走查；
- 20 分钟连续 Session 的 CPU、内存和视觉舒适度；
- 用户对动态模型是否适合长期伴随的最终判断。

因此本轮完成的是可发布架构和真实轻量模型闭环，不应把它描述成已经完成的精细 Live2D
角色。下一轮若继续，工作重点应放在私有模型分层和绑定，而不是再改应用架构。
