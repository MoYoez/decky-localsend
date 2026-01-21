<div align="center">

# decky-localsend

**Language / 语言:** English | [简体中文](README-zh-CN.md)

A Decky Loader plugin that brings LocalSend functionality to Steam Deck gaming mode.

</div>

---

## Overview

This is a Decky Loader plugin that enables LocalSend functionality on Steam Deck in gaming mode. It allows you to easily transfer files, screenshots, and text between your devices and Steam Deck without the hassle of setting up servers or typing IP addresses manually.

The plugin implements the [LocalSend Protocol](https://github.com/localsend/protocol) v2.1, providing seamless cross-platform file sharing.

## Features

- ✅ LocalSend Protocol v2.1 implementation
- ✅ File receiving in Steam Deck gaming mode
- ✅ Automatic device discovery via UDP multicast
- ✅ Secure file transfer with HTTPS support
- ✅ Session management for file transfers
- ✅ Real-time transfer notifications
- ✅ Customizable upload directory
- ✅ Built-in Go backend for optimal performance



### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/moyoez/decky-localsend/releases)
2. Extract the plugin to your Decky plugins directory:
   ```bash
   cd ~/homebrew/plugins
   unzip decky-localsend.zip
   ```
3. Restart Decky Loader or reload plugins

## Usage

1. Install the plugin on your Steam Deck
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

- [ ] File sending capability
- [ ] Manual confirmation for receiving files
- [ ] Transfer history
- [ ] Custom notification sounds
- [ ] Multiple file selection


## Acknowledgments

- [LocalSend](https://localsend.org) - The original cross-platform file sharing application
- [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) - Plugin loader for Steam Deck

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
