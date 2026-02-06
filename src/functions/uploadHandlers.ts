import { toaster } from "@decky/api";
import { t } from "../i18n";
import { proxyPost } from "../utils/proxyReq";
import { requestPin } from "../utils/requestPin";
import type { FileInfo } from "../types/file";
import type { UploadProgress } from "../types/upload";
import type { ScanDevice } from "../types/devices";

export const createUploadHandlers = (
  selectedDevice: ScanDevice | null,
  selectedFiles: FileInfo[],
  setUploading: (uploading: boolean) => void,
  setUploadProgress: React.Dispatch<React.SetStateAction<UploadProgress[]>>,
  clearFiles: () => void
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
      }

      // Upload folders and regular files
      const hasFilesToUpload = hasFolders || regularFiles.length > 0;
      
      if (hasFilesToUpload) {
        let batchUploadResult;
        
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

        if (batchUploadResult.status === 200) {
          const result = batchUploadResult.data?.result;
          if (result?.results) {
            // Mark folder items as done if folder upload succeeded
            if (hasFolders) {
              progress = progress.map((p) => {
                if (folderItems.some((f) => f.id === p.fileId)) {
                  return { ...p, status: 'done' };
                }
                return p;
              });
            }
            // Mark regular files based on results
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
            // No detailed results, mark all as done
            progress = progress.map((p) => {
              if (folderItems.some((f) => f.id === p.fileId) || regularFiles.some((f) => f.id === p.fileId)) {
                return { ...p, status: 'done' };
              }
              return p;
            });
          }
        } else if (batchUploadResult.status === 207) {
          // Partial success
          const result = batchUploadResult.data?.result;
          if (result?.results) {
            progress = progress.map((p) => {
              const uploadResult = result.results.find((r: any) => r.fileId === p.fileId);
              if (uploadResult?.success) {
                return { ...p, status: 'done' };
              } else if (uploadResult) {
                return { ...p, status: 'error', error: uploadResult?.error || t("upload.failedTitle") };
              }
              // For folder items without direct result match
              if (folderItems.some((f) => f.id === p.fileId)) {
                // Check overall success rate
                if (result.success > 0) {
                  return { ...p, status: 'done' };
                }
              }
              return p;
            });
          }
        } else {
          // All failed
          progress = progress.map((p) => {
            if (folderItems.some((f) => f.id === p.fileId) || regularFiles.some((f) => f.id === p.fileId)) {
              return { ...p, status: 'error', error: batchUploadResult.data?.error || t("upload.failedTitle") };
            }
            return p;
          });
        }
      }

      setUploadProgress(progress);

      // Check if all files are done
      const allDone = progress.every((p) => p.status === 'done');
      const hasErrors = progress.some((p) => p.status === 'error');

      if (allDone) {
        toaster.toast({
          title: t("upload.uploadCompletedTitle"),
          body: t("upload.uploadCompletedBody")
            .replace("{count}", String(selectedFiles.length))
            .replace("{files}", t("common.files")),
        });
        // Clear files after successful upload
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
      setUploadProgress((prev) =>
        prev.map((p) => ({ ...p, status: 'error', error: String(error) }))
      );
    } finally {
      setUploading(false);
    }
  };

  const handleClearFiles = () => {
    clearFiles();
    setUploadProgress([]);
  };

  return { handleUpload, handleClearFiles };
};
