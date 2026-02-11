import { PanelSection, PanelSectionRow, ButtonItem } from "@decky/ui";
import { t } from "../i18n";
import type { ReceiveProgressState } from "../utils/store";
import { FaTimes } from "react-icons/fa";

// reference: https://github.com/musick-dev/museck/blob/main/src/components/ProgressCard.tsx
const theme = {
  surfaceContainer: "#1e1e2a",
  surfaceContainerHigh: "#262636",
  surfaceContainerHighest: "#2e2e42",
  primary: "#4a9eff",
  onSurface: "#e8e8ee",
  onSurfaceVariant: "#9898a8",
  outline: "#48485a",
  error: "#ff6b6b",
  radiusMd: "16px",
  radiusFull: "9999px",
  transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
};

interface ReceiveProgressPanelProps {
  receiveProgress: ReceiveProgressState;
  onCancelReceive?: (sessionId: string) => void;
}

/**
 * Panel block showing receive progress (X / Y files) during an upload session.
 * reference: https://github.com/musick-dev/museck/blob/main/src/components/ProgressCard.tsx
 */
export const ReceiveProgressPanel = ({ receiveProgress, onCancelReceive }: ReceiveProgressPanelProps) => {
  const { totalFiles, completedCount, currentFileName, sessionId } = receiveProgress;
  const percent = totalFiles > 0 ? Math.min(100, Math.round((completedCount / totalFiles) * 100)) : 0;
  const filesCountText = t("receiveProgress.filesCount")
    .replace("{current}", String(completedCount))
    .replace("{total}", String(totalFiles));

  return (
    <PanelSection title={t("receiveProgress.receiving")}>
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
          {/* Files count + progress bar */}
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
      {onCancelReceive && sessionId && (
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => onCancelReceive(sessionId)}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                color: theme.error,
                fontSize: "12px",
                fontWeight: "500",
              }}
            >
              <FaTimes style={{ fontSize: "12px", flexShrink: 0 }} />
              {t("receiveProgress.cancelReceive")}
            </div>
          </ButtonItem>
        </PanelSectionRow>
      )}
    </PanelSection>
  );
};
