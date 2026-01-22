import { toaster } from "@decky/api";
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
        title: "No device selected",
        body: "Please select a target device first",
      });
      return;
    }

    if (!text || text.trim() === "") {
      toaster.toast({
        title: "Empty text",
        body: "Please enter text to send",
      });
      return;
    }

    setUploading(true);

    try {
      // Create a text file entry
      const textFileId = `text-${Date.now()}`;
      const filesMap: Record<string, { id: string; fileName: string; size: number; fileType: string }> = {
        [textFileId]: {
          id: textFileId,
          fileName: "message.txt",
          size: new Blob([text]).size,
          fileType: "text/plain",
        },
      };

      // Prepare upload
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

      // Convert text to bytes for upload
      const textBytes = new TextEncoder().encode(text);

      // Upload text
      const uploadResult = await proxyPost(
        `/api/self/v1/upload?sessionId=${sessionId}&fileId=${textFileId}&token=${tokens[textFileId]}`,
        undefined,
        Array.from(textBytes)
      );

      if (uploadResult.status === 200) {
        toaster.toast({
          title: "Text sent",
          body: `Successfully sent text message to ${selectedDevice.alias}`,
        });
      } else {
        throw new Error(uploadResult.data?.error || `Upload failed: ${uploadResult.status}`);
      }
    } catch (error) {
      toaster.toast({
        title: "Failed to send text",
        body: String(error),
      });
    } finally {
      setUploading(false);
    }
  };

  return { handleSendText };
};
