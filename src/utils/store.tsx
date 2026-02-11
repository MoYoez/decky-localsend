import { create } from 'zustand';
import type { FavoriteDevice } from '../functions/favoritesHandlers';
import type { UploadProgress } from '../types/upload';

// Type definitions
type ScanDevice = {
  alias?: string;
  ip_address?: string;
  deviceModel?: string;
  deviceType?: string;
  fingerprint?: string;
  port?: number;
  protocol?: string;
};

type FileInfo = {
  id: string;
  fileName: string;
  sourcePath: string;
  // Optional text content for text-based files
  textContent?: string;
  // For folder items
  isFolder?: boolean;
  folderPath?: string;
  fileCount?: number;
};

// Share link session with expiry tracking (exported for SharedViaLinkPage)
export interface ShareLinkSessionWithExpiry {
  sessionId: string;
  downloadUrl: string;
  createdAt: number; // timestamp
  files?: FileInfo[]; // optional file list for display in detail view
}

// Pending share files (files selected but not yet shared)
interface PendingShare {
  files: FileInfo[];
}

// Receive progress (receiver-side: shown during upload_start .. upload_end)
export interface ReceiveProgressState {
  sessionId: string;
  totalFiles: number;
  completedCount: number;
  currentFileName: string;
}

// Store state interface
interface LocalSendStore {
  // Available devices state
  devices: ScanDevice[];
  setDevices: (devices: ScanDevice[]) => void;
  
  // Selected device state
  selectedDevice: ScanDevice | null;
  setSelectedDevice: (device: ScanDevice | null) => void;
  
  // Selected files state (includes folders as items)
  selectedFiles: FileInfo[];
  setSelectedFiles: (files: FileInfo[]) => void;
  addFile: (file: FileInfo) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;

  // Share via link sessions (multiple active shares)
  shareLinkSessions: ShareLinkSessionWithExpiry[];
  addShareLinkSession: (session: ShareLinkSessionWithExpiry) => void;
  removeShareLinkSession: (sessionId: string) => void;
  clearShareLinkSessions: () => void;

  // Pending share (files to share, before creating session)
  pendingShare: PendingShare | null;
  setPendingShare: (pending: PendingShare | null) => void;

  // Favorites (preserved when modal closes / Content remounts so heart stays lit)
  favorites: FavoriteDevice[];
  setFavorites: (favorites: FavoriteDevice[]) => void;

  // Receive progress (receiver-side: upload_start .. upload_end, used by unix_socket_notification listener)
  receiveProgress: ReceiveProgressState | null;
  setReceiveProgress: (value: ReceiveProgressState | null | ((prev: ReceiveProgressState | null) => ReceiveProgressState | null)) => void;

  // Send progress (sender-side: updated by upload handler and send_progress notifications from backend)
  uploadProgress: UploadProgress[];
  setUploadProgress: (value: React.SetStateAction<UploadProgress[]>) => void;

  // Send progress display: actual file count (for folder uploads; set after prepare, updated by send_progress)
  sendProgressTotalFiles: number | null;
  sendProgressCompletedCount: number | null;
  setSendProgressStats: (total: number | null, completed: number | null) => void;

  // Current upload session id (for cancel-upload; set after prepare, cleared when send ends)
  currentUploadSessionId: string | null;
  setCurrentUploadSessionId: (id: string | null) => void;

  // Reset all state
  resetAll: () => void;
}

// Create the store
export const useLocalSendStore = create<LocalSendStore>((set) => ({
  // Initial state
  devices: [],
  selectedDevice: null,
  selectedFiles: [],
  shareLinkSessions: [],
  pendingShare: null,
  favorites: [],
  receiveProgress: null,
  uploadProgress: [],
  sendProgressTotalFiles: null,
  sendProgressCompletedCount: null,
  currentUploadSessionId: null,

  // Actions for devices
  setDevices: (devices) => set({ devices }),
  
  // Actions for selected device
  setSelectedDevice: (device) => set({ selectedDevice: device }),
  
  // Actions for selected files
  setSelectedFiles: (files) => set({ selectedFiles: files }),
  
  addFile: (file) => set((state) => {
    // Prevent duplicate files
    if (file.textContent) {
      // For text files, check if same text content already exists
      if (state.selectedFiles.some((item) => item.textContent === file.textContent && item.fileName === file.fileName)) {
        return state;
      }
    } else if (file.isFolder && file.folderPath) {
      // For folders, check by folderPath
      if (state.selectedFiles.some((item) => item.isFolder && item.folderPath === file.folderPath)) {
        return state;
      }
    } else {
      // For regular files, check by sourcePath
      if (state.selectedFiles.some((item) => !item.isFolder && item.sourcePath === file.sourcePath)) {
        return state;
      }
    }
    return { selectedFiles: [...state.selectedFiles, file] };
  }),
  
  removeFile: (fileId) => set((state) => ({
    selectedFiles: state.selectedFiles.filter((file) => file.id !== fileId),
  })),
  
  clearFiles: () => set({ selectedFiles: [] }),

  addShareLinkSession: (session) =>
    set((state) => ({
      shareLinkSessions: [...state.shareLinkSessions, session],
    })),
  removeShareLinkSession: (sessionId) =>
    set((state) => ({
      shareLinkSessions: state.shareLinkSessions.filter((s) => s.sessionId !== sessionId),
    })),
  clearShareLinkSessions: () => set({ shareLinkSessions: [] }),

  setPendingShare: (pending) => set({ pendingShare: pending }),

  setFavorites: (favorites) => set({ favorites }),

  setReceiveProgress: (value) =>
    set((state) => ({
      receiveProgress: typeof value === "function" ? value(state.receiveProgress) : value,
    })),

  setUploadProgress: (value) =>
    set((state) => ({
      uploadProgress: typeof value === "function" ? value(state.uploadProgress) : value,
    })),

  setSendProgressStats: (total, completed) =>
    set({ sendProgressTotalFiles: total, sendProgressCompletedCount: completed }),

  setCurrentUploadSessionId: (id) => set({ currentUploadSessionId: id }),

  // Reset all state to initial values
  resetAll: () => set({
    devices: [],
    selectedDevice: null,
    selectedFiles: [],
    shareLinkSessions: [],
    pendingShare: null,
    favorites: [],
    receiveProgress: null,
    uploadProgress: [],
    sendProgressTotalFiles: null,
    sendProgressCompletedCount: null,
    currentUploadSessionId: null,
  }),
}));
