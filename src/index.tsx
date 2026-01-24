import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  staticClasses,
  Field,
  Focusable,
  ToggleField,
  DropdownItem,
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
import { FaShareAlt, FaTimes } from "react-icons/fa";
import DevicesPanel from "./components/device";
import { TextReceivedModal } from "./components/TextReceivedModal";

import type { BackendStatus } from "./types/backend";
import type { UploadProgress } from "./types/upload";

import { getBackendStatus, getNetworkInterfaceSetting, getNetworkInterfaces, setNetworkInterfaceSetting } from "./functions/api";
import { createBackendHandlers } from "./functions/backendHandlers";
import { createDeviceHandlers } from "./functions/deviceHandlers";
import { createFileHandlers } from "./functions/fileHandlers";
import { createUploadHandlers } from "./functions/uploadHandlers";
import { createDevToolsHandlers } from "./functions/devToolsHandlers";
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
  const [networkInterface, setNetworkInterface] = useState("");
  const [applyingNetworkInterface, setApplyingNetworkInterface] = useState(false);
  const [networkInterfaces, setNetworkInterfaces] = useState<{ name: string; ipv4: string[] }[]>([]);

  useEffect(() => {
    getBackendStatus().then(setBackend).catch((error) => {
      toaster.toast({
        title: "Failed to get backend status",
        body: `${error}`,
      });
    });
    getNetworkInterfaceSetting()
      .then((result) => setNetworkInterface(result.interface ?? ""))
      .catch((error) => {
        toaster.toast({
          title: "Failed to load network interface",
          body: `${error}`,
        });
      });
    getNetworkInterfaces()
      .then((result) => setNetworkInterfaces(result.interfaces ?? []))
      .catch((error) => {
        toaster.toast({
          title: "Failed to load interfaces",
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

  const handleApplyNetworkInterface = async () => {
    setApplyingNetworkInterface(true);
    try {
      const result = await setNetworkInterfaceSetting(networkInterface);
      if (!result.success) {
        throw new Error(result.error ?? "Unknown error");
      }
      setNetworkInterface(result.interface ?? "");
      if (result.restarted) {
        setBackend((prev) => ({ ...prev, running: result.running }));
      }
      toaster.toast({
        title: "Network interface updated",
        body: result.restarted
          ? "Backend restarted to apply changes"
          : "Saved. Restart backend to apply changes",
      });
    } catch (error) {
      toaster.toast({
        title: "Failed to update interface",
        body: `${error}`,
      });
    } finally {
      setApplyingNetworkInterface(false);
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
      <PanelSection title="Settings">
        <PanelSectionRow>
          <DropdownItem
            label="Network Interface"
            description="Leave empty for default. Use * for all interfaces."
            disabled={applyingNetworkInterface}
            rgOptions={[
              { data: "", label: "Default" },
              { data: "*", label: "All Interfaces (*)" },
              ...networkInterfaces.map((iface) => ({
                data: iface.name,
                label: iface.ipv4.length
                  ? `${iface.name} (${iface.ipv4.join(", ")})`
                  : iface.name,
              })),
            ]}
            selectedOption={{
              data: networkInterface,
              label:
                networkInterface === ""
                  ? "Default"
                  : networkInterface === "*"
                  ? "All Interfaces (*)"
                  : networkInterface,
            }}
            onChange={(option: { data: string }) => setNetworkInterface(option.data)}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={handleApplyNetworkInterface}
            disabled={applyingNetworkInterface}
          >
            {applyingNetworkInterface ? "Applying..." : "Apply and Restart Backend"}
          </ButtonItem>
        </PanelSectionRow>
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
  const EmitEventListener = addEventListener("unix_socket_notification", (event: { title: string; message: string }) => {
    toaster.toast({
      title: event.title,
      body: event.message,
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
    icon: <FaShareAlt />,
    // The function triggered when your plugin unloads
    onDismount() {
      console.log("Unloading");
      removeEventListener("unix_socket_notification", EmitEventListener);
      removeEventListener("text_received", TextReceivedListener);
    },
  };
});
