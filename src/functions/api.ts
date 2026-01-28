import { callable } from "@decky/api";
import type { BackendStatus } from "../types/backend";

// Backend API
export const startBackend = callable<[], BackendStatus>("start_backend");
export const stopBackend = callable<[], BackendStatus>("stop_backend");
export const getBackendStatus = callable<[], BackendStatus>("get_backend_status");

// File API
export const prepareFolderUpload = callable<
  [string],
  { success: boolean; path?: string; file_name?: string; size?: number; file_type?: string; error?: string }
>("prepare_folder_upload");

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
    }
  ],
  { success: boolean; restarted: boolean; running: boolean; error?: string }
>("set_backend_config");
