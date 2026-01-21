<div align="center">

# decky-localsend

**语言:** [English](README.md) | 简体中文

一个为 Steam Deck 游戏模式带来 LocalSend 功能的 Decky Loader 插件。

</div>

---

## 概述

这是一个 Decky Loader 插件，可在游戏模式下为 Steam Deck 启用 LocalSend 功能。它允许您在设备和 Steam Deck 之间轻松传输文件、截图和文本，无需手动设置服务器或输入 IP 地址。

本插件实现了 [LocalSend 协议](https://github.com/localsend/protocol) v2.1，提供无缝的跨平台文件共享体验。

## 功能特性

- ✅ 实现 LocalSend 协议 v2.1
- ✅ 在 Steam Deck 游戏模式下接收文件
- ✅ 通过 UDP 组播自动发现设备
- ✅ 支持 HTTPS 的安全文件传输
- ✅ 文件传输的会话管理
- ✅ 实时传输通知
- ✅ 可自定义上传目录
- ✅ 内置 Go 后端以获得最佳性能

## 安装

### 从商店安装

还没传，下次一定（

### 手动安装

1. 从 [GitHub Releases](https://github.com/moyoez/decky-localsend/releases) 下载最新版本
2. 将插件解压到 Decky 插件目录：
   ```bash
   cd ~/homebrew/plugins
   unzip decky-localsend.zip
   ```
3. 重启 Decky Loader 或重新加载插件

## 使用方法

1. 在 Steam Deck 上安装插件
2. 从快速访问菜单打开插件
3. 点击start backend 即可启动
4. 您的 Steam Deck 现在可以被其他 LocalSend 客户端发现
5. 从任何运行 LocalSend 的设备向您的 Steam Deck 发送文件

## 配置

插件使用以下默认设置：

- **端口:** 53317
- **协议:** HTTPS
- **上传目录:** `~/homebrew/data/decky-localsend/uploads`
- **配置文件:** `~/homebrew/settings/decky-localsend/localsend.yaml`

您可以通过插件界面自定义这些设置。

## 项目结构

```
.
├── backend/             # Go 后端实现
│   └── localsend/       # LocalSend 协议实现
├── src/                 # 前端 React 组件
│   ├── index.tsx        # 主插件入口
│   └── utils/           # 工具函数
├── main.py              # Python 后端桥接
├── plugin.json          # 插件元数据
└── package.json         # Node.js 依赖
```

## TODO

- [ ] 文件发送功能
- [ ] 接收文件时的手动确认
- [ ] 传输历史记录
- [ ] 自定义通知声音
- [ ] 多文件选择

## 致谢

- [LocalSend](https://localsend.org) - 原始的跨平台文件共享应用
- [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) - Steam Deck 插件加载器

## 贡献

欢迎贡献！请随时提交 Pull Request。
