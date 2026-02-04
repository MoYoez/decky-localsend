import {
  DialogBody,
  DialogButton,
  DialogButtonPrimary,
  DialogFooter,
  DialogHeader,
  Focusable,
  ModalRoot,
} from "@decky/ui";
import { t } from "../i18n";

interface ConfirmReceiveModalProps {
  title?: string;
  from: string;
  fileCount: number;
  files: { fileName: string; size?: number; fileType?: string }[];
  totalFiles?: number;
  onConfirm: (confirmed: boolean) => void;
  closeModal?: () => void;
}

export const ConfirmReceiveModal = ({
  title,
  from,
  fileCount,
  files,
  totalFiles,
  onConfirm,
  closeModal,
}: ConfirmReceiveModalProps) => {
  const handleConfirm = (confirmed: boolean) => {
    closeModal?.();
    onConfirm(confirmed);
  };

  return (
    <ModalRoot onCancel={() => handleConfirm(false)} closeModal={closeModal}>
      <DialogHeader>{title || t("confirmReceive.title")}</DialogHeader>
      <DialogBody>
        <div style={{ marginBottom: "10px", fontSize: "12px", color: "#b8b6b4" }}>
          {t("confirmReceive.from")}: <strong>{from || "Unknown"}</strong> ({fileCount} {t("common.files")})
        </div>
        {files.length > 0 && (
          <Focusable style={{ maxHeight: "240px", overflowY: "auto" }}>
            {files.map((file, idx) => (
              <div key={`${file.fileName}-${idx}`} style={{ padding: "4px 0", fontSize: "12px" }}>
                {file.fileName}
                {typeof file.size === "number" ? ` (${file.size} bytes)` : ""}
              </div>
            ))}
            {totalFiles != null && totalFiles > files.length && (
              <div style={{ marginTop: "6px", color: "#8a8a8a", fontSize: "12px" }}>
                {t("fileReceived.andMoreFiles").replace("{count}", String(totalFiles - files.length))}
              </div>
            )}
          </Focusable>
        )}
      </DialogBody>
      <DialogFooter>
        <DialogButton onClick={() => handleConfirm(false)} style={{marginTop: "10px"}}>{t("confirmReceive.reject")}</DialogButton>
        <DialogButtonPrimary onClick={() => handleConfirm(true)} style={{marginTop: "10px"}}>{t("confirmReceive.accept")}</DialogButtonPrimary>
      </DialogFooter>
    </ModalRoot>
  );
};
