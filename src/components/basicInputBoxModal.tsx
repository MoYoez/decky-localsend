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
    
  interface basicInputBoxModalProps {
    title?: string;
    label?: string;
    onSubmit: (inputValue: string) => void;
    onCancel: () => void;
    closeModal?: () => void;
  }
  
  export const BasicInputBoxModal = ({
    title = "",
    label = "",
    onSubmit,
    onCancel,
    closeModal,
  }: basicInputBoxModalProps) => {
    const [inputValue, setInputValue] = useState("");
  
    const handleCancel = () => {
      closeModal?.();
      onCancel();
    };
  
    const handleSubmit = () => {
      const trimmed = inputValue.trim();
      if (!trimmed) return;
      closeModal?.();
      onSubmit(inputValue);
    };
  
    return (
      <ModalRoot onCancel={handleCancel} closeModal={closeModal}>
        <DialogHeader>{title}</DialogHeader>
        <DialogBody>
          <Field label={label}>
            <TextField
              value={inputValue}
              onChange={(e) => setInputValue(e?.target?.value || "")}
              style={{ width: "100%",minWidth: "200px" }}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
            <DialogButton onClick={handleCancel} style={{marginTop: "10px"}}>{t("common.cancel")}</DialogButton>
          <DialogButtonPrimary onClick={handleSubmit} disabled={!inputValue.trim()}>
            {t("common.confirm")}
          </DialogButtonPrimary>
        </DialogFooter>
      </ModalRoot>
    );
  };
  