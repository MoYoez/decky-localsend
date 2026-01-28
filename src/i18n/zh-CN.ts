import type { TranslationKeys } from "./en";

export const zhCN: TranslationKeys = {
  // Backend Section
  backend: {
    title: "LocalSend 后端",
    status: "后端状态",
    running: "后端运行中",
    stopped: "后端已停止",
    scanDevices: "扫描设备",
    refreshDevices: "刷新设备",
    scanning: "扫描中...",
    availableDevices: "可用设备",
    noDevices: "无设备",
    selected: "已选中",
  },

  // File Upload Section
  upload: {
    title: "文件上传",
    selectedDevice: "已选设备",
    none: "无",
    chooseFile: "选择文件",
    chooseFolder: "选择文件夹",
    addText: "添加文本",
    confirmSend: "确认发送",
    uploading: "上传中...",
    selectedFiles: "已选文件",
    clearFiles: "清空文件",
    uploadProgress: "上传进度",
    textAdded: "文本已添加",
    readyToSend: "准备以 .txt 发送",
  },

  // Configuration Section
  config: {
    title: "配置",
    alias: "别名",
    default: "默认",
    editAlias: "编辑别名",
    downloadFolder: "下载文件夹",
    editDownloadFolder: "编辑下载文件夹",
    chooseDownloadFolder: "选择下载文件夹",
    multicastAddress: "组播地址",
    editMulticastAddress: "编辑组播地址",
    multicastPort: "组播端口",
    editMulticastPort: "编辑组播端口",
    scanMode: "扫描模式",
    scanModeDesc: "混合: UDP + HTTP | 普通: UDP 组播 | HTTP: 传统扫描",
    scanModeMixed: "混合",
    scanModeNormal: "普通",
    scanModeHTTP: "HTTP",
    skipNotify: "跳过通知",
    skipNotifyDesc: "接收文件时跳过通知",
    pin: "PIN 码",
    pinConfigured: "已设置",
    pinNotSet: "未设置",
    editPin: "编辑 PIN",
    clearPin: "清除 PIN",
    clearPinTitle: "清除 PIN",
    clearPinMessage: "确定要清除 PIN 码吗？",
    autoSave: "自动保存",
    autoSaveDesc: "关闭后，接收文件前需要确认",
    apply: "应用",
    configSaved: "配置已保存",
    backendRestarted: "后端已重启",
    restartToTakeEffect: "重启后端以生效",
    configUpdated: "配置已更新",
  },

  // Settings Section
  settings: {
    title: "设置",
    resetAllData: "重置所有数据",
    factoryReset: "恢复出厂设置",
    factoryResetTitle: "恢复出厂设置",
    factoryResetMessage: "确定要将所有设置重置为默认值吗？这将删除所有配置文件并停止后端。",
    resetComplete: "重置完成",
    allDataCleared: "所有数据已清除",
    factoryResetComplete: "恢复出厂设置完成",
    allSettingsReset: "所有设置已重置为默认值",
  },

  // Developer Tools Section
  devTools: {
    title: "开发者工具",
    showTools: "显示工具",
    hideTools: "隐藏工具",
    checkNotifyServer: "检查通知服务器",
    viewUploadHistory: "查看上传历史",
    clearHistory: "清除历史",
  },

  // About Section
  about: {
    title: "关于",
    aboutPlugin: "关于此插件",
  },

  // Common
  common: {
    confirm: "确认",
    cancel: "取消",
    clear: "清除",
    reset: "重置",
    error: "错误",
    success: "成功",
    failed: "失败",
    files: "个文件",
  },

  // Modals
  modal: {
    sendText: "发送文本",
    enterTextContent: "输入文本内容",
    enterAlias: "输入别名",
    enterMulticastAddress: "输入组播地址",
    enterDownloadFolder: "输入下载文件夹路径",
    enterMulticastPort: "输入组播端口",
    enterPin: "输入 PIN 码",
  },

  // Toasts
  toast: {
    failedGetBackendStatus: "获取后端状态失败",
    failedLoadConfig: "加载配置失败",
    failedSelectFolder: "选择文件夹失败",
    failedSaveConfig: "保存配置失败",
    failedUpdateConfig: "更新配置失败",
    factoryResetFailed: "恢复出厂设置失败",
    confirmFailed: "确认失败",
    missingSessionId: "缺少会话ID",
    accepted: "已接受",
    rejected: "已拒绝",
    receiveConfirmed: "已确认接收",
    receiveRejected: "已拒绝接收",
    pinRequired: "需要 PIN 码",
    pinRequiredForFiles: "接收文件需要 PIN 码",
    notification: "通知",
  },

  // Confirm Receive Modal
  confirmReceive: {
    title: "收到文件",
    from: "来自",
    fileCount: "文件数量",
    accept: "接受",
    reject: "拒绝",
  },

  // Text Received Modal
  textReceived: {
    copyToClipboard: "复制到剪贴板",
    copied: "已复制！",
    close: "关闭",
  },
};
