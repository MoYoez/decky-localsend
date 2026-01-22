type UploadProgress = {
    fileId: string;
    fileName: string;
    status: 'pending' | 'uploading' | 'done' | 'error';
    error?: string;
  };

  export type { UploadProgress };