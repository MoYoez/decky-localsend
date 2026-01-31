export const en = {
  // Backend Section
  backend: {
    title: "LocalSend Backend",
    status: "Backend Status",
    running: "Backend is running",
    stopped: "Backend is stopped",
    scanDevices: "Scan Devices",
    refreshDevices: "Refresh Devices",
    scanning: "Scanning...",
    availableDevices: "Available Devices",
    noDevices: "No devices",
    selected: "Selected",
  },

  // Network Info Section
  networkInfo: {
    title: "Info",
    number: "Number",
    ipAddress: "IP Address",
    multicastPort: "Multicast Port",
    noNetwork: "No network info",
  },

  // File Upload Section
  upload: {
    title: "File Upload",
    selectedDevice: "Selected Device",
    none: "None",
    chooseFile: "Choose File",
    chooseFolder: "Choose Folder",
    addText: "Add Text",
    confirmSend: "Confirm Send",
    uploading: "Uploading...",
    selectedFiles: "Selected Files",
    clearFiles: "Clear Files",
    uploadProgress: "Upload Progress",
    textAdded: "Text added",
    readyToSend: "Ready to send as .txt",
    folderAdded: "Folder added",
    folderFiles: "files",
  },

  // Configuration Section
  config: {
    title: "Configuration",
    alias: "Alias",
    default: "Default",
    editAlias: "Edit Alias",
    downloadFolder: "Download Folder",
    editDownloadFolder: "Edit Download Folder",
    chooseDownloadFolder: "Choose Download Folder",
    multicastAddress: "Multicast Address",
    editMulticastAddress: "Edit Multicast Address",
    multicastPort: "Multicast Port",
    editMulticastPort: "Edit Multicast Port",
    scanMode: "Scan Mode",
    scanModeDesc: "Mixed: UDP + HTTP | Normal: UDP multicast | HTTP: Legacy scan",
    scanModeMixed: "Mixed",
    scanModeNormal: "Normal",
    scanModeHTTP: "HTTP",
    skipNotify: "Skip Notify",
    skipNotifyDesc: "Skip notification when receiving files",
    pin: "PIN",
    pinConfigured: "Configured",
    pinNotSet: "Not set",
    editPin: "Edit PIN",
    clearPin: "Clear PIN",
    clearPinTitle: "Clear PIN",
    clearPinMessage: "Are you sure you want to clear the PIN?",
    autoSave: "Auto Save",
    autoSaveDesc: "If disabled, require confirmation before receiving",
    useHttps: "Use Encrypted Connection",
    useHttpsDesc: "Enable encrypted connection (HTTPS). Disable for unencrypted (HTTP)",
    notifyOnDownload: "Notify on Download Complete",
    notifyOnDownloadDesc: "Show notification when file download is complete",
    saveReceiveHistory: "Save Receive History",
    saveReceiveHistoryDesc: "Save received file history for later viewing",
    disableInfoLogging: "Disable INFO Logging",
    disableInfoLoggingDesc: "Disable backend INFO level logging, only show error logs",
    apply: "APPLY",
    configSaved: "Config saved",
    backendRestarted: "Backend restarted",
    restartToTakeEffect: "Restart backend to take effect",
    configUpdated: "Config updated",
  },

  // Settings Section
  settings: {
    title: "Settings",
    resetAllData: "Reset All Data",
    factoryResetTitle: "Reset All Data",
    factoryResetMessage: "Are you sure you want to reset all settings to default?\n\nThis will delete all configuration files and stop the backend.",
    resetComplete: "Reset Complete",
    allDataCleared: "All data has been cleared",
    factoryResetComplete: "Reset Complete",
    allSettingsReset: "All settings have been reset to default",
  },

  // Developer Tools Section
  devTools: {
    title: "Developer Tools",
    showTools: "Show Tools",
    hideTools: "Hide Tools",
    checkNotifyServer: "Check Notify Server",
    viewUploadHistory: "View Upload History",
    clearHistory: "Clear History",
  },

  // About Section
  about: {
    title: "About",
    aboutPlugin: "About This Plugin",
  },

  // Common
  common: {
    confirm: "Confirm",
    cancel: "Cancel",
    clear: "Clear",
    reset: "Reset",
    error: "Error",
    success: "Success",
    failed: "Failed",
    files: "file(s)",
  },

  // Modals
  modal: {
    sendText: "Send Text",
    enterTextContent: "Enter text content",
    enterAlias: "Enter alias",
    enterMulticastAddress: "Enter multicast address",
    enterDownloadFolder: "Enter download folder path",
    enterMulticastPort: "Enter multicast port",
    enterPin: "Enter PIN",
  },

  // Toasts
  toast: {
    failedGetBackendStatus: "Failed to get backend status",
    failedLoadConfig: "Failed to load config",
    failedSelectFolder: "Failed to select folder",
    failedSaveConfig: "Failed to save config",
    failedUpdateConfig: "Failed to update config",
    factoryResetFailed: "Reset Failed",
    confirmFailed: "Confirm failed",
    missingSessionId: "Missing sessionId",
    accepted: "Accepted",
    rejected: "Rejected",
    receiveConfirmed: "Receive confirmed",
    receiveRejected: "Receive rejected",
    pinRequired: "PIN Required",
    pinRequiredForFiles: "PIN required for incoming files",
    notification: "Notification",
  },

  // Confirm Receive Modal
  confirmReceive: {
    title: "Incoming Files",
    from: "From",
    fileCount: "File count",
    accept: "Accept",
    reject: "Reject",
  },

  // Text Received Modal
  textReceived: {
    copyToClipboard: "Copy to Clipboard",
    copied: "Copied!",
    close: "Close",
  },

  // File Received Modal
  fileReceived: {
    folderPath: "Folder Path",
    fileCount: "File Count",
    files: "Files",
    copyPath: "Copy Path",
    pathCopied: "Path Copied!",
    close: "Close",
  },

  // Receive History
  receiveHistory: {
    title: "Receive History",
    loading: "Loading...",
    refresh: "Refresh",
    empty: "No receive history",
    recordCount: "Records",
    clearAll: "Clear All",
    clearAllTitle: "Clear History",
    clearAllMessage: "Are you sure you want to clear all receive history?",
    cleared: "History cleared",
    disabled: "Receive history is disabled",
    justNow: "Just now",
    minutesAgo: "min ago",
    hoursAgo: "hours ago",
    daysAgo: "days ago",
    textReceived: "Text",
  },

  // Screenshot Gallery (Experimental)
  screenshot: {
    title: "Steam Screenshots",
    openGallery: "Browse Screenshots",
    experimental: "Experimental Feature",
    warning: "This feature will show screenshot gallery, which may scan your steam screenshots directory",
    warningDetails: "This feature will scan screenshot files in ~/.local/share/Steam/userdata/ directory. This is an experimental feature. Do you want to continue?",
    understand: "I Understand",
    gallery: "Screenshot Gallery",
    loading: "Loading...",
    noScreenshots: "No screenshots found",
    selectAll: "Select All",
    selected: "Selected",
    preview: "Preview",
    refresh: "Refresh",
    addToQueue: "Add to Queue",
    noSelection: "No screenshots selected",
    pleaseSelectScreenshots: "Please select at least one screenshot",
    loadFailed: "Failed to load screenshots",
    imageNotLoaded: "Image not loaded yet",
    added: "Screenshots Added",
    screenshotsAdded: "screenshot(s) added to send queue",
    page: "Page",
    prevPage: "Previous",
    nextPage: "Next",
  },

  unknownError: "Unknown error",
};

export type TranslationKeys = typeof en;
