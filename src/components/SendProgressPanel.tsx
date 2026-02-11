import { PanelSection, PanelSectionRow, ButtonItem } from "@decky/ui";
import { toaster } from "@decky/api";
import { t } from "../i18n";
import type { UploadProgress } from "../types/upload";
import { useLocalSendStore } from "../utils/store";
import { proxyPost } from "../utils/proxyReq";
import { FaTimes } from "react-icons/fa";

// Same theme as ReceiveProgressPanel for consistent card + progress bar layout
const theme = {
  surfaceContainer: "#1e1e2a",
  surfaceContainerHigh: "#262636",
  surfaceContainerHighest: "#2e2e42",
  primary: "#4a9eff",
  onSurfaceVariant: "#9898a8",
  outline: "#48485a",
  radiusMd: "16px",
  radiusFull: "9999px",
  transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
};

interface SendProgressPanelProps {
  uploadProgress: UploadProgress[];
}

/**
 * Panel block showing send progress (X / Y files) during an upload session.
 * Shown at top (same position as ReceiveProgressPanel) when uploadProgress has items.
 * Uses sendProgressTotalFiles/sendProgressCompletedCount from store when set (e.g. folder uploads);
 * otherwise falls back to uploadProgress length and done/error count.
 * Layout matches ReceiveProgressPanel  .
 */
const themeError = "#ff6b6b";

export const SendProgressPanel = ({ uploadProgress }: SendProgressPanelProps) => {
  const sendProgressTotalFiles = useLocalSendStore((state) => state.sendProgressTotalFiles);
  const sendProgressCompletedCount = useLocalSendStore((state) => state.sendProgressCompletedCount);
  const currentUploadSessionId = useLocalSendStore((state) => state.currentUploadSessionId);
  const setUploadProgress = useLocalSendStore((state) => state.setUploadProgress);
  const setSendProgressStats = useLocalSendStore((state) => state.setSendProgressStats);
  const setCurrentUploadSessionId = useLocalSendStore((state) => state.setCurrentUploadSessionId);

  const handleCancelSend = async () => {
    const sessionId = currentUploadSessionId;
    if (!sessionId) return;
    try {
      await proxyPost(`/api/self/v1/cancel-upload?sessionId=${encodeURIComponent(sessionId)}`);
    } finally {
      setUploadProgress([]);
      setSendProgressStats(null, null);
      setCurrentUploadSessionId(null);
      toaster.toast({ title: t("sendProgress.cancelSendToast"), body: "" });
    }
  };

  const totalFiles = sendProgressTotalFiles ?? uploadProgress.length;
  const completedCount =
    sendProgressCompletedCount ??
    uploadProgress.filter((p) => p.status === "done" || p.status === "error").length;
  const currentItem = uploadProgress.find((p) => p.status === "uploading");
  const currentFileName = currentItem?.fileName ?? "";
  const percent =
    totalFiles > 0
      ? Math.min(100, Math.round((completedCount / totalFiles) * 100))
      : 0;
  const filesCountText = t("sendProgress.filesCount")
    .replace("{current}", String(completedCount))
    .replace("{total}", String(totalFiles));

  return (
    <PanelSection title={t("sendProgress.sending")}>
      <PanelSectionRow>
        <div
          style={{
            width: "100%",
            maxWidth: "92%",
            margin: "0 auto",
            padding: "14px 16px",
            background: `linear-gradient(135deg, ${theme.surfaceContainerHigh} 0%, ${theme.surfaceContainer} 100%)`,
            borderRadius: theme.radiusMd,
            boxShadow: "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
            border: `1px solid ${theme.outline}22`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: currentFileName ? "10px" : "0",
              fontSize: "12px",
              color: theme.onSurfaceVariant,
              fontWeight: "500",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span style={{ flexShrink: 0, minWidth: "72px", textAlign: "right" }}>{filesCountText}</span>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                height: "6px",
                backgroundColor: theme.surfaceContainerHighest,
                borderRadius: theme.radiusFull,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: `${percent}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${theme.primary}88 0%, ${theme.primary} 100%)`,
                  borderRadius: theme.radiusFull,
                  transition: theme.transition,
                  boxShadow: `0 0 12px ${theme.primary}66`,
                }}
              />
            </div>
          </div>
          {currentFileName && (
            <div
              style={{
                fontSize: "11px",
                color: theme.onSurfaceVariant,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                paddingTop: "4px",
                borderTop: `1px solid ${theme.outline}22`,
              }}
            >
              {currentFileName}
            </div>
          )}
        </div>
      </PanelSectionRow>
      {currentUploadSessionId && (
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleCancelSend}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                color: themeError,
                fontSize: "12px",
                fontWeight: "500",
              }}
            >
              <FaTimes style={{ fontSize: "12px", flexShrink: 0 }} />
              {t("sendProgress.cancelSend")}
            </div>
          </ButtonItem>
        </PanelSectionRow>
      )}
    </PanelSection>
  );
};
