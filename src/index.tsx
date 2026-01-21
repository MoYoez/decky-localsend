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
  toaster,
  fetchNoCors
} from "@decky/api"


import fileOpener from "./utils/fileOpener";
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
  size: number;
  fileType: string;
  file: File;
  sourcePath?: string;
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
const testNotifyCallback = callable<[], { success: boolean; error?: string }>("test_notify_callback");
const prepareFolderUpload = callable<[string], { success: boolean; path?: string; file_name?: string; size?: number; file_type?: string; error?: string }>("prepare_folder_upload");

function Content() {
  const [backend, setBackend] = useState<BackendStatus>({
    running: false,
    url: "https://127.0.0.1:53317",
  });
  const [devices, setDevices] = useState<ScanDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<ScanDevice | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [uploading, setUploading] = useState(false);
  const [developerTesting, setDeveloperTesting] = useState(false);

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
        throw new Error(`scan failed: ${result.status}`);
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

  const normalizePickerResult = (result: any): { path: string; realpath: string }[] => {
    if (!result) return [];
    if (Array.isArray(result)) return result.filter((item) => item?.realpath);
    if (result.realpath) return [result];
    return [];
  };

  const addFileFromPath = async (realpath: string, displayPath?: string) => {
    const response = await fetchNoCors(`file://${realpath}`);
    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const fileName = (displayPath ?? realpath).split("/").pop() || "unknown";
    const file = new File([buffer], fileName, { type: "application/octet-stream" });

    const newFile: FileInfo = {
      id: `file-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      fileName: file.name,
      size: file.size,
      fileType: file.type,
      file: file,
      sourcePath: realpath,
    };

    setSelectedFiles((prev) => {
      if (prev.some((item) => item.sourcePath === newFile.sourcePath)) {
        return prev;
      }
      return [...prev, newFile];
    });
  };

  const handleFileSelect = async () => {
    if (uploading) return;
    try {
      const result = await fileOpener(
        "/home/deck",
        true
      );

      const selections = normalizePickerResult(result);
      if (selections.length === 0) {
        return;
      }

      for (const selection of selections) {
        await addFileFromPath(selection.realpath, selection.path);
      }

      toaster.toast({
        title: "Files selected",
        body: `${selections.length} item(s)`,
      });
    } catch (error) {
      toaster.toast({
        title: "File selection failed",
        body: String(error),
      });
    }
  };

  const handleFolderSelect = async () => {
    if (uploading) return;
    try {
      const result = await fileOpener(
        "/home/deck/",
        true
      );

      const selections = normalizePickerResult(result);
      if (selections.length === 0) {
        return;
      }

      for (const selection of selections) {
        const zipResult = await prepareFolderUpload(selection.realpath);
        if (!zipResult.success || !zipResult.path) {
          throw new Error(zipResult.error || "Failed to prepare folder");
        }
        await addFileFromPath(zipResult.path, zipResult.file_name ?? selection.path);
      }

      toaster.toast({
        title: "Folders selected",
        body: `${selections.length} item(s)`,
      });
    } catch (error) {
      toaster.toast({
        title: "Folder selection failed",
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
      // Step 1: Prepare upload
      const filesMap: Record<string, any> = {};
      selectedFiles.forEach((f) => {
        filesMap[f.id] = {
          id: f.id,
          fileName: f.fileName,
          size: f.size,
          fileType: f.fileType,
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

      // Step 2: Upload each file
      for (const fileInfo of selectedFiles) {
        const token = tokens[fileInfo.id];
        if (!token) {
          progress = progress.map((p) =>
            p.fileId === fileInfo.id
              ? { ...p, status: 'error', error: 'No token received' }
              : p
          );
          setUploadProgress(progress);
          continue;
        }

        progress = progress.map((p) =>
          p.fileId === fileInfo.id ? { ...p, status: 'uploading' } : p
        );
        setUploadProgress(progress);

        try {
          const fileBuffer = await fileInfo.file.arrayBuffer();
          const uint8Array = Array.from(new Uint8Array(fileBuffer));
          
          const uploadPath = `/api/self/v1/upload?sessionId=${encodeURIComponent(sessionId)}&fileId=${encodeURIComponent(fileInfo.id)}&token=${encodeURIComponent(token)}`;
          const uploadResult = await proxyPost(uploadPath, null, uint8Array);

          if (uploadResult.status !== 200) {
            throw new Error(uploadResult.data?.error || `Upload failed: ${uploadResult.status}`);
          }

          progress = progress.map((p) =>
            p.fileId === fileInfo.id ? { ...p, status: 'done' } : p
          );
          setUploadProgress(progress);
        } catch (error) {
          progress = progress.map((p) =>
            p.fileId === fileInfo.id
              ? { ...p, status: 'error', error: String(error) }
              : p
          );
          setUploadProgress(progress);
        }
      }

      const allSuccess = progress.every((p) => p.status === 'done');
      toaster.toast({
        title: allSuccess ? "Upload complete" : "Upload finished with errors",
        body: `${progress.filter((p) => p.status === 'done').length}/${selectedFiles.length} files uploaded`,
      });

      // Clear selected files after successful upload
      if (allSuccess) {
        setSelectedFiles([]);
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
    setSelectedFiles([]);
    setUploadProgress([]);
  };

  const handleTestCallback = async () => {
    setDeveloperTesting(true);
    try {
      const result = await testNotifyCallback();
      if (!result.success) {
        throw new Error(result.error || "Unknown error");
      }
      toaster.toast({
        title: "Callback test succeeded",
        body: "Sent test notification to Flask",
      });
    } catch (error) {
      toaster.toast({
        title: "Callback test failed",
        body: String(error),
      });
    } finally {
      setDeveloperTesting(false);
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
            Select Files (Multi)
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleFolderSelect} disabled={uploading}>
            Select Folder
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
                    {file.fileName} ({(file.size / 1024).toFixed(1)} KB)
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
      <PanelSection title="Developer Settings">
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleTestCallback} disabled={developerTesting}>
            {developerTesting ? "Testing..." : "Test Callback"}
          </ButtonItem>
        </PanelSectionRow>
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
  console.log("localsend plugin initializing");

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
    },
  };
});
