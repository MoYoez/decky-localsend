import { toaster } from "@decky/api";
import { t } from "../i18n";
import { proxyPost } from "../utils/proxyReq";
import { requestPin } from "../utils/requestPin";
import { useLocalSendStore } from "../utils/store";
import type { FileInfo } from "../types/file";
import type { UploadProgress } from "../types/upload";
import type { ScanDevice } from "../types/devices";

const SEND_FINISHED_SAFETY_TIMEOUT_MS = 15000;

export const createUploadHandlers = (
  selectedDevice: ScanDevice | null,
  selectedFiles: FileInfo[],
  setUploading: (uploading: boolean) => void,
  setUploadProgress: React.Dispatch<React.SetStateAction<UploadProgress[]>>,
  clearFiles: () => void,
  setSendProgressStats?: (total: number | null, completed: number | null) => void,
  setCurrentUploadSessionId?: (id: string | null) => void
) => {
  // handleUpload now accepts an optional override device for quick send scenarios
  const handleUpload = async (overrideDevice?: ScanDevice) => {
    const targetDevice = overrideDevice || selectedDevice;
    if (!targetDevice) {
      toaster.toast({
        title: t("upload.noDeviceSelectedTitle"),
        body: t("upload.noDeviceSelectedMessage"),
      });
      return;
    }

    if (selectedFiles.length === 0) {
      toaster.toast({
        title: t("upload.noFilesSelectedTitle"),
        body: t("upload.noFilesSelectedMessage"),
      });
      return;
    }

      setUploading(true);
    
    // Result of upload-batch (used for error handling when not 200/207)
    let batchUploadResult: { status: number; data?: { result?: { total?: number; success?: number; failed?: number; results?: Array<{ fileId: string; success: boolean; error?: string }> }; error?: string } } | undefined;
    let batchWaitForSendFinished = false;
    let batchSessionIdForSafety: string | undefined;

    // Build progress display (folders show as single items)
    let progress: UploadProgress[] = selectedFiles.map((f) => ({
      fileId: f.id,
      fileName: f.isFolder ? `📁 ${f.fileName} (${f.fileCount} ${t("upload.folderFiles")})` : f.fileName,
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
      
      // Add regular files with fileUrl
      regularFiles.forEach((f) => {
        filesMap[f.id] = {
          id: f.id,
          fileUrl: `file://${f.sourcePath}`,
        };
      });

      // Add text files with size and type info
      textFiles.forEach((f) => {
        const textBytes = new TextEncoder().encode(f.textContent || "");
        filesMap[f.id] = {
          id: f.id,
          fileName: f.fileName ?? t("text.defaultFileName"),
          size: textBytes.length,
          fileType: "text/plain",
        };
      });

      // Determine if we're using folder upload mode
      const hasFolders = folderItems.length > 0;
      const folderPaths = hasFolders ? folderItems.map((f) => f.folderPath!).filter(Boolean) : [];
      const hasExtraFiles = Object.keys(filesMap).length > 0;

      const prepareUpload = (pin?: string) => {
        const pinParam = pin ? `?pin=${encodeURIComponent(pin)}` : "";
        
        if (hasFolders && folderPaths.length > 0) {
          // Mixed mode: folder(s) + extra files
          return proxyPost(
            `/api/self/v1/prepare-upload${pinParam}`,
            {
              targetTo: targetDevice.fingerprint,
              useFolderUpload: true,
              folderPaths: folderPaths,
              ...(hasExtraFiles && { files: filesMap }),
            }
          );
        }
        
        // Standard mode: only individual files
        return proxyPost(
          `/api/self/v1/prepare-upload${pinParam}`,
          {
            targetTo: targetDevice.fingerprint,
            files: filesMap,
          }
        );
      };

      let prepareResult = await prepareUpload();
      if (prepareResult.status === 401) {
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
      setSendProgressStats?.(Object.keys(tokens).length, 0);
      setCurrentUploadSessionId?.(sessionId);

      progress = progress.map((p) => ({ ...p, status: 'uploading' }));
      setUploadProgress(progress);

      // Upload text files individually (text content needs special handling)
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
        if (hasFolders && folderPaths.length > 0) {
          // Build extra files array for mixed upload
          const extraFiles = regularFiles.map((fileInfo) => ({
            fileId: fileInfo.id,
            token: tokens[fileInfo.id] || "",
            fileUrl: `file://${fileInfo.sourcePath}`,
          }));

          batchUploadResult = await proxyPost(
            "/api/self/v1/upload-batch",
            {
              sessionId: sessionId,
              useFolderUpload: true,
              folderPaths: folderPaths,
              ...(extraFiles.length > 0 && { files: extraFiles }),
            }
          );
        } else {
          // Standard batch upload with individual files only
          const batchFiles = regularFiles.map((fileInfo) => ({
            fileId: fileInfo.id,
            token: tokens[fileInfo.id] || "",
            fileUrl: `file://${fileInfo.sourcePath}`,
          }));

          batchUploadResult = await proxyPost(
            "/api/self/v1/upload-batch",
            {
              sessionId: sessionId,
              files: batchFiles,
            }
          );
        }

        if (!batchUploadResult) throw new Error("batch result missing");
        if (batchUploadResult.status === 200 || batchUploadResult.status === 207) {
          // Success: let send_finished event handle cleanup and toast
          batchWaitForSendFinished = true;
          batchSessionIdForSafety = sessionId;
        } else {
          // Error: clear state and show toast
          const result = batchUploadResult.data?.result;
          const success = result?.success ?? 0;
          const failed = result?.failed ?? 0;
          setUploadProgress([]);
          setSendProgressStats?.(null, null);
          setCurrentUploadSessionId?.(null);
          if (failed > 0) {
            toaster.toast({
              title: t("upload.partialCompletedTitle"),
              body: t("upload.partialCompletedBody")
                .replace("{success}", String(success))
                .replace("{failed}", String(failed)),
            });
          } else {
            toaster.toast({
              title: t("upload.failedTitle"),
              body: batchUploadResult.data?.error || t("upload.failedTitle"),
            });
          }
        }
      }

      if (!hasFilesToUpload || !batchWaitForSendFinished) {
        // Text-only or no batch: use UI progress for completion toast
        const allDone = progress.every((p) => p.status === 'done');
        const hasErrors = progress.some((p) => p.status === 'error');

        if (allDone) {
          const doneCount = progress.filter((p) => p.status === 'done').length;
          toaster.toast({
            title: t("upload.uploadCompletedTitle"),
            body: t("upload.uploadCompletedBody")
              .replace("{count}", String(doneCount))
              .replace("{files}", t("common.files")),
          });
          setSendProgressStats?.(null, null);
          setCurrentUploadSessionId?.(null);
          setUploadProgress([]);
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
          setSendProgressStats?.(null, null);
          setCurrentUploadSessionId?.(null);
          setUploadProgress([]);
        }
      }
    } catch (error) {
      toaster.toast({
        title: t("upload.failedTitle"),
        body: String(error),
      });
      setSendProgressStats?.(null, null);
      setCurrentUploadSessionId?.(null);
      setUploadProgress([]);
    } finally {
      setUploading(false);
      if (batchWaitForSendFinished && batchSessionIdForSafety) {
        setTimeout(() => {
          const state = useLocalSendStore.getState();
          if (state.currentUploadSessionId === batchSessionIdForSafety) {
            state.setUploadProgress([]);
            state.setSendProgressStats(null, null);
            state.setCurrentUploadSessionId(null);
            toaster.toast({ title: t("sendProgress.sendCompleteToast"), body: "" });
          }
        }, SEND_FINISHED_SAFETY_TIMEOUT_MS);
      }
    }
  };

  const handleClearFiles = () => {
    setSendProgressStats?.(null, null);
    clearFiles();
    setUploadProgress([]);
  };

  return { handleUpload, handleClearFiles };
};
