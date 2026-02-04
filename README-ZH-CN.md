<div align="center">


# Decky Localsend ![visitors](https://visitor-badge.laobi.icu/badge?page_id=moyoez/Decky-localsend)

<p>
  <img src="https://forthebadge.com/api/badges/generate?panels=2&primaryLabel=Build+With&secondaryLabel=+Go&primaryBGColor=%23f79102&primaryTextColor=%23ffffff&secondaryBGColor=%23389AD5&secondaryTextColor=%23ffffff&primaryFontSize=12&primaryFontWeight=600&primaryLetterSpacing=2&primaryFontFamily=Roboto&primaryTextTransform=uppercase&secondaryFontSize=12&secondaryFontWeight=900&secondaryLetterSpacing=2&secondaryFontFamily=Montserrat&secondaryTextTransform=uppercase&borderRadius=9" alt="Build With Go" style="vertical-align:middle;"/>
  <span style="display:inline-block; width:32px;"></span>
  <img src="https://forthebadge.com/api/badges/generate?panels=2&primaryLabel=Work+On&secondaryLabel=Steam+Deck&primaryBGColor=%23000000&primaryTextColor=%23ffffff&secondaryBGColor=%23389AD5&secondaryTextColor=%23ffffff&primaryFontSize=12&primaryFontWeight=600&primaryLetterSpacing=2&primaryFontFamily=Roboto&primaryTextTransform=uppercase&secondaryFontSize=12&secondaryFontWeight=900&secondaryLetterSpacing=2&secondaryFontFamily=Montserrat&secondaryTextTransform=uppercase&borderRadius=9" style="vertical-align:middle;"/>
</p>



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

## 特点

- 全套 Localsend 协议 支持 (除 Web Localsend 外)
- Shared Via Link 链接单向传送文件
- 支持浏览截图上传
- 一些 Localsend 自己的特性 (e.g. 接受历史列表 PIN码 ，以及部分环境下 http / https 环境处理)


## 可参考的使用场景

- 配合 GridDB 传输一部分图片
- 一部分场景下在户外的快传软件（毕竟deck是带出门用的多）
- 免切换快速传截图
- 多设备临时分享

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

无🤔

## 已知BUG

- 在部分情况下，Decky-Localsend 无法扫描到开启时间较久的设备 (半分钟扫描一次， 默认超时为 500s，**可使用 主动扫描 来让其他设备检测到此插件** )，如果在可接受范围内没有找到远程设备，请考虑重启需要传输的 Localsend

- 在部分情况下，插件只能在相同的加密协议工作，即使有针对此情况的适配.

## 鸣谢

- [LocalSend](https://localsend.org)
> 这个插件是基于 Localsend 协议写的，所以快去给个Star吧！
- [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader)
