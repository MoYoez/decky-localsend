// Simplified from https://github.com/SteamGridDB/decky-steamgriddb/blob/main/src/utils/openFilePicker.tsx
import { FileSelectionType, openFilePicker } from '@decky/api';

export type FilePickerFilter = RegExp | ((file: File) => boolean) | undefined;

export default (
  startPath: string,
  includeFiles?: boolean,
  filter?: FilePickerFilter,
  filePickerSettings?: {
    validFileExtensions?: string[];
    defaultHidden?: boolean;
  },
  usingFolder: boolean = false,
): Promise<{ path: string; realpath: string }> => {
  return new Promise((resolve, reject) => {
    openFilePicker(
      usingFolder ? FileSelectionType.FOLDER : FileSelectionType.FILE,
      startPath,
      includeFiles,
      true,
      filter,
      filePickerSettings?.validFileExtensions,
      filePickerSettings?.defaultHidden,
      false
    ).then(resolve, () => reject('User Canceled'));
  });
};