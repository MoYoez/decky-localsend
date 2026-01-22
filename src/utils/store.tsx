import { create } from 'zustand';

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
};

// Store state interface
interface LocalSendStore {
  // Available devices state
  devices: ScanDevice[];
  setDevices: (devices: ScanDevice[]) => void;
  
  // Selected device state
  selectedDevice: ScanDevice | null;
  setSelectedDevice: (device: ScanDevice | null) => void;
  
  // Selected files state
  selectedFiles: FileInfo[];
  setSelectedFiles: (files: FileInfo[]) => void;
  addFile: (file: FileInfo) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  
  // Reset all state
  resetAll: () => void;
}

// Create the store
export const useLocalSendStore = create<LocalSendStore>((set) => ({
  // Initial state
  devices: [],
  selectedDevice: null,
  selectedFiles: [],
  
  // Actions for devices
  setDevices: (devices) => set({ devices }),
  
  // Actions for selected device
  setSelectedDevice: (device) => set({ selectedDevice: device }),
  
  // Actions for selected files
  setSelectedFiles: (files) => set({ selectedFiles: files }),
  
  addFile: (file) => set((state) => {
    // Prevent duplicate files (check by sourcePath or textContent for text files)
    if (file.textContent) {
      // For text files, check if same text content already exists
      if (state.selectedFiles.some((item) => item.textContent === file.textContent && item.fileName === file.fileName)) {
        return state;
      }
    } else {
      // For regular files, check by sourcePath
      if (state.selectedFiles.some((item) => item.sourcePath === file.sourcePath)) {
        return state;
      }
    }
    return { selectedFiles: [...state.selectedFiles, file] };
  }),
  
  removeFile: (fileId) => set((state) => ({
    selectedFiles: state.selectedFiles.filter((file) => file.id !== fileId),
  })),
  
  clearFiles: () => set({ selectedFiles: [] }),
  
  // Reset all state to initial values
  resetAll: () => set({
    devices: [],
    selectedDevice: null,
    selectedFiles: [],
  }),
}));
