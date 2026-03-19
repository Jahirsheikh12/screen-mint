# ScreenMint

语言: [English](README.md) | 简体中文

ScreenMint 是一个开源桌面录屏与视频编辑器，用于制作更精致的演示、教程、产品讲解和工作流视频。

## 亮点

- 录制整块屏幕或单个窗口
- 在平台支持的情况下录制麦克风和系统音频
- 使用自动缩放、光标特效、自定义背景和注释来打磨录屏
- 通过非破坏式时间线编辑裁剪、变速、缩放和样式
- 导出 MP4 或 GIF
- 将项目保存为 `.screenmint` 文件

## 平台支持

- macOS 12.3+
- Windows 10 build 19041+
- 现代 Linux 发行版

Windows 低于 19041 的版本会回退到 Electron 捕获路径，因此无法隐藏系统光标。Linux 录制同样依赖 Electron 桌面捕获，所以真实系统光标可能会出现在导出视频中。

## 本地开发

```bash
git clone https://github.com/Jahirsheikh12/screenmint.git
cd screenmint
npm install
npm run dev
```

常用命令：

- `npm run build`
- `npm run build:mac`
- `npm run build:win`
- `npm run build:linux`
- `npm run lint`
- `npm run test`
- `npm run i18n:check`

## 项目格式

ScreenMint 使用 `.screenmint` 作为项目文件扩展名。序列化逻辑位于 `src/components/video-editor/projectPersistence.ts`。

## macOS 提示

本地构建默认未签名。如果 macOS 隔离了应用，可以执行：

```bash
xattr -rd com.apple.quarantine /Applications/ScreenMint.app
```

## 架构概览

ScreenMint 基于 Electron + React + Vite，包含：

- 浮动录制 HUD
- 独立编辑器窗口
- 录制源选择窗口
- macOS 原生捕获辅助程序
- Windows 原生捕获支持
- 基于 PixiJS 和 Web API 的渲染导出管线

## 项目链接

- GitHub: https://github.com/Jahirsheikh12/screenmint
- 占位主页: https://screenmint.live

## 许可证

ScreenMint 基于 MIT 许可证发布。详见 [LICENSE](./LICENSE)。
