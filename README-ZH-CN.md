<div align="center">

# decky-localsend

[ENGLISH](README.md) | [简体中文](README-ZH-CN.md)

![preview](https://raw.githubusercontent.com/moyoez/decky-localsend/main/.github/assets/preview_cn.jpg)

将 Localsend 特性带到 Steam 大屏幕模式中

</div>

---

这是一个 Decky Loader 插件，可以在 Steam Deck 的游戏模式下启用 LocalSend 功能。

该插件实现了 [LocalSend 协议](https://github.com/localsend/protocol) v2.1，实现了跨平台的无缝文件共享。


> 其实这插件是因为终末地截个图发设备实在太麻烦才临时搓出来的（小声） 实际上我拿 deck 玩的最多的是 hd2( 

## 使用方法

1. 在你的 Steam Deck 上安装本插件
2. 从快捷访问菜单中打开插件
3. 点击“启动后端”后，LocalSend 服务器会自动启动
4. 你的 Steam Deck 现在可以被其他 LocalSend 客户端发现
5. 从运行 LocalSend 的任意设备发送文件到你的 Steam Deck

> 也许？很快上商店了？:(

## 配置说明

插件默认使用以下设置：

- **端口 (Port)：** 53317
- **协议 (Protocol)：** HTTPS
- **上传目录 (Upload Directory)：** `~/homebrew/data/decky-localsend/uploads`
- **配置文件 (Config File)：** `~/homebrew/settings/decky-localsend/localsend.yaml`

你可以在插件界面自定义这些设置。

## 项目结构

```
.
├── backend/             # Go 后端实现
│   └── localsend/       # LocalSend 协议实现
├── src/                 # 前端 React 组件
│   ├── index.tsx        # 插件主要入口
│   └── utils/           # 工具函数
├── main.py              # Python 后端桥接
├── plugin.json          # 插件元数据
└── package.json         # Node.js 依赖
```

## 待办事项

- Localsend 官方的一些实现，例如收藏设备

- 从指定端口搜索 (后端依赖已经实现)

- “从链接分享文件” 功能

## 已知BUG

- 在部分情况下，Decky-Localsend 无法扫描到开启时间较久的设备 ( 5s 扫描一次所需时 , 半分钟扫描一次， 默认超时为 500s，**可使用 主动扫描 来让其他设备检测到此插件** )，如果在可接受范围内没有找到远程设备，请考虑重启需要传输的 Localsend

- 在部分情况下，插件只能在相同的加密协议工作，即使有针对此情况的适配.

## 鸣谢

- [LocalSend](https://localsend.org)
> 这个插件是基于 Localsend 协议写的，所以快去给个Star吧！
- [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader)
