import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  staticClasses,
  Field,
  Focusable,
  ToggleField,
  showModal,
  Router,
} from "@decky/ui";
import {
  definePlugin,
  addEventListener,
  toaster,
  removeEventListener,
  routerHook,
} from "@decky/api"

import { useLocalSendStore, type ReceiveProgressState } from "./utils/store";
import { useEffect, useRef, useState } from "react";
import { FaTimes } from "react-icons/fa";

import DevicesPanel from "./components/device";
import { TextReceivedModal } from "./components/TextReceivedModal";
import { ConfirmReceiveModal } from "./components/ConfirmReceiveModal";
import { ConfirmDownloadModal } from "./components/ConfirmDownloadModal";
import { FileReceivedModal } from "./components/FileReceivedModal";
import { ReceiveProgressPanel } from "./components/ReceiveProgressPanel";
import { SendProgressPanel } from "./components/SendProgressPanel";
import { BasicInputBoxModal } from "./components/basicInputBoxModal";
import { ReceiveHistoryPanel } from "./components/ReceiveHistoryPanel";
import { ScreenshotGalleryModal } from "./components/ScreenshotGalleryModal";

import type { BackendStatus } from "./types/backend";
import type { UploadProgress } from "./types/upload";
import type { NetworkInfo } from "./types/devices";

import { getBackendConfig, getBackendStatus, createFavoritesHandlers } from "./functions";
import { ConfirmModal } from "./components/ConfirmModal";
import { ConfigPage, SharedViaLinkPage } from "./pages";
import { t } from "./i18n";

import { createBackendHandlers } from "./functions/backendHandlers";
import { createDeviceHandlers } from "./functions/deviceHandlers";
import { createFileHandlers } from "./functions/fileHandlers";
import { createUploadHandlers } from "./functions/uploadHandlers";
import { confirmDownload } from "./functions/shareHandlers";
import { proxyGet, proxyPost } from "./utils/proxyReq";
import { requestPin } from "./utils/requestPin";
import { LuSendToBack } from "react-icons/lu";

let selfCancelledSessionId: string | null = null;

function Content() {

  const devices = useLocalSendStore((state) => state.devices);
  const setDevices = useLocalSendStore((state) => state.setDevices);
  const selectedDevice = useLocalSendStore((state) => state.selectedDevice);
  const setSelectedDevice = useLocalSendStore((state) => state.setSelectedDevice);
  const selectedFiles = useLocalSendStore((state) => state.selectedFiles);
  const addFile = useLocalSendStore((state) => state.addFile);
  const removeFile = useLocalSendStore((state) => state.removeFile);
  const clearFiles = useLocalSendStore((state) => state.clearFiles);
  
  // Default config
  const [backend, setBackend] = useState<BackendStatus>({
    running: false,
    url: "https://127.0.0.1:53317",
  });
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const uploadProgress = useLocalSendStore((state) => state.uploadProgress);
  const setUploadProgress = useLocalSendStore((state) => state.setUploadProgress);
  const setSendProgressStats = useLocalSendStore((state) => state.setSendProgressStats);
  const [uploading, setUploading] = useState(false);
  const [saveReceiveHistory, setSaveReceiveHistory] = useState(true);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo[]>([]);
  const [useDownload, setUseDownload] = useState(false);
  const [deviceAlias, setDeviceAlias] = useState("");
  const [devicePort, setDevicePort] = useState<number>(53317);
  const favorites = useLocalSendStore((state) => state.favorites);
  const setFavorites = useLocalSendStore((state) => state.setFavorites);
  const receiveProgress = useLocalSendStore((state) => state.receiveProgress);

  // Fetch network info when backend is running
  const fetchNetworkInfo = async () => {
    if (!backend.running) {
      setNetworkInfo([]);
      return;
    }
    try {
      const result = await proxyGet("/api/self/v1/get-network-info");
      if (result.status === 200 && result.data?.data) {
        setNetworkInfo(result.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch network info:", error);
    }
  };

  

  // Fetch device alias from backend info endpoint (GET /api/localsend/v2/info)
  const fetchDeviceInfo = async () => {
    if (!backend.running) {
      setDeviceAlias("");
      return;
    }
    try {
      const result = await proxyGet("/api/localsend/v2/info");
      if (result.status === 200 && result.data) {
        const alias = (result.data as { alias?: string }).alias;
        setDeviceAlias(alias ?? "");
      }
    } catch (error) {
      console.error("Failed to fetch device info:", error);
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
        setSaveReceiveHistory(result.save_receive_history !== false);
        setUseDownload(!!result.use_download);
        setDevicePort(result.multicast_port || 53317);
      })
      .catch((error) => {
        toaster.toast({
          title: t("toast.failedLoadConfig"),
          body: `${error}`,
        });
      });
  }, []);

  // Fetch network info and device alias when backend status changes
  useEffect(() => {
    fetchNetworkInfo();
    fetchDeviceInfo();
  }, [backend.running]);

  // Reload config: re-fetch backend config + device info (alias from info) + network info
  const handleReloadConfig = async () => {
    try {
      const result = await getBackendConfig();
      setSaveReceiveHistory(result.save_receive_history !== false);
      setUseDownload(!!result.use_download);
      setDevicePort(result.multicast_port || 53317);
      await fetchDeviceInfo();
      await fetchNetworkInfo();
      toaster.toast({
        title: t("config.configReloaded"),
        body: t("config.reloadConfigDesc"),
      });
    } catch (error) {
      toaster.toast({
        title: t("common.error"),
        body: `${error}`,
      });
    }
  };

  const { handleToggleBackend } = createBackendHandlers(setBackend);
  
  const { handleRefreshDevices, handleScanNow } = createDeviceHandlers(backend, setDevices, setRefreshLoading, setScanLoading, selectedDevice, setSelectedDevice);
  
  const { handleFileSelect, handleFolderSelect } = createFileHandlers(addFile, uploading);
  
  const { handleUpload, handleClearFiles } = createUploadHandlers(
    selectedDevice,
    selectedFiles,
    setUploading,
    setUploadProgress,
    clearFiles,
    setSendProgressStats
  );

  const { fetchFavorites, handleAddToFavorites, handleRemoveFromFavorites } = createFavoritesHandlers(
    backend.running,
    setFavorites
  );

  // Only clear device list, favorites, and share link session when backend *transitions* from running to stopped.
  // Avoid clearing on initial mount (backend.running starts false) or when Content remounts (e.g. after closing favorite modal).
  const prevBackendRunningRef = useRef<boolean | null>(null);
  useEffect(() => {
    const wasRunning = prevBackendRunningRef.current;
    prevBackendRunningRef.current = backend.running;
    if (wasRunning === true && !backend.running) {
      setDevices([]);
      setSelectedDevice(null);
      setFavorites([]);
      // Clear all share link sessions when backend stops
      clearShareLinkSessions();
    }
  }, [backend.running]);

  // Fetch favorites when backend status changes
  useEffect(() => {
    fetchFavorites();
  }, [backend.running]);

  // Get online favorite devices (match by fingerprint with scanned devices)
  const getOnlineFavorites = () => {
    return favorites.map((fav) => {
      const onlineDevice = devices.find((d) => d.fingerprint === fav.favorite_fingerprint);
      return {
        ...fav,
        online: !!onlineDevice,
        device: onlineDevice,
      };
    });
  };

  // Handle quick send to a favorite device
  const handleQuickSendToFavorite = async (favoriteFingerprint: string) => {
    const onlineFav = getOnlineFavorites().find(
      (f) => f.favorite_fingerprint === favoriteFingerprint && f.online && f.device
    );
    if (!onlineFav || !onlineFav.device) {
      toaster.toast({
        title: t("common.error"),
        body: t("upload.deviceOffline"),
      });
      return;
    }
    // Set selected device for UI display and directly pass device to upload
    setSelectedDevice(onlineFav.device);
    // Pass the device directly to handleUpload to avoid closure issues
    handleUpload(onlineFav.device);
  };

  const openInputModal = (
    title: string,
    label: string,
  ) =>
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

  // Handle manual send (FastSender mode)
  const handleManualSend = async () => {
    if (selectedFiles.length === 0) {
      toaster.toast({
        title: t("common.error"),
        body: t("upload.selectedFiles") + ": 0",
      });
      return;
    }

    const input = await openInputModal(t("upload.manualSend"), t("modal.enterIpOrSuffix"));
    if (!input) {
      return;
    }

    const trimmedInput = input.trim();
    // Check if it's a full IP address
    const isFullIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmedInput);

    setUploading(true);

    // Build progress display
    let progress: UploadProgress[] = selectedFiles.map((f) => ({
      fileId: f.id,
      fileName: f.isFolder ? `📁 ${f.fileName} (${f.fileCount} files)` : f.fileName,
      status: 'pending',
    }));
    setUploadProgress(progress);

    try {
      // Separate items by type
      const textFiles = selectedFiles.filter((f) => f.textContent);
      const folderItems = selectedFiles.filter((f) => f.isFolder && f.folderPath);
      const regularFiles = selectedFiles.filter((f) => !f.textContent && !f.isFolder);

      // Build files map for non-folder files
      const filesMap: Record<string, { id: string; fileUrl?: string; fileName?: string; size?: number; fileType?: string }> = {};
      
      regularFiles.forEach((f) => {
        filesMap[f.id] = {
          id: f.id,
          fileUrl: `file://${f.sourcePath}`,
        };
      });

      textFiles.forEach((f) => {
        const textBytes = new TextEncoder().encode(f.textContent || "");
        filesMap[f.id] = {
          id: f.id,
          fileName: f.fileName,
          size: textBytes.length,
          fileType: "text/plain",
        };
      });

      const hasFolders = folderItems.length > 0;
      const folderPaths = hasFolders ? folderItems.map((f) => f.folderPath!).filter(Boolean) : [];
      const hasExtraFiles = Object.keys(filesMap).length > 0;

      // Build FastSender request
      const fastSenderParams: Record<string, any> = {
        useFastSender: true,
      };
      if (isFullIp) {
        fastSenderParams.useFastSenderIp = trimmedInput;
      } else {
        fastSenderParams.useFastSenderIPSuffex = trimmedInput;
      }

      const prepareUpload = (pin?: string) => {
        const pinParam = pin ? `?pin=${encodeURIComponent(pin)}` : "";
        if (hasFolders && folderPaths.length > 0) {
          return proxyPost(`/api/self/v1/prepare-upload${pinParam}`, {
            ...fastSenderParams,
            useFolderUpload: true,
            folderPaths: folderPaths,
            ...(hasExtraFiles && { files: filesMap }),
          });
        }
        return proxyPost(`/api/self/v1/prepare-upload${pinParam}`, {
          ...fastSenderParams,
          files: filesMap,
        });
      };

      let prepareResult = await prepareUpload();
      if (prepareResult.status === 401) {
        toaster.toast({
          title: t("toast.pinRequired"),
          body: t("toast.pinRequiredForFiles"),
        });
        const pin = await requestPin(t("toast.pinRequired"));
        if (!pin) {
          throw new Error(t("upload.pinRequiredToContinue"));
        }
        prepareResult = await prepareUpload(pin);
      }

      if (prepareResult.status !== 200) {
        throw new Error(prepareResult.data?.error || `Prepare upload failed: ${prepareResult.status}`);
      }

      const { sessionId, files: tokens } = prepareResult.data.data;
      setSendProgressStats(Object.keys(tokens).length, 0);

      progress = progress.map((p) => ({ ...p, status: 'uploading' }));
      setUploadProgress(progress);

      // Upload text files individually
      for (const textFile of textFiles) {
        try {
          const textBytes = new TextEncoder().encode(textFile.textContent || "");
          const uploadResult = await proxyPost(
            `/api/self/v1/upload?sessionId=${sessionId}&fileId=${textFile.id}&token=${tokens[textFile.id]}`,
            undefined,
            Array.from(textBytes)
          );

          if (uploadResult.status === 200) {
            progress = progress.map((p) => 
              p.fileId === textFile.id ? { ...p, status: 'done' } : p
            );
          } else {
            progress = progress.map((p) => 
              p.fileId === textFile.id 
                ? { ...p, status: 'error', error: uploadResult.data?.error || t("upload.failedTitle") }
                : p
            );
          }
        } catch (error) {
          progress = progress.map((p) => 
            p.fileId === textFile.id 
              ? { ...p, status: 'error', error: String(error) }
              : p
          );
        }
        setUploadProgress([...progress]);
      }

      // Upload folders and regular files
      const hasFilesToUpload = hasFolders || regularFiles.length > 0;
      
      if (hasFilesToUpload) {
        let batchUploadResult;
        
        if (hasFolders && folderPaths.length > 0) {
          const extraFiles = regularFiles.map((fileInfo) => ({
            fileId: fileInfo.id,
            token: tokens[fileInfo.id] || "",
            fileUrl: `file://${fileInfo.sourcePath}`,
          }));

          batchUploadResult = await proxyPost("/api/self/v1/upload-batch", {
            sessionId: sessionId,
            useFolderUpload: true,
            folderPaths: folderPaths,
            ...(extraFiles.length > 0 && { files: extraFiles }),
          });
        } else {
          const batchFiles = regularFiles.map((fileInfo) => ({
            fileId: fileInfo.id,
            token: tokens[fileInfo.id] || "",
            fileUrl: `file://${fileInfo.sourcePath}`,
          }));

          batchUploadResult = await proxyPost("/api/self/v1/upload-batch", {
            sessionId: sessionId,
            files: batchFiles,
          });
        }

        if (batchUploadResult.status === 200 || batchUploadResult.status === 207) {
          const result = batchUploadResult.data?.result;
          if (result?.results) {
            if (hasFolders) {
              progress = progress.map((p) => {
                if (folderItems.some((f) => f.id === p.fileId)) {
                  return { ...p, status: 'done' };
                }
                return p;
              });
            }
            progress = progress.map((p) => {
              const uploadResult = result.results.find((r: any) => r.fileId === p.fileId);
              if (uploadResult?.success) {
                return { ...p, status: 'done' };
              } else if (uploadResult && !uploadResult.success) {
                return { ...p, status: 'error', error: uploadResult?.error || t("upload.failedTitle") };
              }
              return p;
            });
          } else {
            progress = progress.map((p) => {
              if (folderItems.some((f) => f.id === p.fileId) || regularFiles.some((f) => f.id === p.fileId)) {
                return { ...p, status: 'done' };
              }
              return p;
            });
          }
        } else {
          progress = progress.map((p) => {
            if (folderItems.some((f) => f.id === p.fileId) || regularFiles.some((f) => f.id === p.fileId)) {
              return { ...p, status: 'error', error: batchUploadResult.data?.error || t("upload.failedTitle") };
            }
            return p;
          });
        }
      }

      setUploadProgress(progress);

      const allDone = progress.every((p) => p.status === 'done');
      const hasErrors = progress.some((p) => p.status === 'error');

      if (allDone) {
        toaster.toast({
          title: t("common.success"),
          body: `${selectedFiles.length} ${t("common.files")}`,
        });
        setSendProgressStats(null, null);
        clearFiles();
      } else if (hasErrors) {
        const successCount = progress.filter((p) => p.status === 'done').length;
        const failedCount = progress.filter((p) => p.status === 'error').length;
        toaster.toast({
          title: t("upload.partialCompletedTitle"),
          body: t("upload.partialCompletedBody")
            .replace("{success}", String(successCount))
            .replace("{failed}", String(failedCount)),
        });
      }
    } catch (error) {
      toaster.toast({
        title: t("upload.failedTitle"),
        body: String(error),
      });
      setSendProgressStats(null, null);
      setUploadProgress((prev) =>
        prev.map((p) => ({ ...p, status: 'error', error: String(error) }))
      );
    } finally {
      setUploading(false);
    }
  };

  const clearShareLinkSessions = useLocalSendStore((state) => state.clearShareLinkSessions);
  const setPendingShare = useLocalSendStore((state) => state.setPendingShare);

  // Handle create share link (Download API) -> navigate to Shared via Link page for settings
  const handleCreateShareLink = () => {
    if (!backend.running) {
      toaster.toast({
        title: t("common.error"),
        body: t("shareLink.backendRequired"),
      });
      return;
    }
    const shareableFiles = selectedFiles.filter(
      (f) =>
        f.textContent ||
        (!f.isFolder && f.sourcePath) ||
        (f.isFolder && f.folderPath)
    );
    if (shareableFiles.length === 0) {
      toaster.toast({
        title: t("common.error"),
        body: t("shareLink.selectFiles"),
      });
      return;
    }
    // Set pending share and navigate to settings page (no session created yet)
    setPendingShare({ files: shareableFiles });
    Router.CloseSideMenus();
    Router.Navigate("/decky-localsend-share-link");
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

  return (
    <>
      {receiveProgress && (
        <ReceiveProgressPanel
          receiveProgress={receiveProgress}
          onCancelReceive={async (sessionId) => {
            selfCancelledSessionId = sessionId;
            try {
              await proxyPost(`/api/localsend/v2/cancel?sessionId=${encodeURIComponent(sessionId)}`);
            } finally {
              useLocalSendStore.getState().setReceiveProgress(null);
              toaster.toast({ title: t("notify.receiveCancelled"), body: "" });
            }
          }}
        />
      )}
      {uploadProgress.length > 0 && (
        <SendProgressPanel uploadProgress={uploadProgress} />
      )}
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
          <ButtonItem layout="below" onClick={handleRefreshDevices} disabled={refreshLoading}>
            {refreshLoading ? t("backend.scanning") : t("backend.refreshDevices")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleScanNow} disabled={scanLoading}>
            {scanLoading ? t("backend.scanning") : t("backend.scanNow")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleReloadConfig}>
            {t("config.reloadConfig")}
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
      <PanelSection title={t("networkInfo.title")}>
        <PanelSectionRow>
          <Field label={t("networkInfo.deviceName")}>
            {deviceAlias || "-"}
          </Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <Field label={t("networkInfo.port")}>
            {devicePort}
          </Field>
        </PanelSectionRow>
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
      </PanelSection>
      <DevicesPanel 
        devices={devices} 
        selectedDevice={selectedDevice}
        onSelectDevice={setSelectedDevice}
        favorites={favorites}
        onAddToFavorites={handleAddToFavorites}
        onRemoveFromFavorites={handleRemoveFromFavorites}
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
        <PanelSectionRow>
          <ButtonItem 
            layout="below" 
            onClick={handleOpenScreenshotGallery} 
            disabled={uploading || !backend.running}
          >
            {t("screenshot.openGallery")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => handleUpload()}
            disabled={uploading || !selectedDevice || selectedFiles.length === 0}
          >
            {uploading ? t("upload.uploading") : t("upload.confirmSend")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={handleManualSend}
            disabled={uploading || selectedFiles.length === 0}
          >
            {t("upload.manualSend")}
          </ButtonItem>
        </PanelSectionRow>
        {useDownload && (
          <PanelSectionRow>
            <ButtonItem
              layout="below"
              onClick={handleCreateShareLink}
              disabled={uploading || selectedFiles.length === 0 || !backend.running}
            >
              🔗 {t("upload.createShareLink")}
            </ButtonItem>
          </PanelSectionRow>
        )}
        {useDownload && (
          <PanelSectionRow>
            <ButtonItem
              layout="below"
              onClick={() => {
                if (!backend.running) {
                  toaster.toast({
                    title: t("common.error"),
                    body: t("shareLink.backendRequired"),
                  });
                  return;
                }
                Router.CloseSideMenus();
                Router.Navigate("/decky-localsend-share-link");
              }}
              disabled={!backend.running}
            >
              🔗 {t("shareLink.title")}
            </ButtonItem>
          </PanelSectionRow>
        )}
        {/* Quick send to favorites */}
        {selectedFiles.length > 0 && favorites.length > 0 && (
          <>
            <PanelSectionRow>
              <Field label={t("upload.quickSendFavorites")}>{favorites.length}</Field>
            </PanelSectionRow>
            <PanelSectionRow>
              <Focusable style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {getOnlineFavorites().map((fav) => (
                  <ButtonItem
                    key={fav.favorite_fingerprint}
                    layout="below"
                    onClick={() => handleQuickSendToFavorite(fav.favorite_fingerprint)}
                    disabled={uploading || !fav.online}
                  >
                    <span style={{ fontSize: '13px', opacity: fav.online ? 1 : 0.5 }}>
                      {fav.online ? '🟢' : '⚫'} {t("upload.sendTo")} {fav.favorite_alias || fav.favorite_fingerprint.substring(0, 8)}
                      {!fav.online && ` (${t("upload.deviceOffline")})`}
                    </span>
                  </ButtonItem>
                ))}
              </Focusable>
            </PanelSectionRow>
          </>
        )}
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
      </PanelSection>
      <ReceiveHistoryPanel saveReceiveHistory={saveReceiveHistory} />
      <PanelSection title={t("config.title")}>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => {
              Router.CloseSideMenus();
              Router.Navigate("/decky-localsend-config");
            }}
          >
            {t("config.openConfig")}
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </>
  );
};



export default definePlugin(() => {
  // Register config page route (without exact to allow sub-routes)
  routerHook.addRoute("/decky-localsend-config", ConfigPage);
  routerHook.addRoute("/decky-localsend-share-link", SharedViaLinkPage);

  // Helper function to update device in store
  const updateDeviceInStore = (deviceData: any) => {
    const store = useLocalSendStore.getState();
    const currentDevices = store.devices;
    const fingerprint = deviceData.fingerprint;
    
    if (!fingerprint) return;
    
    const newDevice = {
      fingerprint: deviceData.fingerprint,
      alias: deviceData.alias,
      ip_address: deviceData.ip_address,
      port: deviceData.port,
      protocol: deviceData.protocol,
      deviceType: deviceData.deviceType,
      deviceModel: deviceData.deviceModel,
    };
    
    // Check if device already exists
    const existingIndex = currentDevices.findIndex(d => d.fingerprint === fingerprint);
    
    if (existingIndex >= 0) {
      // Update existing device
      const updatedDevices = [...currentDevices];
      updatedDevices[existingIndex] = { ...updatedDevices[existingIndex], ...newDevice };
      store.setDevices(updatedDevices);
      
      // Update selected device if it's the same one
      const selectedDevice = store.selectedDevice;
      if (selectedDevice?.fingerprint === fingerprint) {
        store.setSelectedDevice({ ...selectedDevice, ...newDevice });
      }
    } else {
      // Add new device
      store.setDevices([...currentDevices, newDevice]);
    }
  };

  const EmitEventListener = addEventListener("unix_socket_notification", (event: { type?: string; title?: string; message?: string; data?: any }) => {
    // Handle device discovered/updated events - update device list without toast
    if (event.type === "device_discovered" || event.type === "device_updated") {
      const deviceData = event.data ?? {};
      updateDeviceInStore(deviceData);
      // Don't show toast for device events, just update the list silently
      return;
    }

    if (event.type === "confirm_recv") {
      const data = event.data ?? {};
      const sessionId = String(data.sessionId || "");
      const files = Array.isArray(data.files) ? data.files : [];
      const totalFiles = data.totalFiles != null ? Number(data.totalFiles) : undefined;
      const modalResult = showModal(
        <ConfirmReceiveModal
          from={String(data.from || "")}
          fileCount={Number(data.fileCount || 0)}
          files={files}
          totalFiles={totalFiles}
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

    if (event.type === "confirm_download") {
      const data = event.data ?? {};
      const sessionId = String(data.sessionId || "");
      const clientKey = String(data.clientKey || "");
      const fileCount = Number(data.fileCount || 0);
      const files = Array.isArray(data.files) ? data.files : [];
      const totalFiles = data.totalFiles != null ? Number(data.totalFiles) : undefined;
      const modalResult = showModal(
        <ConfirmDownloadModal
          fileCount={fileCount}
          files={files}
          totalFiles={totalFiles}
          clientIp={data.clientIp != null ? String(data.clientIp) : undefined}
          clientType={data.clientType != null ? String(data.clientType) : undefined}
          userAgent={data.userAgent != null ? String(data.userAgent) : undefined}
          onConfirm={async (confirmed) => {
            if (!sessionId || !clientKey) {
              toaster.toast({
                title: t("toast.confirmFailed"),
                body: t("toast.missingSessionId"),
              });
              return;
            }
            try {
              await confirmDownload(sessionId, clientKey, confirmed);
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

    if (event.type === "upload_cancelled") {
      useLocalSendStore.getState().setReceiveProgress(null);
      const dataSessionId = event.data?.sessionId;
      if (dataSessionId === selfCancelledSessionId) {
        selfCancelledSessionId = null;
        return;
      }
      toaster.toast({
        title: t("notify.uploadCancelled"),
        body: "",
      });
      return;
    }

    if (event.type === "upload_start") {
      const data = event.data ?? {};
      useLocalSendStore.getState().setReceiveProgress({
        sessionId: String(data.sessionId ?? ""),
        totalFiles: Number(data.totalFiles ?? 0),
        completedCount: 0,
        currentFileName: "",
      });
    }

    if (event.type === "upload_progress") {
      const data = event.data ?? {};
      useLocalSendStore.getState().setReceiveProgress((prev: ReceiveProgressState | null) => {
        if (!prev || String(data.sessionId ?? "") !== prev.sessionId) return prev;
        const completed = Number(data.successFiles ?? 0) + Number(data.failedFiles ?? 0);
        return {
          ...prev,
          completedCount: completed,
          currentFileName: String(data.currentFileName ?? ""),
        };
      });
      return;
    }

    if (event.type === "upload_end") {
      const data = event.data ?? {};
      useLocalSendStore.getState().setReceiveProgress((prev) => (prev?.sessionId === data.sessionId ? null : prev));
    }

    if (event.type === "send_progress") {
      const data = event.data ?? {};
      const fileId = String(data.fileId ?? "");
      const success = !!data.success;
      const errorMsg = String(data.error ?? "");
      const totalFiles = data.totalFiles != null ? Number(data.totalFiles) : null;
      const completedCount = data.completedCount != null ? Number(data.completedCount) : null;
      useLocalSendStore.getState().setUploadProgress((prev) =>
        prev.map((p) =>
          p.fileId === fileId
            ? { ...p, status: success ? "done" : "error", error: success ? undefined : errorMsg }
            : p
        )
      );
      if (totalFiles != null && completedCount != null) {
        useLocalSendStore.getState().setSendProgressStats(totalFiles, completedCount);
        // When backend reports all files done, mark any remaining "uploading" entries as done
        // so allDone triggers and "sending" does not get stuck (e.g. folder upload where fileIds don't match).
        if (completedCount === totalFiles && totalFiles > 0) {
          useLocalSendStore.getState().setUploadProgress((prev) =>
            prev.map((p) => (p.status === "uploading" ? { ...p, status: "done" as const } : p))
          );
        }
      }
      return;
    }

    // Skip toast for info type notifications (don't show decky info)
    if (event.type === "info") {
      return;
    }

    // i18n for upload_start / upload_end toast title (including text-only variant)
    const isTextOnly = !!(event as { isTextOnly?: boolean }).isTextOnly;
    let notifyTitleKey: string | null = null;
    if (event.type === "upload_start") {
      notifyTitleKey = isTextOnly ? "notify.textUploadStarted" : "notify.uploadStarted";
    } else if (event.type === "upload_end") {
      notifyTitleKey = isTextOnly ? "notify.textUploadCompleted" : "notify.uploadCompleted";
    }
    const title = notifyTitleKey ? t(notifyTitleKey) : (event.title || t("toast.notification"));
    toaster.toast({
      title,
      body: event.message || "",
    });
  });

  // Listen for text received events from backend
  const TextReceivedListener = addEventListener("text_received", (event: { title: string; content: string; fileName: string; sessionId?: string }) => {
    const sessionId = String(event.sessionId ?? "");
    const modalResult = showModal(
      <TextReceivedModal
        title={event.title}
        content={event.content}
        fileName={event.fileName}
        onClose={() => {}}
        closeModal={() => {
          if (sessionId) {
            proxyGet(`/api/self/v1/text-received-dismiss?sessionId=${encodeURIComponent(sessionId)}`).finally(() => modalResult.Close());
          } else {
            modalResult.Close();
          }
        }}
      />
    );
  });

  // Listen for file received events from backend
  const FileReceivedListener = addEventListener("file_received", (event: { 
    title: string; 
    folderPath: string; 
    fileCount: number; 
    files: string[];
    totalFiles?: number;
    successFiles?: number;
    failedFiles?: number;
    failedFileIds?: string[];
  }) => {
    const modalResult = showModal(
      <FileReceivedModal
        title={event.title}
        folderPath={event.folderPath}
        fileCount={event.fileCount}
        files={event.files}
        totalFiles={event.totalFiles}
        successFiles={event.successFiles}
        failedFiles={event.failedFiles}
        failedFileIds={event.failedFileIds}
        onClose={() => {}}
        closeModal={() => modalResult.Close()}
      />
    );
  });

  return {
    // The name shown in various decky menus
    name: "Decky Localsend",
    // The element displayed at the top of your plugin's menu
    titleView: <div className={staticClasses.Title}>Decky Localsend</div>,
    // The content of your plugin's menu
    content: <Content />,
    // The icon displayed in the plugin list
    icon: <LuSendToBack />,
    // The function triggered when your plugin unloads
    onDismount() {
      console.log("Unloading");
      removeEventListener("unix_socket_notification", EmitEventListener);
      removeEventListener("text_received", TextReceivedListener);
      removeEventListener("file_received", FileReceivedListener);
      routerHook.removeRoute("/decky-localsend-config");
      routerHook.removeRoute("/decky-localsend-share-link");
    },
  };
});
