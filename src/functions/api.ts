import { callable } from "@decky/api";
import type { BackendStatus } from "../types/backend";

// Backend API
export const startBackend = callable<[], BackendStatus>("start_backend");
export const stopBackend = callable<[], BackendStatus>("stop_backend");
export const getBackendStatus = callable<[], BackendStatus>("get_backend_status");

// File API
export const listFolderFiles = callable<
  [string],
  {
    success: boolean;
    files: Array<{ path: string; displayPath: string; fileName: string }>;
    folderName?: string;
    count?: number;
    error?: string;
  }
>("list_folder_files");

// Upload Sessions API
export const getUploadSessions = callable<[], any[]>("get_upload_sessions");
export const clearUploadSessions = callable<[], { success: boolean }>("clear_upload_sessions");

// Notification API
export const getNotifyServerStatus = callable<
  [],
  { running: boolean; socket_path: string; socket_exists: boolean }
>("get_notify_server_status");

// Factory Reset API
export const factoryReset = callable<
  [],
  { success: boolean; message?: string; error?: string }
>("factory_reset");

// Receive History API
export interface ReceiveHistoryItem {
  id: string;
  timestamp: number;
  title: string;
  folderPath: string;
  fileCount: number;
  files: string[];
  isText?: boolean;
  textPreview?: string;
  textContent?: string;
}

export const getReceiveHistory = callable<[], ReceiveHistoryItem[]>("get_receive_history");

export const clearReceiveHistory = callable<[], { success: boolean }>("clear_receive_history");

export const deleteReceiveHistoryItem = callable<
  [string],
  { success: boolean; error?: string }
>("delete_receive_history_item");

// Backend Config API
export const getBackendConfig = callable<
  [],
  {
    alias: string;
    download_folder: string;
    legacy_mode: boolean;
    use_mixed_scan: boolean;
    skip_notify: boolean;
    multicast_address: string;
    multicast_port: number;
    pin: string;
    auto_save: boolean;
    use_https: boolean;
    notify_on_download: boolean;
    save_receive_history: boolean;
    enable_experimental: boolean;
    disable_info_logging: boolean;
  }
>("get_backend_config");

export const setBackendConfig = callable<
  [
    {
      alias: string;
      download_folder: string;
      legacy_mode: boolean;
      use_mixed_scan: boolean;
      skip_notify: boolean;
      multicast_address: string;
      multicast_port: number | string;
      pin: string;
      auto_save: boolean;
      use_https: boolean;
      notify_on_download: boolean;
      save_receive_history: boolean;
      enable_experimental: boolean;
      disable_info_logging: boolean;
    }
  ],
  { success: boolean; restarted: boolean; running: boolean; error?: string }
>("set_backend_config");
