import { toaster } from "@decky/api";
import { t } from "../i18n";
import { proxyPost } from "../utils/proxyReq";
import type { ScanDevice } from "../types/devices";

export const createTextHandlers = (
  selectedDevice: ScanDevice | null,
  setUploading: (uploading: boolean) => void
) => {
  /**
   * Send text message to selected device
   */
  const handleSendText = async (text: string) => {
    if (!selectedDevice) {
      toaster.toast({
        title: t("text.sendNoDeviceTitle"),
        body: t("text.sendNoDeviceMessage"),
      });
      return;
    }

    if (!text || text.trim() === "") {
      toaster.toast({
        title: t("text.emptyTextTitle"),
        body: t("text.emptyTextMessage"),
      });
      return;
    }

    setUploading(true);

    try {
      // Create a text file entry with preview so receiver can show text dialog and return 204 (no upload)
      const textFileId = `text-${Date.now()}`;
      const filesMap: Record<string, { id: string; fileName: string; size: number; fileType: string; preview?: string }> = {
        [textFileId]: {
          id: textFileId,
          fileName: t("text.defaultFileName"),
          size: new Blob([text]).size,
          fileType: "text/plain",
          preview: text,
        },
      };

      // Prepare upload (receiver may return 204 for text-only — no upload step)
      const prepareResult = await proxyPost(
        "/api/self/v1/prepare-upload",
        {
          targetTo: selectedDevice.fingerprint,
          files: filesMap,
          textContent: text,
        }
      );

      if (prepareResult.status === 204) {
        toaster.toast({
          title: t("text.sendSuccessTitle"),
          body: t("text.sendSuccessBody")?.replace("{device}", selectedDevice.alias || selectedDevice.fingerprint || ""),
        });
        return;
      }

      if (prepareResult.status !== 200) {
        throw new Error(prepareResult.data?.error || `Prepare upload failed: ${prepareResult.status}`);
      }

      const { sessionId, files: tokens } = prepareResult.data.data;

      // Convert text to bytes for upload
      const textBytes = new TextEncoder().encode(text);

      // Upload text (only when receiver returned 200 with session)
      const uploadResult = await proxyPost(
        `/api/self/v1/upload?sessionId=${sessionId}&fileId=${textFileId}&token=${tokens[textFileId]}`,
        undefined,
        Array.from(textBytes)
      );

      if (uploadResult.status === 200) {
        toaster.toast({
          title: t("text.sendSuccessTitle"),
          body: t("text.sendSuccessBody")?.replace("{device}", selectedDevice.alias || selectedDevice.fingerprint || ""),
        });
      } else {
        throw new Error(uploadResult.data?.error || `${t("upload.failedTitle")}: ${uploadResult.status}`);
      }
    } catch (error) {
      toaster.toast({
        title: t("text.sendFailedTitle"),
        body: String(error),
      });
    } finally {
      setUploading(false);
    }
  };

  return { handleSendText };
};
