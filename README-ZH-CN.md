<div align="center">

<img src=".github/assets/send-to-back.svg" width="128" height="128" alt="Decky Localsend" />

# Decky Localsend ![visitors](https://visitor-badge.laobi.icu/badge?page_id=moyoez/Decky-localsend) ![Release](https://img.shields.io/github/v/release/moyoez/decky-localsend) 

<p>
  <img src="https://forthebadge.com/api/badges/generate?panels=2&primaryLabel=Build+With&secondaryLabel=+Go&primaryBGColor=%23f79102&primaryTextColor=%23ffffff&secondaryBGColor=%23389AD5&secondaryTextColor=%23ffffff&primaryFontSize=12&primaryFontWeight=600&primaryLetterSpacing=2&primaryFontFamily=Roboto&primaryTextTransform=uppercase&secondaryFontSize=12&secondaryFontWeight=900&secondaryLetterSpacing=2&secondaryFontFamily=Montserrat&secondaryTextTransform=uppercase&borderRadius=9" alt="Build With Go" style="vertical-align:middle;"/>
  <span style="display:inline-block; width:32px;"></span>
  <img src="https://forthebadge.com/api/badges/generate?panels=2&primaryLabel=Work+On&secondaryLabel=Steam+Deck&primaryBGColor=%23000000&primaryTextColor=%23ffffff&secondaryBGColor=%23389AD5&secondaryTextColor=%23ffffff&primaryFontSize=12&primaryFontWeight=600&primaryLetterSpacing=2&primaryFontFamily=Roboto&primaryTextTransform=uppercase&secondaryFontSize=12&secondaryFontWeight=900&secondaryLetterSpacing=2&secondaryFontFamily=Montserrat&secondaryTextTransform=uppercase&borderRadius=9" style="vertical-align:middle;"/>
</p>



[ENGLISH](README.md) | [简体中文](README-ZH-CN.md)

![preview](https://raw.githubusercontent.com/moyoez/decky-localsend/main/.github/assets/preview_cn.jpg)

将 Localsend 特性带到 Steam 大屏幕模式中

相关后端项目: [MoYoez/localsend-go](https://github.com/MoYoez/localsend-go)

</div>

---

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

## 使用方法

1. 在你的 Steam Deck 上安装本插件 (从 release 下载最新 Release 即可 / 或是进入测试商店下载测试版(v0.32))
2. 从快捷访问菜单中打开插件
3. 点击“启动后端”后，LocalSend 服务器会自动启动
4. 你的 Steam Deck 现在可以被其他 LocalSend 客户端发现
5. 从运行 LocalSend 的任意设备发送文件到你的 Steam Deck



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

- 在大量且多（测试文件数量3000+）传输给 Deck 的时候，因为跑的线程很多，Localsend 传输端 可能会出现抽搐的情况（但实际不影响传输）

- HTTP 扫描可能会造成延迟增加，HTTP超时已经默认调整成 60s ,30s一次，默认使用 Notify 进行设备更新，可不用刷新获取设备

- 请尽量避免单次选择大量文件（建议不超过200个文件）进行传输，过多的文件可能导致 Decky UI 崩溃（文件夹本身数量不受影响，仅单次选择文件数需注意）。

### 兼容表

| 通信方式      | Decky-Localsend 支持 | 能发现的远程 Localsend 设备 | 说明                                      |
|---------------|---------------------|---------------------------|-------------------------------------------|
| UDP 扫描      | HTTP/HTTPS          | HTTP、HTTPS               | UDP 能发现任意协议设备                     |
| HTTP 通信     | HTTP                | HTTP                      | 仅支持与 HTTP 协议设备互通                 |
| HTTPS 通信    | HTTPS               | HTTPS                     | 仅支持与 HTTPS 协议设备互通                |

> UDP 通信下，无论远程设备是 HTTP 还是 HTTPS，Decky-Localsend 都能扫描并发现。







## 鸣谢

- [LocalSend](https://localsend.org)
> 这个插件是基于 Localsend 协议写的，所以快去给个Star吧！
- [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader)
