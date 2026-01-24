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

// Network Interface API
export const getNetworkInterfaceSetting = callable<
  [],
  { interface: string }
>("get_network_interface_setting");
export const getNetworkInterfaces = callable<
  [],
  { interfaces: { name: string; ipv4: string[] }[] }
>("get_network_interfaces");
export const setNetworkInterfaceSetting = callable<
  [string],
  { success: boolean; interface: string; restarted: boolean; running: boolean; error?: string }
>("set_network_interface_setting");
