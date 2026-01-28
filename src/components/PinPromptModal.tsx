import {
  DialogBody,
  DialogButton,
  DialogButtonPrimary,
  DialogFooter,
  DialogHeader,
  Field,
  ModalRoot,
  TextField,
} from "@decky/ui";
import { useState } from "react";
import { t } from "../i18n";

interface PinPromptModalProps {
  title?: string;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
  closeModal?: () => void;
}

export const PinPromptModal = ({
  title = "PIN Required",
  onSubmit,
  onCancel,
  closeModal,
}: PinPromptModalProps) => {
  const [pin, setPin] = useState("");

  const handleCancel = () => {
    closeModal?.();
    onCancel();
  };

  const handleSubmit = () => {
    const trimmed = pin.trim();
    if (!trimmed) return;
    closeModal?.();
    onSubmit(trimmed);
  };

  return (
    <ModalRoot onCancel={handleCancel} closeModal={closeModal}>
      <DialogHeader>{title}</DialogHeader>
      <DialogBody>
        <Field label="PIN">
          <TextField
            value={pin}
            onChange={(e) => setPin(e?.target?.value || "")}
            style={{ width: "100%",minWidth: "200px" }}
          />
        </Field>
      </DialogBody>
      <DialogFooter>
        <DialogButton onClick={handleCancel} style={{marginTop: "10px"}}>{t("common.cancel")}</DialogButton>
        <DialogButtonPrimary onClick={handleSubmit} disabled={!pin.trim()}>
          {t("common.confirm")}
        </DialogButtonPrimary>
      </DialogFooter>
    </ModalRoot>
  );
};
