import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  staticClasses,
  Field,
  Focusable,
  ToggleField,
  SliderField,
  showModal,
  Router
} from "@decky/ui";
import {
  definePlugin,
  addEventListener,
  toaster,
  removeEventListener,
  routerHook,
} from "@decky/api"

import { useLocalSendStore } from "./utils/store";
import { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import {FaEnvelope} from "react-icons/fa";
import DevicesPanel from "./components/device";
import { TextReceivedModal } from "./components/TextReceivedModal";
import { ConfirmReceiveModal } from "./components/ConfirmReceiveModal";
import { FileReceivedModal } from "./components/FileReceivedModal";
import { BasicInputBoxModal } from "./components/basicInputBoxModal";
import { ReceiveHistoryPanel } from "./components/ReceiveHistoryPanel";
import { ScreenshotGalleryModal } from "./components/ScreenshotGalleryModal";

import type { BackendStatus } from "./types/backend";
import type { UploadProgress } from "./types/upload";
import type { NetworkInfo } from "./types/devices";

import { getBackendConfig, getBackendStatus, setBackendConfig, factoryReset } from "./functions/api";
import { ConfirmModal } from "./components/ConfirmModal";
import { About } from "./About";
import { t } from "./i18n";

// Scan Mode Enum
enum ScanMode {
  Mixed = 0,   // Mixed Scan (UDP + HTTP) - Default
  Normal = 1,  // Normal Scan (UDP multicast)
  HTTP = 2,    // HTTP Scan (legacy mode)
}

// Scan Mode Labels for SliderField
const scanModeNotchLabels = [
  { notchIndex: 0, label: "Mixed", value: 0 },
  { notchIndex: 1, label: "Normal", value: 1 },
  { notchIndex: 2, label: "HTTP", value: 2 },
];

// Convert config flags to ScanMode
const configToScanMode = (legacyMode: boolean, useMixedScan: boolean): ScanMode => {
  if (useMixedScan) return ScanMode.Mixed;
  if (legacyMode) return ScanMode.HTTP;
  return ScanMode.Normal;
};

// Convert ScanMode to config flags
const scanModeToConfig = (mode: ScanMode): { legacy_mode: boolean; use_mixed_scan: boolean } => {
  switch (mode) {
    case ScanMode.Mixed:
      return { legacy_mode: false, use_mixed_scan: true };
    case ScanMode.Normal:
      return { legacy_mode: false, use_mixed_scan: false };
    case ScanMode.HTTP:
      return { legacy_mode: true, use_mixed_scan: false };
    default:
      return { legacy_mode: false, use_mixed_scan: true }; // Default to Mixed
  }
};
import { createBackendHandlers } from "./functions/backendHandlers";
import { createDeviceHandlers } from "./functions/deviceHandlers";
import { createFileHandlers } from "./functions/fileHandlers";
import { createUploadHandlers } from "./functions/uploadHandlers";
import { proxyGet } from "./utils/proxyReq";
import { openFolder } from "./utils/openFolder";

function Content() {

  const devices = useLocalSendStore((state) => state.devices);
  const setDevices = useLocalSendStore((state) => state.setDevices);
  const selectedDevice = useLocalSendStore((state) => state.selectedDevice);
  const setSelectedDevice = useLocalSendStore((state) => state.setSelectedDevice);
  const selectedFiles = useLocalSendStore((state) => state.selectedFiles);
  const addFile = useLocalSendStore((state) => state.addFile);
  const removeFile = useLocalSendStore((state) => state.removeFile);
  const clearFiles = useLocalSendStore((state) => state.clearFiles);
  const resetAll = useLocalSendStore((state) => state.resetAll);
  
  // Default config
  const [backend, setBackend] = useState<BackendStatus>({
    running: false,
    url: "https://127.0.0.1:53317",
  });
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [uploading, setUploading] = useState(false);
  const [configAlias, setConfigAlias] = useState("");
  const [downloadFolder, setDownloadFolder] = useState("");
  const [scanMode, setScanMode] = useState<ScanMode>(ScanMode.Mixed);
  const [skipNotify, setSkipNotify] = useState(false);
  const [multicastAddress, setMulticastAddress] = useState("");
  const [multicastPort, setMulticastPort] = useState("");
  const [pin, setPin] = useState("");
  const [autoSave, setAutoSave] = useState(true);
  const [useHttps, setUseHttps] = useState(true);
  const [notifyOnDownload, setNotifyOnDownload] = useState(false);
  const [saveReceiveHistory, setSaveReceiveHistory] = useState(true);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo[]>([]);
  const [enableExperimental, setEnableExperimental] = useState(false);
  const [disableInfoLogging, setDisableInfoLogging] = useState(false);

  // Fetch network info when backend is running
  const fetchNetworkInfo = async () => {
    if (!backend.running) {
      setNetworkInfo([]);
      return;
    }
    try {
      const result = await proxyGet("/api/self/v1/get-network-info");
      if (result.status === 200 && result.data?.data) {
        // Filter out tun interfaces
        const filtered = (result.data.data as NetworkInfo[]).filter(
          (info) => !info.interface_name.startsWith("tun")
        );
        setNetworkInfo(filtered);
      }
    } catch (error) {
      console.error("Failed to fetch network info:", error);
    }
  };

  useEffect(() => {
    getBackendStatus().then(setBackend).catch((error) => {
      toaster.toast({
        title: t("toast.failedGetBackendStatus"),
        body: `${error}`,
      });
    });
    getBackendConfig()
      .then((result) => {
        setConfigAlias(result.alias ?? "");
        setDownloadFolder(result.download_folder ?? "");
        setScanMode(configToScanMode(!!result.legacy_mode, !!result.use_mixed_scan));
        setSkipNotify(!!result.skip_notify);
        setMulticastAddress(result.multicast_address ?? "");
        setMulticastPort(result.multicast_port ? String(result.multicast_port) : "");
        setPin(result.pin ?? "");
        setAutoSave(!!result.auto_save);
        setUseHttps(result.use_https !== false);
        setNotifyOnDownload(!!result.notify_on_download);
        setSaveReceiveHistory(result.save_receive_history !== false);
        setEnableExperimental(!!result.enable_experimental);
        setDisableInfoLogging(!!result.disable_info_logging);
      })
      .catch((error) => {
        toaster.toast({
          title: t("toast.failedLoadConfig"),
          body: `${error}`,
        });
      });
  }, []);

  // Fetch network info when backend status changes
  useEffect(() => {
    fetchNetworkInfo();
  }, [backend.running]);


  const { handleToggleBackend } = createBackendHandlers(setBackend);
  
  const { handleScan } = createDeviceHandlers(backend, setDevices, setLoading, selectedDevice, setSelectedDevice);
  
  const { handleFileSelect, handleFolderSelect } = createFileHandlers(addFile, uploading);
  
  const { handleUpload, handleClearFiles } = createUploadHandlers(
    selectedDevice,
    selectedFiles,
    setUploading,
    setUploadProgress,
    clearFiles
  );

  const handleChooseDownloadFolder = async () => {
    try {
      const result = await openFolder("/home/deck");
      const newPath = result.realpath ?? result.path;
      setDownloadFolder(newPath);
      await saveConfig({ download_folder: newPath });
    } catch (error) {
      toaster.toast({
        title: t("toast.failedSelectFolder"),
        body: String(error),
      });
    }
  };

  const openInputModal = (title: string, label: string) =>
    new Promise<string | null>((resolve) => {
      const modal = showModal(
        <BasicInputBoxModal
          title={title}
          label={label}
          onSubmit={(value) => {
            resolve(value);
            modal.Close();
          }}
          onCancel={() => {
            resolve(null);
            modal.Close();
          }}
          closeModal={() => modal.Close()}
        />
      );
    });

  const handleAddText = async () => {
    const value = await openInputModal(t("modal.sendText"), t("modal.enterTextContent"));
    if (value === null) {
      return;
    }
    const now = Date.now();
    addFile({
      id: `text-${now}-${Math.random().toString(16).slice(2)}`,
      fileName: `text-${now}.txt`,
      sourcePath: "",
      textContent: value,
    });
    toaster.toast({
      title: t("upload.textAdded"),
      body: t("upload.readyToSend"),
    });
  };

  // Handle screenshot gallery (experimental)
  const handleOpenScreenshotGallery = () => {
    // Show warning modal first
    const warningModal = showModal(
      <ConfirmModal
        title={t("screenshot.experimental")}
        message={t("screenshot.warningDetails")}
        confirmText={t("screenshot.understand")}
        cancelText={t("common.cancel")}
        onConfirm={() => {
          // Open screenshot gallery
          const galleryModal = showModal(
            <ScreenshotGalleryModal
              backendUrl={backend.url}
              onSelectScreenshots={(screenshots) => {
                // Add selected screenshots to upload queue
                screenshots.forEach((screenshot) => {
                  const now = Date.now();
                  addFile({
                    id: `screenshot-${now}-${Math.random().toString(16).slice(2)}`,
                    fileName: screenshot.filename,
                    sourcePath: screenshot.path,
                  });
                });
                toaster.toast({
                  title: t("screenshot.added"),
                  body: `${screenshots.length} ${t("screenshot.screenshotsAdded")}`,
                });
              }}
              closeModal={() => galleryModal.Close()}
            />
          );
        }}
        closeModal={() => warningModal.Close()}
      />
    );
  };

  // Reload config from backend
  const reloadConfig = async () => {
    try {
      const result = await getBackendConfig();
      setConfigAlias(result.alias ?? "");
      setDownloadFolder(result.download_folder ?? "");
      setScanMode(configToScanMode(!!result.legacy_mode, !!result.use_mixed_scan));
      setSkipNotify(!!result.skip_notify);
      setMulticastAddress(result.multicast_address ?? "");
      setMulticastPort(result.multicast_port ? String(result.multicast_port) : "");
      setPin(result.pin ?? "");
      setAutoSave(!!result.auto_save);
      setUseHttps(result.use_https !== false);
      setNotifyOnDownload(!!result.notify_on_download);
      setSaveReceiveHistory(result.save_receive_history !== false);
      setEnableExperimental(!!result.enable_experimental);
      setDisableInfoLogging(!!result.disable_info_logging);
    } catch (error) {
      console.error("Failed to reload config:", error);
    }
  };

  // save config
  const saveConfig = async (updates: {
    alias?: string;
    download_folder?: string;
    scan_mode?: ScanMode;
    skip_notify?: boolean;
    multicast_address?: string;
    multicast_port?: string;
    pin?: string;
    auto_save?: boolean;
    use_https?: boolean;
    notify_on_download?: boolean;
    save_receive_history?: boolean;
    enable_experimental?: boolean;
    disable_info_logging?: boolean;
  }) => {
    try {
      const currentScanMode = updates.scan_mode ?? scanMode;
      const scanModeFlags = scanModeToConfig(currentScanMode);
      const result = await setBackendConfig({
        alias: updates.alias ?? configAlias,
        download_folder: updates.download_folder ?? downloadFolder,
        legacy_mode: scanModeFlags.legacy_mode,
        use_mixed_scan: scanModeFlags.use_mixed_scan,
        skip_notify: updates.skip_notify ?? skipNotify,
        multicast_address: updates.multicast_address ?? multicastAddress,
        multicast_port: updates.multicast_port ?? multicastPort,
        pin: updates.pin ?? pin,
        auto_save: updates.auto_save ?? autoSave,
        use_https: updates.use_https ?? useHttps,
        notify_on_download: updates.notify_on_download ?? notifyOnDownload,
        save_receive_history: updates.save_receive_history ?? saveReceiveHistory,
        enable_experimental: updates.enable_experimental ?? enableExperimental,
        disable_info_logging: updates.disable_info_logging ?? disableInfoLogging,
      });
      if (!result.success) {
        throw new Error(result.error ?? "Unknown error");
      }
      // Reload config from backend to ensure UI is in sync
      await reloadConfig();
      toaster.toast({
        title: t("config.configSaved"),
        body:  t("config.restartToTakeEffect"),
      });
    } catch (error) {
      toaster.toast({
        title: t("toast.failedSaveConfig"),
        body: `${error}`,
      });
    }
  };

  const handleEditAlias = async () => {
    const value = await openInputModal(t("config.alias"), t("modal.enterAlias"));
    if (value !== null) {
      const newValue = value.trim();
      setConfigAlias(newValue);
      await saveConfig({ alias: newValue });
    }
  };

  const handleEditMulticastAddress = async () => {
    const value = await openInputModal(t("config.multicastAddress"), t("modal.enterMulticastAddress"));
    if (value !== null) {
      const newValue = value.trim();
      setMulticastAddress(newValue);
      await saveConfig({ multicast_address: newValue });
    }
  };

  const handleEditDownloadFolder = async () => {
    const value = await openInputModal(t("config.downloadFolder"), t("modal.enterDownloadFolder"));
    if (value !== null) {
      const newValue = value.trim();
      setDownloadFolder(newValue);
      await saveConfig({ download_folder: newValue });
    }
  };

  const handleEditMulticastPort = async () => {
    const value = await openInputModal(t("config.multicastPort"), t("modal.enterMulticastPort"));
    if (value !== null) {
      const newValue = value.trim();
      setMulticastPort(newValue);
      await saveConfig({ multicast_port: newValue });
    }
  };

  const handleEditPin = async () => {
    const value = await openInputModal(t("config.pin"), t("modal.enterPin"));
    if (value !== null) {
      const newValue = value.trim();
      setPin(newValue);
      await saveConfig({ pin: newValue });
    }
  };

  const handleClearPin = () => {
    const modal = showModal(
      <ConfirmModal
        title={t("config.clearPinTitle")}
        message={t("config.clearPinMessage")}
        confirmText={t("common.clear")}
        cancelText={t("common.cancel")}
        onConfirm={async () => {
          setPin("");
          await saveConfig({ pin: "" });
        }}
        closeModal={() => modal.Close()}
      />
    );
  };

  const handleScanModeChange = async (value: number) => {
    const mode = value as ScanMode;
    setScanMode(mode);
    await saveConfig({ scan_mode: mode });
  };

  const handleToggleSkipNotify = async (checked: boolean) => {
    setSkipNotify(checked);
    await saveConfig({ skip_notify: checked });
  };

  const handleToggleAutoSave = async (checked: boolean) => {
    setAutoSave(checked);
    await saveConfig({ auto_save: checked });
  };

  const handleToggleUseHttps = async (checked: boolean) => {
    setUseHttps(checked);
    await saveConfig({ use_https: checked });
  };

  const handleToggleNotifyOnDownload = async (checked: boolean) => {
    setNotifyOnDownload(checked);
    await saveConfig({ notify_on_download: checked });
  };

  const handleToggleSaveReceiveHistory = async (checked: boolean) => {
    setSaveReceiveHistory(checked);
    await saveConfig({ save_receive_history: checked });
  };

  const handleToggleExperimental = async (checked: boolean) => {
    setEnableExperimental(checked);
    // Save config without showing restart toast
    try {
      const currentScanMode = scanMode;
      const scanModeFlags = scanModeToConfig(currentScanMode);
      const result = await setBackendConfig({
        alias: configAlias,
        download_folder: downloadFolder,
        legacy_mode: scanModeFlags.legacy_mode,
        use_mixed_scan: scanModeFlags.use_mixed_scan,
        skip_notify: skipNotify,
        multicast_address: multicastAddress,
        multicast_port: multicastPort,
        pin: pin,
        auto_save: autoSave,
        use_https: useHttps,
        notify_on_download: notifyOnDownload,
        save_receive_history: saveReceiveHistory,
        enable_experimental: checked,
        disable_info_logging: disableInfoLogging,
      });
      if (!result.success) {
        throw new Error(result.error ?? "Unknown error");
      }
      // Reload config from backend to ensure UI is in sync
      await reloadConfig();
    } catch (error) {
      toaster.toast({
        title: t("toast.failedSaveConfig"),
        body: `${error}`,
      });
    }
  };

  const handleToggleDisableInfoLogging = async (checked: boolean) => {
    setDisableInfoLogging(checked);
    await saveConfig({ disable_info_logging: checked });
  };
  
  // Handle factory reset
  const handleFactoryReset = () => {
    const modal = showModal(
      <ConfirmModal
        title={t("settings.factoryResetTitle")}
        message={t("settings.factoryResetMessage")}
        confirmText={t("common.reset")}
        cancelText={t("common.cancel")}
        onConfirm={async () => {
          try {
            const result = await factoryReset();
            if (result.success) {
              // Reset local state to defaults
              setConfigAlias("");
              setDownloadFolder("");
              setScanMode(ScanMode.Normal);
              setSkipNotify(false);
              setMulticastAddress("");
              setMulticastPort("");
              setPin("");
              setAutoSave(true);
              setUseHttps(true);
              setNotifyOnDownload(false);
              setSaveReceiveHistory(true);
              setEnableExperimental(false);
              setDisableInfoLogging(false);
              setBackend({ running: false, url: "https://127.0.0.1:53317" });
              resetAll();
              setUploadProgress([]);
              
              toaster.toast({
                title: t("settings.factoryResetComplete"),
                body: t("settings.allSettingsReset"),
              });
            } else {
              throw new Error(result.error ?? "Unknown error");
            }
          } catch (error) {
            toaster.toast({
              title: t("toast.factoryResetFailed"),
              body: String(error),
            });
          }
        }}
        closeModal={() => modal.Close()}
      />
    );
  };

  return (
    <>
      <PanelSection title={t("backend.title")}>
        <PanelSectionRow>
          <ToggleField
            label={t("backend.status")}
            description={backend.running ? t("backend.running") : t("backend.stopped")}
            checked={backend.running}
            onChange={handleToggleBackend}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleScan} disabled={loading}>
            {loading ? t("backend.scanning") : t("backend.scanDevices")}
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
      <PanelSection title={t("networkInfo.title")}>
        {networkInfo.length === 0 ? (
          <PanelSectionRow>
            <div>{t("networkInfo.noNetwork")}</div>
          </PanelSectionRow>
        ) : (
          networkInfo.map((info, index) => (
            <PanelSectionRow key={`${info.interface_name}-${index}`}>
              <Field label={info.number}>
                {info.ip_address}
              </Field>
            </PanelSectionRow>
          ))
        )}
        <PanelSectionRow>
          <Field label={t("networkInfo.multicastPort")}>
            {multicastPort || t("config.default")}
          </Field>
        </PanelSectionRow>
      </PanelSection>
      <DevicesPanel 
        devices={devices} 
        selectedDevice={selectedDevice}
        onSelectDevice={setSelectedDevice}
      />
      <PanelSection title={t("upload.title")}>
        <PanelSectionRow>
          <Field label={t("upload.selectedDevice")}>
            {selectedDevice ? selectedDevice.alias : t("upload.none")}
          </Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleFileSelect} disabled={uploading}>
            {t("upload.chooseFile")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleFolderSelect} disabled={uploading}>
            {t("upload.chooseFolder")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleAddText} disabled={uploading}>
            {t("upload.addText")}
          </ButtonItem>
        </PanelSectionRow>
        {enableExperimental && (
          <PanelSectionRow>
            <ButtonItem 
              layout="below" 
              onClick={handleOpenScreenshotGallery} 
              disabled={uploading}
            >
              📷 {t("screenshot.openGallery")}
            </ButtonItem>
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={handleUpload}
            disabled={uploading || !selectedDevice || selectedFiles.length === 0}
          >
            {uploading ? t("upload.uploading") : t("upload.confirmSend")}
          </ButtonItem>
        </PanelSectionRow>
        {selectedFiles.length > 0 && (
          <>
            <PanelSectionRow>
              <Field label={t("upload.selectedFiles")}>
                {selectedFiles.length} {t("common.files")}
              </Field>
            </PanelSectionRow>
            <PanelSectionRow>
              <Focusable style={{ maxHeight: '150px', overflowY: 'auto' }}>
                {selectedFiles.map((file) => (
                  <div 
                    key={file.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '4px 0', 
                      fontSize: '12px' 
                    }}
                  >
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {file.isFolder 
                        ? `📁 ${file.fileName} (${file.fileCount} ${t("upload.folderFiles")})`
                        : file.fileName
                      }
                    </span>
                    <button
                      onClick={() => removeFile(file.id)}
                      disabled={uploading}
                      style={{
                        marginLeft: '8px',
                        padding: '2px 6px',
                        fontSize: '10px',
                        backgroundColor: '#dc3545',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: uploading ? 'not-allowed' : 'pointer',
                        opacity: uploading ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                    >
                      <FaTimes size={10} />
                    </button>
                  </div>
                ))}
              </Focusable>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleClearFiles} disabled={uploading}>
                {t("upload.clearFiles")}
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}
        {uploadProgress.length > 0 && (
          <PanelSectionRow>
            <Field label={t("upload.uploadProgress")}>
              <Focusable style={{ maxHeight: '150px', overflowY: 'auto' }}>
                {uploadProgress.map((progress) => (
                  <div key={progress.fileId} style={{ padding: '4px 0', fontSize: '12px' }}>
                    {progress.fileName}: {progress.status}
                    {progress.error && ` - ${progress.error}`}
                  </div>
                ))}
              </Focusable>
            </Field>
          </PanelSectionRow>
        )}
      </PanelSection>
      <ReceiveHistoryPanel saveReceiveHistory={saveReceiveHistory} />
      <PanelSection title={t("config.title")}>
        <PanelSectionRow>
          <Field label={t("config.alias")}>
            {configAlias || t("config.default")}
          </Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleEditAlias}>
            {t("config.editAlias")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <Field label={t("config.downloadFolder")}>
            {downloadFolder || t("config.default")}
          </Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleEditDownloadFolder}>
            {t("config.editDownloadFolder")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleChooseDownloadFolder}>
            {t("config.chooseDownloadFolder")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <Field label={t("config.multicastAddress")}>
            {multicastAddress || t("config.default")}
          </Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleEditMulticastAddress}>
            {t("config.editMulticastAddress")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <Field label={t("config.multicastPort")}>
            {multicastPort || t("config.default")}
          </Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleEditMulticastPort}>
            {t("config.editMulticastPort")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <SliderField
            label={t("config.scanMode")}
            description={t("config.scanModeDesc")}
            value={scanMode}
            min={0}
            max={scanModeNotchLabels.length - 1}
            notchCount={scanModeNotchLabels.length}
            notchLabels={scanModeNotchLabels}
            notchTicksVisible={true}
            step={1}
            onChange={handleScanModeChange}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label={t("config.skipNotify")}
            description={t("config.skipNotifyDesc")}
            checked={skipNotify}
            onChange={handleToggleSkipNotify}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <Field label={t("config.pin")}>{pin ? t("config.pinConfigured") : t("config.pinNotSet")}</Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleEditPin}>
            {t("config.editPin")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleClearPin} disabled={!pin}>
            {t("config.clearPin")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label={t("config.autoSave")}
            description={t("config.autoSaveDesc")}
            checked={autoSave}
            onChange={handleToggleAutoSave}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label={t("config.useHttps")}
            description={t("config.useHttpsDesc")}
            checked={useHttps}
            onChange={handleToggleUseHttps}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label={t("config.notifyOnDownload")}
            description={t("config.notifyOnDownloadDesc")}
            checked={notifyOnDownload}
            onChange={handleToggleNotifyOnDownload}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label={t("config.saveReceiveHistory")}
            description={t("config.saveReceiveHistoryDesc")}
            checked={saveReceiveHistory}
            onChange={handleToggleSaveReceiveHistory}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label={t("config.disableInfoLogging")}
            description={t("config.disableInfoLoggingDesc")}
            checked={disableInfoLogging}
            onChange={handleToggleDisableInfoLogging}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label={t("screenshot.experimental")}
            description={t("screenshot.warning")}
            checked={enableExperimental}
            onChange={handleToggleExperimental}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleFactoryReset}>
            {t("settings.resetAllData")}
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
      <PanelSection title={t("about.title")}>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => {
              Router.CloseSideMenus();
              Router.Navigate("/decky-localsend-about");
            }}
          >
            {t("about.aboutPlugin")}
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </>
  );
};



export default definePlugin(() => {
  // Register About page route
  routerHook.addRoute("/decky-localsend-about", About, { exact: true });

  const EmitEventListener = addEventListener("unix_socket_notification", (event: { type?: string; title?: string; message?: string; data?: any }) => {
    if (event.type === "confirm_recv") {
      const data = event.data ?? {};
      const sessionId = String(data.sessionId || "");
      const modalResult = showModal(
        <ConfirmReceiveModal
          from={String(data.from || "")}
          fileCount={Number(data.fileCount || 0)}
          files={Array.isArray(data.files) ? data.files : []}
          onConfirm={async (confirmed) => {
            if (!sessionId) {
              toaster.toast({
                title: t("toast.confirmFailed"),
                body: t("toast.missingSessionId"),
              });
              return;
            }
            try {
              const result = await proxyGet(
                `/api/self/v1/confirm-recv?sessionId=${encodeURIComponent(sessionId)}&confirmed=${confirmed}`
              );
              if (result.status !== 200) {
                throw new Error(result.data?.error || "Confirm request failed");
              }
              toaster.toast({
                title: confirmed ? t("toast.accepted") : t("toast.rejected"),
                body: confirmed ? t("toast.receiveConfirmed") : t("toast.receiveRejected"),
              });
            } catch (error) {
              toaster.toast({
                title: t("toast.confirmFailed"),
                body: String(error),
              });
            }
          }}
          closeModal={() => modalResult.Close()}
        />
      );
      return;
    }

    if (event.type === "pin_required") {
      toaster.toast({
        title: event.title || t("toast.pinRequired"),
        body: event.message || t("toast.pinRequiredForFiles"),
      });
      return;
    }

    toaster.toast({
      title: event.title || t("toast.notification"),
      body: event.message || "",
    });
  });

  // Listen for text received events from backend
  const TextReceivedListener = addEventListener("text_received", (event: { title: string; content: string; fileName: string }) => {
    const modalResult = showModal(
      <TextReceivedModal
        title={event.title}
        content={event.content}
        fileName={event.fileName}
        onClose={() => {}}
        closeModal={() => modalResult.Close()}
      />
    );
  });

  // Listen for file received events from backend
  const FileReceivedListener = addEventListener("file_received", (event: { title: string; folderPath: string; fileCount: number; files: string[] }) => {
    const modalResult = showModal(
      <FileReceivedModal
        title={event.title}
        folderPath={event.folderPath}
        fileCount={event.fileCount}
        files={event.files}
        onClose={() => {}}
        closeModal={() => modalResult.Close()}
      />
    );
  });

  return {
    // The name shown in various decky menus
    name: "LocalSend",
    // The element displayed at the top of your plugin's menu
    titleView: <div className={staticClasses.Title}>decky-LocalSend</div>,
    // The content of your plugin's menu
    content: <Content />,
    // The icon displayed in the plugin list
    icon: <FaEnvelope />,
    // The function triggered when your plugin unloads
    onDismount() {
      console.log("Unloading");
      removeEventListener("unix_socket_notification", EmitEventListener);
      removeEventListener("text_received", TextReceivedListener);
      removeEventListener("file_received", FileReceivedListener);
      routerHook.removeRoute("/decky-localsend-about");
    },
  };
});
