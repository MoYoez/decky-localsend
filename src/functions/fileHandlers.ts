import { toaster, openFilePicker, FileSelectionType } from "@decky/api";
import fileOpener from "../utils/fileOpener";
import { listFolderFiles } from "./api";
import type { FileInfo } from "../types/file";

export const createFileHandlers = (
  addFile: (file: FileInfo) => void,
  uploading: boolean
) => {
  const handleFileSelect = async () => {
    if (uploading) return;
    try {
      const result = await openFilePicker(
        FileSelectionType.FILE,
        "/home/deck"
      );

      const realpath = result.realpath ?? result.path;
      const fileName = result.path.split("/").pop() || "unknown";
      
      const newFile: FileInfo = {
        id: `file-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        fileName,
        sourcePath: realpath,
      };
      addFile(newFile);

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

      // Get the real folder path
      const folderPath = result.realpath ?? result.path;
      
      const folderResult = await listFolderFiles(folderPath);
      if (!folderResult.success || folderResult.files.length === 0) {
        throw new Error(folderResult.error || "Folder is empty or inaccessible");
      }

      // Add folder as a single item
      const folderFile: FileInfo = {
        id: `folder-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        fileName: folderResult.folderName || folderPath.split("/").pop() || "folder",
        sourcePath: folderPath,
        isFolder: true,
        folderPath: folderPath,
        fileCount: folderResult.count,
      };
      addFile(folderFile);

      toaster.toast({
        title: "Folder selected",
        body: `${folderResult.count} files from ${folderResult.folderName}`,
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
