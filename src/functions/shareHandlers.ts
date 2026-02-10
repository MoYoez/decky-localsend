import { proxyGet, proxyPost, proxyDelete } from "../utils/proxyReq";
import { writeTempTextFile } from "./api";
import type { FileInfo } from "../types/file";

export interface CreateShareResult {
  sessionId: string;
  downloadUrl: string;
}

/**
 * Create a share session for Download API (reverse file transfer).
 * Supports regular files, text content, and folders (folders are expanded to all internal files).
 */
export async function createShareSession(
  files: FileInfo[],
  pin?: string,
  autoAccept = true
): Promise<CreateShareResult> {
  const regularFiles = files.filter((f) => !f.textContent && !f.isFolder && f.sourcePath);
  const folderItems = files.filter((f) => f.isFolder && f.folderPath);
  const textFiles = files.filter((f) => f.textContent);
  if (regularFiles.length === 0 && folderItems.length === 0 && textFiles.length === 0) {
    throw new Error("No valid files to share.");
  }

  const filesMap: Record<
    string,
    { id?: string; fileName?: string; size?: number; fileType?: string; fileUrl: string }
  > = {};

  regularFiles.forEach((f, i) => {
    const fileId = f.id || `file${i}`;
    filesMap[fileId] = {
      id: fileId,
      fileName: f.fileName,
      fileUrl: f.sourcePath.startsWith("file://") ? f.sourcePath : `file://${f.sourcePath}`,
    };
  });

  folderItems.forEach((f, i) => {
    const fileId = f.id || `folder${i}`;
    const path = f.folderPath!.startsWith("file://") ? f.folderPath! : `file://${f.folderPath}`;
    filesMap[fileId] = {
      id: fileId,
      fileName: f.fileName,
      fileUrl: path,
    };
  });

  for (let i = 0; i < textFiles.length; i++) {
    const f = textFiles[i];
    const fileId = f.id || `text${i}`;
    const result = await writeTempTextFile(f.textContent || "", f.fileName || "text.txt");
    if (!result.success || !result.path) {
      throw new Error(result.error || "Failed to create temp file for text");
    }
    const textBytes = new TextEncoder().encode(f.textContent || "");
    filesMap[fileId] = {
      id: fileId,
      fileName: f.fileName || "text.txt",
      size: textBytes.length,
      fileType: "text/plain",
      fileUrl: result.path.startsWith("file://") ? result.path : `file://${result.path}`,
    };
  }

  const res = await proxyPost("/api/self/v1/create-share-session", {
    files: filesMap,
    pin: pin ?? "",
    autoAccept,
  });

  if (res.status !== 200) {
    throw new Error(res.data?.error || `Create share session failed: ${res.status}`);
  }

  const data = res.data?.data;
  if (!data?.sessionId || !data?.downloadUrl) {
    throw new Error("Invalid response from create-share-session");
  }

  return { sessionId: data.sessionId, downloadUrl: data.downloadUrl };
}

/**
 * Close a share session. The download link will no longer work.
 */
export async function closeShareSession(sessionId: string): Promise<void> {
  const res = await proxyDelete(
    `/api/self/v1/close-share-session?sessionId=${encodeURIComponent(sessionId)}`
  );
  if (res.status !== 200) {
    throw new Error(res.data?.error || `Close share session failed: ${res.status}`);
  }
}

/**
 * Confirm or reject a download request (when autoAccept=false).
 * clientKey identifies the requesting device (e.g. IP) for per-device confirmation.
 */
export async function confirmDownload(
  sessionId: string,
  clientKey: string,
  confirmed: boolean
): Promise<void> {
  const res = await proxyGet(
    `/api/self/v1/confirm-download?sessionId=${encodeURIComponent(sessionId)}&clientKey=${encodeURIComponent(clientKey)}&confirmed=${confirmed}`
  );
  if (res.status !== 200) {
    throw new Error(res.data?.error || `Confirm download failed: ${res.status}`);
  }
}
