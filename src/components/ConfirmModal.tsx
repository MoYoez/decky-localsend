import {
  DialogBody,
  DialogButton,
  DialogButtonPrimary,
  DialogFooter,
  DialogHeader,
  ModalRoot,
} from "@decky/ui";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  closeModal?: () => void;
}

export const ConfirmModal = ({
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  closeModal,
}: ConfirmModalProps) => {
  const handleConfirm = () => {
    closeModal?.();
    onConfirm();
  };

  const handleCancel = () => {
    closeModal?.();
    onCancel?.();
  };

  return (
    <ModalRoot onCancel={handleCancel} closeModal={closeModal}>
      <DialogHeader>{title}</DialogHeader>
      <DialogBody>
        <div style={{ fontSize: "14px", color: "#b8b6b4", whiteSpace: "pre-wrap" }}>
          {message}
        </div>
      </DialogBody>
      <DialogFooter>
        <DialogButton onClick={handleCancel}>{cancelText}</DialogButton>
        <DialogButtonPrimary onClick={handleConfirm}>{confirmText}</DialogButtonPrimary>
      </DialogFooter>
    </ModalRoot>
  );
};
