import { toaster, openFilePicker, FileSelectionType } from "@decky/api";
import fileOpener from "../utils/fileOpener";
import { prepareFolderUpload } from "./api";
import type { FileInfo } from "../types/file";

export const createFileHandlers = (
  addFile: (file: FileInfo) => void,
  uploading: boolean
) => {
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

  return { handleFileSelect, handleFolderSelect };
};
