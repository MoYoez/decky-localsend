import { toaster } from "@decky/api";
import { proxyPost } from "../utils/proxyReq";
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
      // Separate text files and regular files
      const textFiles = selectedFiles.filter((f) => f.textContent);
      const regularFiles = selectedFiles.filter((f) => !f.textContent);

      // Prepare files map for prepare-upload
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
          fileName: f.fileName,
          size: textBytes.length,
          fileType: "text/plain",
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
                ? { ...p, status: 'error', error: uploadResult.data?.error || 'Upload failed' }
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

      // Upload regular files in batch
      if (regularFiles.length > 0) {
        const batchFiles = regularFiles.map((fileInfo) => ({
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
            progress = progress.map((p) => {
              // Only update regular files, text files already updated
              if (regularFiles.some((f) => f.id === p.fileId)) {
                return { ...p, status: 'done' };
              }
              return p;
            });
          }
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
        } else {
          // Mark regular files as error
          progress = progress.map((p) => {
            if (regularFiles.some((f) => f.id === p.fileId)) {
              return { ...p, status: 'error', error: batchUploadResult.data?.error || 'Upload failed' };
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
          title: "Upload complete",
          body: `Successfully uploaded ${selectedFiles.length} file(s)`,
        });
        // Clear files after successful upload
        clearFiles();
      } else if (hasErrors) {
        const successCount = progress.filter((p) => p.status === 'done').length;
        const failedCount = progress.filter((p) => p.status === 'error').length;
        toaster.toast({
          title: "Partial upload complete",
          body: `Success: ${successCount}, Failed: ${failedCount}`,
        });
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

  return { handleUpload, handleClearFiles };
};
