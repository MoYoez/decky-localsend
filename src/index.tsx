import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  staticClasses,
  Field,
  Focusable,
  ToggleField,
  showModal,
} from "@decky/ui";
import {
  definePlugin,
  addEventListener,
  toaster,
  removeEventListener,
} from "@decky/api"

import { useLocalSendStore } from "./utils/store";
import { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";
import {FaEnvelope} from "react-icons/fa";
import DevicesPanel from "./components/device";
import { TextReceivedModal } from "./components/TextReceivedModal";
import { ConfirmReceiveModal } from "./components/ConfirmReceiveModal";
import { BasicInputBoxModal } from "./components/basicInputBoxModal";

import type { BackendStatus } from "./types/backend";
import type { UploadProgress } from "./types/upload";

import { getBackendConfig, getBackendStatus, setBackendConfig } from "./functions/api";
import { createBackendHandlers } from "./functions/backendHandlers";
import { createDeviceHandlers } from "./functions/deviceHandlers";
import { createFileHandlers } from "./functions/fileHandlers";
import { createUploadHandlers } from "./functions/uploadHandlers";
import { createDevToolsHandlers } from "./functions/devToolsHandlers";
import { proxyGet } from "./utils/proxyReq";
import { openFolder } from "./utils/openFolder";
// import { createTextHandlers } from "./functions/textHandlers"; // Reserved for future direct text sending

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
  const [showDevTools, setShowDevTools] = useState(false);
  const [configAlias, setConfigAlias] = useState("");
  const [downloadFolder, setDownloadFolder] = useState("");
  const [legacyMode, setLegacyMode] = useState(false);
  const [multicastAddress, setMulticastAddress] = useState("");
  const [multicastPort, setMulticastPort] = useState("");
  const [pin, setPin] = useState("");
  const [autoSave, setAutoSave] = useState(true);
  const [applyingConfig, setApplyingConfig] = useState(false);

  useEffect(() => {
    getBackendStatus().then(setBackend).catch((error) => {
      toaster.toast({
        title: "Failed to get backend status",
        body: `${error}`,
      });
    });
    getBackendConfig()
      .then((result) => {
        setConfigAlias(result.alias ?? "");
        setDownloadFolder(result.download_folder ?? "");
        setLegacyMode(!!result.legacy_mode);
        setMulticastAddress(result.multicast_address ?? "");
        setMulticastPort(result.multicast_port ? String(result.multicast_port) : "");
        setPin(result.pin ?? "");
        setAutoSave(!!result.auto_save);
      })
      .catch((error) => {
        toaster.toast({
          title: "Failed to load config",
          body: `${error}`,
        });
      });
  }, []);


  const { handleToggleBackend } = createBackendHandlers(setBackend);
  
  const { handleScan } = createDeviceHandlers(backend, setDevices, setLoading);
  
  const { handleFileSelect, handleFolderSelect } = createFileHandlers(addFile, uploading);
  
  const { handleUpload, handleClearFiles } = createUploadHandlers(
    selectedDevice,
    selectedFiles,
    setUploading,
    setUploadProgress,
    clearFiles
  );
  
  const { handleCheckNotifyStatus, handleViewUploadHistory, handleClearHistory } = createDevToolsHandlers();

  const handleChooseDownloadFolder = async () => {
    try {
      const result = await openFolder("/home/deck");
      const newPath = result.realpath ?? result.path;
      setDownloadFolder(newPath);
      await saveConfig({ download_folder: newPath });
    } catch (error) {
      toaster.toast({
        title: "Failed to select folder",
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
    const value = await openInputModal("Send Text", "Enter text content");
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
      title: "Text added",
      body: "Ready to send as .txt",
    });
  };

  // save config
  const saveConfig = async (updates: {
    alias?: string;
    download_folder?: string;
    legacy_mode?: boolean;
    multicast_address?: string;
    multicast_port?: string;
    pin?: string;
    auto_save?: boolean;
  }) => {
    try {
      const result = await setBackendConfig({
        alias: updates.alias ?? configAlias,
        download_folder: updates.download_folder ?? downloadFolder,
        legacy_mode: updates.legacy_mode ?? legacyMode,
        multicast_address: updates.multicast_address ?? multicastAddress,
        multicast_port: updates.multicast_port ?? multicastPort,
        pin: updates.pin ?? pin,
        auto_save: updates.auto_save ?? autoSave,
      });
      if (!result.success) {
        throw new Error(result.error ?? "Unknown error");
      }
      toaster.toast({
        title: "Config saved",
        body: result.restarted ? "Backend restarted" : "Restart backend to take effect",
      });
    } catch (error) {
      toaster.toast({
        title: "Failed to save config",
        body: `${error}`,
      });
    }
  };

  const handleEditAlias = async () => {
    const value = await openInputModal("Alias", "Enter alias");
    if (value !== null) {
      const newValue = value.trim();
      setConfigAlias(newValue);
      await saveConfig({ alias: newValue });
    }
  };

  const handleEditMulticastAddress = async () => {
    const value = await openInputModal("Multicast Address", "Enter multicast address");
    if (value !== null) {
      const newValue = value.trim();
      setMulticastAddress(newValue);
      await saveConfig({ multicast_address: newValue });
    }
  };

  const handleEditDownloadFolder = async () => {
    const value = await openInputModal("Download Folder", "Enter download folder path");
    if (value !== null) {
      const newValue = value.trim();
      setDownloadFolder(newValue);
      await saveConfig({ download_folder: newValue });
    }
  };

  const handleEditMulticastPort = async () => {
    const value = await openInputModal("Multicast Port", "Enter multicast port");
    if (value !== null) {
      const newValue = value.trim();
      setMulticastPort(newValue);
      await saveConfig({ multicast_port: newValue });
    }
  };

  const handleEditPin = async () => {
    const value = await openInputModal("PIN", "Enter PIN");
    if (value !== null) {
      const newValue = value.trim();
      setPin(newValue);
      await saveConfig({ pin: newValue });
    }
  };

  const handleToggleLegacyMode = async (checked: boolean) => {
    setLegacyMode(checked);
    await saveConfig({ legacy_mode: checked });
  };

  const handleToggleAutoSave = async (checked: boolean) => {
    setAutoSave(checked);
    await saveConfig({ auto_save: checked });
  };

  const handleApplyConfig = async () => {
    setApplyingConfig(true);
    try {
      const result = await setBackendConfig({
        alias: configAlias,
        download_folder: downloadFolder,
        legacy_mode: legacyMode,
        multicast_address: multicastAddress,
        multicast_port: multicastPort,
        pin,
        auto_save: autoSave,
      });
      if (!result.success) {
        throw new Error(result.error ?? "Unknown error");
      }
      toaster.toast({
        title: "Config updated",
        body: "Restart backend to take effect",
      });
    } catch (error) {
      toaster.toast({
        title: "Failed to update config",
        body: `${error}`,
      });
    } finally {
      setApplyingConfig(false);
    }
  };
  
  // Handle reset button
  const handleReset = () => {
    resetAll();
    setUploadProgress([]);
    toaster.toast({
      title: "Reset Complete",
      body: "All data has been cleared",
    });
  };

  return (
    <>
      <PanelSection title="LocalSend Backend">
        <PanelSectionRow>
          <ToggleField
            label="Backend Status"
            description={backend.running ? "Backend is running" : "Backend is stopped"}
            checked={backend.running}
            onChange={handleToggleBackend}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleScan} disabled={loading}>
            {loading ? "Scanning..." : "Scan Devices"}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleScan} disabled={loading}>
            Refresh Devices
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
      <DevicesPanel 
        devices={devices} 
        selectedDevice={selectedDevice}
        onSelectDevice={setSelectedDevice}
      />
      <PanelSection title="File Upload">
        <PanelSectionRow>
          <Field label="Selected Device">
            {selectedDevice ? selectedDevice.alias : "None"}
          </Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleFileSelect} disabled={uploading}>
            Choose File
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleFolderSelect} disabled={uploading}>
            Choose Folder
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleAddText} disabled={uploading}>
            Add Text
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={handleUpload}
            disabled={uploading || !selectedDevice || selectedFiles.length === 0}
          >
            {uploading ? "Uploading..." : "Confirm Send"}
          </ButtonItem>
        </PanelSectionRow>
        {selectedFiles.length > 0 && (
          <>
            <PanelSectionRow>
              <Field label="Selected Files">
                {selectedFiles.length} file(s)
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
                      {file.fileName}
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
                Clear Files
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}
        {uploadProgress.length > 0 && (
          <PanelSectionRow>
            <Field label="Upload Progress">
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
      <PanelSection title="Configuration">
        <PanelSectionRow>
          <Field label="Alias">
            {configAlias || "Default"}
          </Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleEditAlias}>
            Edit Alias
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <Field label="Download Folder">
            {downloadFolder || "Default"}
          </Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleEditDownloadFolder}>
            Edit Download Folder
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleChooseDownloadFolder}>
            Choose Download Folder
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <Field label="Multicast Address">
            {multicastAddress || "Default"}
          </Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleEditMulticastAddress}>
            Edit Multicast Address
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <Field label="Multicast Port">
            {multicastPort || "Default"}
          </Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleEditMulticastPort}>
            Edit Multicast Port
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label="Legacy Mode"
            description="Use legacy HTTP scan mode (scan every 30 seconds)"
            checked={legacyMode}
            onChange={handleToggleLegacyMode}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <Field label="PIN">{pin ? "Configured" : "Not set"}</Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleEditPin}>
            Edit PIN
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label="Auto Save"
            description="If disabled, require confirmation before receiving"
            checked={autoSave}
            onChange={handleToggleAutoSave}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleApplyConfig} disabled={applyingConfig}>
            APPLY
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
      <PanelSection title="Settings">
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleReset}>
            Reset All Data
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
      <PanelSection title="Developer Tools">
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => setShowDevTools(!showDevTools)}>
            {showDevTools ? "Hide Tools" : "Show Tools"}
          </ButtonItem>
        </PanelSectionRow>
        {showDevTools && (
          <>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleCheckNotifyStatus}>
                Check Notify Server
              </ButtonItem>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleViewUploadHistory}>
                View Upload History
              </ButtonItem>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={handleClearHistory}>
                Clear History
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}
      </PanelSection>
    </>
  );
};



export default definePlugin(() => {
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
                title: "Confirm failed",
                body: "Missing sessionId",
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
                title: confirmed ? "Accepted" : "Rejected",
                body: confirmed ? "Receive confirmed" : "Receive rejected",
              });
            } catch (error) {
              toaster.toast({
                title: "Confirm failed",
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
        title: event.title || "PIN Required",
        body: event.message || "PIN required for incoming files",
      });
      return;
    }

    toaster.toast({
      title: event.title || "Notification",
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
    },
  };
});
