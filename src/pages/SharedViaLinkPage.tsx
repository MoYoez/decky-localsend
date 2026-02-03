import { FC, useEffect, useState, useCallback, CSSProperties } from "react";
import {
  PanelSection,
  PanelSectionRow,
  ButtonItem,
  Field,
  Focusable,
  Router,
  ToggleField,
  showModal,
} from "@decky/ui";
import { toaster } from "@decky/api";
import { useLocalSendStore, type ShareLinkSessionWithExpiry } from "../utils/store";
import { closeShareSession, createShareSession } from "../functions/shareHandlers";
import { copyToClipboard } from "../utils/copyClipBoard";
import { getBackendStatus } from "../functions";
import { BasicInputBoxModal } from "../components/basicInputBoxModal";
import { proxyGet } from "../utils/proxyReq";
import { t } from "../i18n";

// One hour in milliseconds
const ONE_HOUR_MS = 60 * 60 * 1000;

function getRemaining(session: ShareLinkSessionWithExpiry): number {
  const elapsed = Date.now() - session.createdAt;
  return Math.max(0, ONE_HOUR_MS - elapsed);
}

export const SharedViaLinkPage: FC = () => {
  const shareLinkSessions = useLocalSendStore((state) => state.shareLinkSessions);
  const addShareLinkSession = useLocalSendStore((state) => state.addShareLinkSession);
  const removeShareLinkSession = useLocalSendStore((state) => state.removeShareLinkSession);
  const pendingShare = useLocalSendStore((state) => state.pendingShare);
  const setPendingShare = useLocalSendStore((state) => state.setPendingShare);

  // Backend status
  const [backendRunning, setBackendRunning] = useState(false);

  // Create share settings
  const [sharePin, setSharePin] = useState("");
  const [autoAccept, setAutoAccept] = useState(true);
  const [creating, setCreating] = useState(false);

  // QR code images loaded via proxyGet (sessionId -> data URL)
  const [qrCodeUrls, setQrCodeUrls] = useState<Record<string, string>>({});

  // Tick every second to update remaining times and auto-remove expired sessions
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(async () => {
      const sessions = useLocalSendStore.getState().shareLinkSessions;
      if (sessions.length === 0) return;
      const now = Date.now();
      for (const session of sessions) {
        const remaining = ONE_HOUR_MS - (now - session.createdAt);
        if (remaining <= 0) {
          try {
            await closeShareSession(session.sessionId);
          } catch {
            // ignore
          }
          useLocalSendStore.getState().removeShareLinkSession(session.sessionId);
          toaster.toast({ title: t("shareLink.expired"), body: "" });
        }
      }
      setTick((n) => n + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check backend status
  useEffect(() => {
    getBackendStatus()
      .then((status) => {
        setBackendRunning(status.running);
      })
      .catch(() => {
        setBackendRunning(false);
      });
  }, []);

  const handleCopy = useCallback(async (session: ShareLinkSessionWithExpiry) => {
    const ok = await copyToClipboard(session.downloadUrl);
    if (ok) {
      toaster.toast({ title: t("shareLink.copied"), body: "" });
    }
  }, []);

  const handleCloseSession = useCallback(
    async (session: ShareLinkSessionWithExpiry) => {
      try {
        await closeShareSession(session.sessionId);
        removeShareLinkSession(session.sessionId);
        toaster.toast({ title: t("shareLink.shareEnded"), body: "" });
      } catch (error) {
        toaster.toast({ title: t("common.error"), body: String(error) });
      }
    },
    [removeShareLinkSession]
  );

  // Create share with settings
  const handleStartShare = async () => {
    if (!pendingShare?.files || pendingShare.files.length === 0) {
      toaster.toast({ title: t("common.error"), body: t("shareLink.selectFiles") });
      return;
    }
    if (!backendRunning) {
      toaster.toast({ title: t("common.error"), body: t("shareLink.backendRequired") });
      return;
    }

    setCreating(true);
    try {
      const { sessionId, downloadUrl } = await createShareSession(
        pendingShare.files,
        sharePin || undefined,
        autoAccept
      );
      addShareLinkSession({
        sessionId,
        downloadUrl,
        createdAt: Date.now(),
      });
      setPendingShare(null);
      toaster.toast({ title: t("common.success"), body: "" });
    } catch (error) {
      toaster.toast({ title: t("common.error"), body: String(error) });
    } finally {
      setCreating(false);
    }
  };

  // Cancel creating share
  const handleCancelCreate = () => {
    setPendingShare(null);
    Router.Navigate("/decky-localsend-config");
  };

  // Edit PIN with modal
  const handleEditPin = () => {
    const modal = showModal(
      <BasicInputBoxModal
        title={t("shareLink.pinForShare")}
        label={t("shareLink.enterPin")}
        onSubmit={(value) => {
          setSharePin(value);
          modal.Close();
        }}
        onCancel={() => modal.Close()}
        closeModal={() => modal.Close()}
      />
    );
  };

  // Format remaining time
  const formatRemainingTime = (ms: number): string => {
    if (ms <= 0) return t("shareLink.expired");
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")} ${t("shareLink.minutes")}`;
  };

  // Load QR code via proxyGet for each session
  useEffect(() => {
    if (!backendRunning || shareLinkSessions.length === 0) return;

    const loadQrCodes = async () => {
      const next: Record<string, string> = {};
      for (const session of shareLinkSessions) {
        if (qrCodeUrls[session.sessionId]) continue;
        try {
          const path = `/api/self/v1/create-qr-code?size=200x200&data=${encodeURIComponent(session.downloadUrl)}`;
          const result = await proxyGet(path);
          if (result?.status === 200 && result?.data) {
            next[session.sessionId] = `data:image/png;base64,${result.data}`;
          }
        } catch {
          // ignore
        }
      }
      if (Object.keys(next).length > 0) {
        setQrCodeUrls((prev) => ({ ...prev, ...next }));
      }
    };

    loadQrCodes();
  }, [backendRunning, shareLinkSessions, qrCodeUrls]);

  const scrollContainerStyle: CSSProperties = {
    padding: "16px",
    overflowY: "auto",
    height: "100%",
    boxSizing: "border-box",
  };

  // Backend not running warning
  if (!backendRunning) {
    return (
      <div style={scrollContainerStyle}>
        <PanelSection title={t("shareLink.title")}>
          <PanelSectionRow>
            <Field label={t("shareLink.backendRequired")}>
              {t("backend.stopped")}
            </Field>
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={() => Router.Navigate("/decky-localsend-config")}>
              {t("common.cancel")}
            </ButtonItem>
          </PanelSectionRow>
        </PanelSection>
      </div>
    );
  }

  // Pending share - show create settings page
  if (pendingShare && pendingShare.files.length > 0) {
    return (
      <div style={scrollContainerStyle}>
        <PanelSection title={t("shareLink.createShareSettings")}>
          <PanelSectionRow>
            <Field label={t("upload.selectedFiles")}>
              {pendingShare.files.length} {t("common.files")}
            </Field>
          </PanelSectionRow>
          <PanelSectionRow>
            <Focusable style={{ maxHeight: "120px", overflowY: "auto" }}>
              {pendingShare.files.map((file) => (
                <div
                  key={file.id}
                  style={{
                    padding: "4px 0",
                    fontSize: "12px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {file.isFolder
                    ? `📁 ${file.fileName} (${file.fileCount} ${t("upload.folderFiles")})`
                    : file.fileName}
                </div>
              ))}
            </Focusable>
          </PanelSectionRow>
        </PanelSection>

        <PanelSection title={t("config.securityConfig")}>
          <PanelSectionRow>
            <Field label={t("shareLink.pinForShare")}>
              {sharePin ? "******" : t("config.pinNotSet")}
            </Field>
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={handleEditPin}>
              {t("config.editPin")}
            </ButtonItem>
          </PanelSectionRow>
          {sharePin && (
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={() => setSharePin("")}>
                {t("config.clearPin")}
              </ButtonItem>
            </PanelSectionRow>
          )}
          <PanelSectionRow>
            <ToggleField
              label={t("shareLink.autoAccept")}
              description={t("shareLink.autoAcceptDesc")}
              checked={autoAccept}
              onChange={setAutoAccept}
            />
          </PanelSectionRow>
        </PanelSection>

        <PanelSection>
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={handleStartShare} disabled={creating}>
              {creating ? "..." : t("shareLink.startShare")}
            </ButtonItem>
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={handleCancelCreate}>
              {t("shareLink.cancelCreate")}
            </ButtonItem>
          </PanelSectionRow>
        </PanelSection>
      </div>
    );
  }

  // No active share
  if (shareLinkSessions.length === 0) {
    return (
      <div style={scrollContainerStyle}>
        <PanelSection title={t("shareLink.title")}>
          <PanelSectionRow>
            <Field label={t("shareLink.noActiveShare")}>
              {t("shareLink.createFromMain")}
            </Field>
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={() => Router.Navigate("/decky-localsend-config")}>
              {t("common.cancel")}
            </ButtonItem>
          </PanelSectionRow>
        </PanelSection>
      </div>
    );
  }

  // Active share links list - show each session with link, QR, copy, end
  return (
    <div style={scrollContainerStyle}>
      <PanelSection title={t("shareLink.title")}>
        <PanelSectionRow>
          <div style={{ marginBottom: "8px", fontSize: "12px", color: "#b8b6b4" }}>
            {t("shareLink.accessHint")}
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <div style={{ marginBottom: "8px", fontSize: "12px", color: "#b8b6b4" }}>
            {t("shareLink.httpHint")}
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <div style={{ marginBottom: "8px", fontSize: "12px", color: "#b8b6b4" }}>
            {t("shareLink.sameNetworkHint")}
          </div>
        </PanelSectionRow>
      </PanelSection>

      {shareLinkSessions.map((session) => {
        const remaining = getRemaining(session);
        const isHttps = session.downloadUrl.startsWith("https://");
        return (
          <PanelSection key={session.sessionId} title={`${t("shareLink.sessionId")}: ${session.sessionId.toLowerCase()}`}>
            {isHttps && (
              <PanelSectionRow>
                <div style={{ marginBottom: "6px", fontSize: "11px", color: "#f0b429" }}>
                  {t("shareLink.httpsCertHint")}
                </div>
              </PanelSectionRow>
            )}
            <PanelSectionRow>
              <Field label={t("shareLink.Link")}>
                {session.downloadUrl.replace(/\/\?.*$/, "").replace(/\/$/, "")}
              </Field>
            </PanelSectionRow>
            <PanelSectionRow>
              <Field label={t("shareLink.sessionId")}>
                {session.sessionId}
              </Field>
            </PanelSectionRow>
            <PanelSectionRow>
              <Field label={t("shareLink.expiresIn")}>
                <span style={{ color: remaining < 5 * 60 * 1000 ? "#ff6b6b" : "#4ade80" }}>
                  {formatRemainingTime(remaining)}
                </span>
              </Field>
            </PanelSectionRow>
            <PanelSectionRow>
              <Focusable
                style={{
                  padding: "6px 8px",
                  backgroundColor: "rgba(0,0,0,0.3)",
                  borderRadius: "6px",
                  fontSize: "10px",
                  wordBreak: "break-all",
                  marginBottom: "8px",
                }}
              >
                {t("shareLink.orVisitDirect")}: {session.downloadUrl}
              </Focusable>
            </PanelSectionRow>
            <PanelSectionRow>
              <div style={{ textAlign: "center", marginBottom: "8px" }}>
                <div style={{ fontSize: "11px", marginBottom: "4px", color: "#b8b6b4" }}>
                  {t("shareLink.qrCode")}
                </div>
                <img
                  src={qrCodeUrls[session.sessionId] ?? ""}
                  alt="QR Code"
                  style={{
                    width: "160px",
                    height: "160px",
                    backgroundColor: "#fff",
                    borderRadius: "6px",
                    padding: "6px",
                  }}
                />
              </div>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={() => handleCopy(session)}>
                {t("shareLink.copyLink")}
              </ButtonItem>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem layout="below" onClick={() => handleCloseSession(session)}>
                {t("shareLink.closeShare")}
              </ButtonItem>
            </PanelSectionRow>
          </PanelSection>
        );
      })}

      <PanelSection>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={() => Router.Navigate("/decky-localsend-config")}>
            {t("shareLink.createFromMain")}
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </div>
  );
};
