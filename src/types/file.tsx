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
  
  export type { FileInfo };