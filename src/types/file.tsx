type FileInfo = {
    id: string;
    fileName: string;
    sourcePath: string;
    // Optional text content for text-based files
    textContent?: string;
  };
  
  export type { FileInfo };