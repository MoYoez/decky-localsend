<div align="center">

<img src=".github/assets/send-to-back.svg" width="128" height="128" alt="Decky Localsend" />

# Decky Localsend ![visitors](https://visitor-badge.laobi.icu/badge?page_id=moyoez/Decky-localsend) ![Release](https://img.shields.io/github/v/release/moyoez/decky-localsend) 

<p>
  <img src="https://forthebadge.com/api/badges/generate?panels=2&primaryLabel=Build+With&secondaryLabel=+Go&primaryBGColor=%23f79102&primaryTextColor=%23ffffff&secondaryBGColor=%23389AD5&secondaryTextColor=%23ffffff&primaryFontSize=12&primaryFontWeight=600&primaryLetterSpacing=2&primaryFontFamily=Roboto&primaryTextTransform=uppercase&secondaryFontSize=12&secondaryFontWeight=900&secondaryLetterSpacing=2&secondaryFontFamily=Montserrat&secondaryTextTransform=uppercase&borderRadius=9" alt="Build With Go" style="vertical-align:middle;"/>
  <span style="display:inline-block; width:32px;"></span>
  <img src="https://forthebadge.com/api/badges/generate?panels=2&primaryLabel=Work+On&secondaryLabel=Steam+Deck&primaryBGColor=%23000000&primaryTextColor=%23ffffff&secondaryBGColor=%23389AD5&secondaryTextColor=%23ffffff&primaryFontSize=12&primaryFontWeight=600&primaryLetterSpacing=2&primaryFontFamily=Roboto&primaryTextTransform=uppercase&secondaryFontSize=12&secondaryFontWeight=900&secondaryLetterSpacing=2&secondaryFontFamily=Montserrat&secondaryTextTransform=uppercase&borderRadius=9" style="vertical-align:middle;"/>
</p>


[ENGLISH](README.md) | [简体中文](README-ZH-CN.md)

![preview](https://raw.githubusercontent.com/moyoez/decky-localsend/main/.github/assets/preview.jpg)

A Decky Loader plugin that brings LocalSend functionality to Steam Deck gaming mode.

Related Backend Repo: [MoYoez/localsend-go](https://github.com/MoYoez/localsend-go)

</div>

---


## Features

- Full LocalSend protocol support (except Web LocalSend)
- "Shared Via Link" for one-way file transfer via link
- Upload and browse screenshots
- Some unique LocalSend features (e.g., accepting previous transfer list,  PINs, handling HTTP/HTTPS in certain environments)

## Reference Usage Scenarios

- Transfer some images with GridDB
- Use as a fast file transfer tool outdoors in certain scenarios (since the Deck is often used on the go)
- Quickly share screenshots without switching to desk
- Temporary sharing across multiple devices


## Usage

1. Install the plugin on your Steam Deck(Install from release / download from decky test Store (v0.32))
2. Open the plugin from the Quick Access menu
3. The LocalSend server will start automatically when clicking start Backend
4. Your Steam Deck will now be discoverable by other LocalSend clients
5. Send files from any device running LocalSend to your Steam Deck


## Configuration

The plugin uses the following default settings:

- **Port:** 53317
- **Protocol:** HTTPS
- **Upload Directory:** `~/homebrew/data/decky-localsend/uploads`
- **Config File:** `~/homebrew/settings/decky-localsend/localsend.yaml`

You can customize these settings through the plugin interface.

## Project Structure

```
.
├── backend/             # Go backend implementation
│   └── localsend/       # LocalSend protocol implementation
├── src/                 # Frontend React components
│   ├── index.tsx        # Main plugin entry
│   └── utils/           # Utility functions
├── main.py              # Python backend bridge
├── plugin.json          # Plugin metadata
└── package.json         # Node.js dependencies
```

## TODO

- None

## Known Issues

- Sometimes plugin cannot detect other machine ( (30s a time automaticlly , default timeout is 500s, can use **Scan Now** To Detect other client ) .If not found, consider restarting remote localsend client.)

- Plugins can only work in same transfer protocol sometimes, although it has detect method to prevent transfer connection failed.

- When transferring a very large number of files (tested with 3000+ files) to the Deck, the sending side of LocalSend may appear to stutter or become choppy due to multiple running threads. However, this does not affect the actual file transfer.


- HTTP scanning may cause increased latency. HTTP timeout has been set to 60 seconds and runs every 30 seconds by default. Devices are updated via Notify, so you do not need to manually refresh to see remote devices.

- please consider not to transfer too much files(selected), which may cause UI crash,folder dont' effect.

### Compatibility Table

| Communication Method | Decky-Localsend Supported | Discoverable Remote Localsend Devices | Notes                                       |
|---------------------|---------------------------|---------------------------------------|---------------------------------------------|
| UDP Scan            | HTTP/HTTPS                | HTTP, HTTPS                           | UDP can discover devices with any protocol. |
| HTTP Communication  | HTTP                      | HTTP                                  | Only devices with HTTP protocol are supported. |
| HTTPS Communication | HTTPS                     | HTTPS                                 | Only devices with HTTPS protocol are supported. |

> With UDP communication, Decky-Localsend can discover remote devices regardless of whether their protocol is HTTP or HTTPS.


## Acknowledgments

- [LocalSend](https://localsend.org)
> This Plugin is based on Localsend Protocol, so pls give a star to this!
- [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader)