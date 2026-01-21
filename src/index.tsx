import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  staticClasses,
  Field,
  Focusable
} from "@decky/ui";
import {
  callable,
  definePlugin,
  addEventListener,
  toaster,
  removeEventListener,
  openFilePicker,
  FileSelectionType
} from "@decky/api"


import fileOpener from "./utils/fileOpener";
import { useLocalSendStore } from "./utils/store";
import { useEffect, useState } from "react";
import { FaShareAlt } from "react-icons/fa";

type BackendStatus = {
  running: boolean;
  url: string;
  error?: string;
};

type ScanDevice = {
  alias?: string;
  ip_address?: string;
  deviceModel?: string;
  deviceType?: string;
  fingerprint?: string;
  port?: number;
  protocol?: string;
};

type FileInfo = {
  id: string;
  fileName: string;
  sourcePath: string;
};

type UploadProgress = {
  fileId: string;
  fileName: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
};

const startBackend = callable<[], BackendStatus>("start_backend");
const stopBackend = callable<[], BackendStatus>("stop_backend");
const getBackendStatus = callable<[], BackendStatus>("get_backend_status");
const proxyGet = callable<[string], any>("proxy_get");
const proxyPost = callable<[string, any?, any?], any>("proxy_post");
const prepareFolderUpload = callable<[string], { success: boolean; path?: string; file_name?: string; size?: number; file_type?: string; error?: string }>("prepare_folder_upload");
const getNotifyServerStatus = callable<[], { running: boolean; socket_path: string; socket_exists: boolean }>("get_notify_server_status");
const getUploadSessions = callable<[], any[]>("get_upload_sessions");
const clearUploadSessions = callable<[], { success: boolean }>("clear_upload_sessions");

function Content() {
  // Use zustand store for persistent state across component switches
  const devices = useLocalSendStore((state) => state.devices);
  const setDevices = useLocalSendStore((state) => state.setDevices);
  const selectedDevice = useLocalSendStore((state) => state.selectedDevice);
  const setSelectedDevice = useLocalSendStore((state) => state.setSelectedDevice);
  const selectedFiles = useLocalSendStore((state) => state.selectedFiles);
  const addFile = useLocalSendStore((state) => state.addFile);
  const clearFiles = useLocalSendStore((state) => state.clearFiles);
  
  // Local component state (not persisted)
  const [backend, setBackend] = useState<BackendStatus>({
    running: false,
    url: "https://127.0.0.1:53317",
  });
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);

  useEffect(() => {
    getBackendStatus().then(setBackend).catch((error) => {
      toaster.toast({
        title: "Failed to get backend status",
        body: `${error}`,
      });
    });
  }, []);

  const handleStart = async () => {
    const status = await startBackend();
    setBackend(status);
    if (!status.running) {
      toaster.toast({
        title: "Failed to start",
        body: status.error ?? "Unknown error",
      });
    }
  };

  const handleStop = async () => {
    const status = await stopBackend();
    setBackend(status);
  };

  const handleScan = async () => {
    if (!backend.running) {
      toaster.toast({
        title: "Backend not running",
        body: "Please start the LocalSend backend first",
      });
      return;
    }
    setLoading(true);
    try {
      const result = await proxyGet("/api/self/v1/scan-current");
      if (result.status !== 200) {
        throw new Error(`Scan failed: ${result.status}`);
      }
      setDevices(result.data?.data ?? []);
    } catch (error) {
      toaster.toast({
        title: "Scan failed",
        body: `${error}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const addFileFromPath = (realpath: string, displayPath?: string) => {
    const fileName = (displayPath ?? realpath).split("/").pop() || "unknown";
    const newFile: FileInfo = {
      id: `file-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      fileName,
      sourcePath: realpath,
    };
    // Use store's addFile method which handles duplicate checking
    addFile(newFile);
  };

  const handleFileSelect = async () => {
    if (uploading) return;
    try {
      const result = await openFilePicker(
        FileSelectionType.FILE,
        "/home/deck"
      );

      addFileFromPath(result.realpath ?? result.path, result.path);

      toaster.toast({
        title: "File selected",
        body: result.path,
      });
    } catch (error) {
      toaster.toast({
        title: "Failed to select file",
        body: String(error),
      });
    }
  };

  const handleFolderSelect = async () => {
    if (uploading) return;
    try {
      const result = await fileOpener(
        "/home/deck",
        false,
        undefined,
        undefined,
        true
      );

      const zipResult = await prepareFolderUpload(result.path);
      if (!zipResult.success || !zipResult.path) {
        throw new Error(zipResult.error || "Failed to prepare folder");
      }
      addFileFromPath(zipResult.path, zipResult.file_name ?? result.path);

      toaster.toast({
        title: "Folder selected",
        body: result.path,
      });
    } catch (error) {
      toaster.toast({
        title: "Failed to select folder",
        body: String(error),
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedDevice) {
      toaster.toast({
        title: "No device selected",
        body: "Please select a target device first",
      });
      return;
    }

    if (selectedFiles.length === 0) {
      toaster.toast({
        title: "No files selected",
        body: "Please select files to upload",
      });
      return;
    }

    setUploading(true);
    let progress: UploadProgress[] = selectedFiles.map((f) => ({
      fileId: f.id,
      fileName: f.fileName,
      status: 'pending',
    }));
    setUploadProgress(progress);

    try {
      const filesMap: Record<string, { id: string; fileUrl: string }> = {};
      selectedFiles.forEach((f) => {
        filesMap[f.id] = {
          id: f.id,
          fileUrl: `file://${f.sourcePath}`,
        };
      });

      const prepareResult = await proxyPost(
        "/api/self/v1/prepare-upload",
        {
          targetTo: selectedDevice.fingerprint,
          files: filesMap,
        }
      );

      if (prepareResult.status !== 200) {
        throw new Error(prepareResult.data?.error || `Prepare upload failed: ${prepareResult.status}`);
      }

      const { sessionId, files: tokens } = prepareResult.data.data;

      progress = progress.map((p) => ({ ...p, status: 'uploading' }));
      setUploadProgress(progress);

      const batchFiles = selectedFiles.map((fileInfo) => ({
        fileId: fileInfo.id,
        token: tokens[fileInfo.id] || "",
        fileUrl: `file://${fileInfo.sourcePath}`,
      }));

      const batchUploadResult = await proxyPost(
        "/api/self/v1/upload-batch",
        {
          sessionId: sessionId,
          files: batchFiles,
        }
      );

      if (batchUploadResult.status === 200) {
        const result = batchUploadResult.data?.result;
        if (result?.results) {
          progress = progress.map((p) => {
            const uploadResult = result.results.find((r: any) => r.fileId === p.fileId);
            if (uploadResult?.success) {
              return { ...p, status: 'done' };
            } else {
              return { ...p, status: 'error', error: uploadResult?.error || 'Upload failed' };
            }
          });
        } else {
          progress = progress.map((p) => ({ ...p, status: 'done' }));
        }
        setUploadProgress(progress);
        
        toaster.toast({
          title: "Upload complete",
          body: `Successfully uploaded ${selectedFiles.length} file(s)`,
        });
        // Clear files after successful upload
        clearFiles();
      } else if (batchUploadResult.status === 207) {
        const result = batchUploadResult.data?.result;
        if (result?.results) {
          progress = progress.map((p) => {
            const uploadResult = result.results.find((r: any) => r.fileId === p.fileId);
            if (uploadResult?.success) {
              return { ...p, status: 'done' };
            } else {
              return { ...p, status: 'error', error: uploadResult?.error || 'Upload failed' };
            }
          });
        }
        setUploadProgress(progress);

        const successCount = result?.success || 0;
        const failedCount = result?.failed || 0;
        toaster.toast({
          title: "Partial upload complete",
          body: `Success: ${successCount}, Failed: ${failedCount}`,
        });
      } else {
        throw new Error(batchUploadResult.data?.error || `Batch upload failed: ${batchUploadResult.status}`);
      }
    } catch (error) {
      toaster.toast({
        title: "Upload failed",
        body: String(error),
      });
      setUploadProgress((prev) =>
        prev.map((p) => ({ ...p, status: 'error', error: String(error) }))
      );
    } finally {
      setUploading(false);
    }
  };

  const handleClearFiles = () => {
    // Use store's clearFiles method
    clearFiles();
    setUploadProgress([]);
  };

  const handleCheckNotifyStatus = async () => {
    try {
      const status = await getNotifyServerStatus();
      toaster.toast({
        title: "Notification Server Status",
        body: `Running: ${status.running}, Socket exists: ${status.socket_exists}`,
      });
    } catch (error) {
      toaster.toast({
        title: "Failed to get status",
        body: String(error),
      });
    }
  };

  const handleViewUploadHistory = async () => {
    try {
      const sessions = await getUploadSessions();
      if (sessions.length === 0) {
        toaster.toast({
          title: "Upload History",
          body: "No upload records",
        });
      } else {
        toaster.toast({
          title: "Upload History",
          body: `Total: ${sessions.length} files`,
        });
      }
    } catch (error) {
      toaster.toast({
        title: "Failed to get history",
        body: String(error),
      });
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearUploadSessions();
      toaster.toast({
        title: "History Cleared",
        body: "Upload history has been cleared",
      });
    } catch (error) {
      toaster.toast({
        title: "Failed to clear history",
        body: String(error),
      });
    }
  };

  return (
    <>
      <PanelSection title="LocalSend Backend">
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleStart}>
            {backend.running ? "Backend Running" : "Start Backend"}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleStop}>
            Stop Backend
          </ButtonItem>
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
                  <div key={file.id} style={{ padding: '4px 0', fontSize: '12px' }}>
                    {file.fileName}
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

function DevicesPanel({ 
  devices, 
  selectedDevice, 
  onSelectDevice 
}: { 
  devices: ScanDevice[]; 
  selectedDevice: ScanDevice | null;
  onSelectDevice: (device: ScanDevice) => void;
}) {
  return (
    <PanelSection title="Available Devices">
      {devices.length === 0 ? (
        <PanelSectionRow>
          <div>No devices</div>
        </PanelSectionRow>
      ) : (
        devices.map((device, index) => (
          <PanelSectionRow key={`${device.fingerprint ?? device.alias ?? "device"}-${index}`}>
            <ButtonItem 
              layout="below" 
              onClick={() => onSelectDevice(device)}
            >
              <div>
                <div style={{ fontWeight: 'bold' }}>
                  {device.alias ?? "Unknown Device"}
                  {selectedDevice?.fingerprint === device.fingerprint ? " (Selected)" : ""}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.7 }}>
                  {device.ip_address as string} - {device.deviceModel ?? "unknown"}
                </div>
              </div>
            </ButtonItem>
          </PanelSectionRow>
        ))
      )}
    </PanelSection>
  );
};

export default definePlugin(() => {
  const EmitEventListener = addEventListener("unix_socket_notification", (event: { title: string; message: string }) => {
    toaster.toast({
      title: event.title,
      body: event.message,
    });
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
    },
  };
});
