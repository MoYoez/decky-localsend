import { 
  PanelSection, 
  PanelSectionRow, 
  ButtonItem, 
  Field,
  Focusable,
  showModal
} from "@decky/ui";
import { toaster } from "@decky/api";
import { useEffect, useState } from "react";
import { FaTimes, FaFolder, FaSync, FaFileAlt } from "react-icons/fa";
import { 
  getReceiveHistory, 
  clearReceiveHistory, 
  deleteReceiveHistoryItem,
  type ReceiveHistoryItem 
} from "../functions/api";
import { FileReceivedModal } from "./FileReceivedModal";
import { TextReceivedModal } from "./TextReceivedModal";
import { ConfirmModal } from "./ConfirmModal";
import { t } from "../i18n";

interface ReceiveHistoryPanelProps {
  saveReceiveHistory: boolean;
}

export const ReceiveHistoryPanel = ({ saveReceiveHistory }: ReceiveHistoryPanelProps) => {
  const [history, setHistory] = useState<ReceiveHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    if (!saveReceiveHistory) {
      setHistory([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getReceiveHistory();
      setHistory(data || []);
    } catch (error) {
      console.error("Failed to load receive history:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [saveReceiveHistory]);

  const handleRefresh = () => {
    loadHistory();
  };

  const handleClearAll = () => {
    const modal = showModal(
      <ConfirmModal
        title={t("receiveHistory.clearAllTitle")}
        message={t("receiveHistory.clearAllMessage")}
        confirmText={t("common.clear")}
        cancelText={t("common.cancel")}
        onConfirm={async () => {
          try {
            await clearReceiveHistory();
            setHistory([]);
            toaster.toast({
              title: t("receiveHistory.cleared"),
              body: "",
            });
          } catch (error) {
            toaster.toast({
              title: t("common.failed"),
              body: String(error),
            });
          }
        }}
        closeModal={() => modal.Close()}
      />
    );
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const result = await deleteReceiveHistoryItem(itemId);
      if (result.success) {
        setHistory((prev) => prev.filter((item) => item.id !== itemId));
      }
    } catch (error) {
      toaster.toast({
        title: t("common.failed"),
        body: String(error),
      });
    }
  };

  const handleViewItem = (item: ReceiveHistoryItem) => {
    if (item.isText && item.textContent) {
      // Show text modal for text items
      const modalResult = showModal(
        <TextReceivedModal
          title={item.title}
          content={item.textContent}
          fileName={item.files[0] || "text.txt"}
          onClose={() => {}}
          closeModal={() => modalResult.Close()}
        />
      );
    } else {
      // Show file modal for file items
      const modalResult = showModal(
        <FileReceivedModal
          title={item.title}
          folderPath={item.folderPath}
          fileCount={item.fileCount}
          files={item.files}
          onClose={() => {}}
          closeModal={() => modalResult.Close()}
        />
      );
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("receiveHistory.justNow");
    if (diffMins < 60) return `${diffMins} ${t("receiveHistory.minutesAgo")}`;
    if (diffHours < 24) return `${diffHours} ${t("receiveHistory.hoursAgo")}`;
    if (diffDays < 7) return `${diffDays} ${t("receiveHistory.daysAgo")}`;
    
    return date.toLocaleDateString();
  };

  if (!saveReceiveHistory) {
    return (
      <PanelSection title={t("receiveHistory.title")}>
        <PanelSectionRow>
          <div style={{ color: '#888', fontSize: '12px' }}>
            {t("receiveHistory.disabled")}
          </div>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  return (
    <PanelSection title={t("receiveHistory.title")}>
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={handleRefresh} disabled={loading}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <FaSync size={12} />
            {loading ? t("receiveHistory.loading") : t("receiveHistory.refresh")}
          </span>
        </ButtonItem>
      </PanelSectionRow>
      
      {history.length === 0 ? (
        <PanelSectionRow>
          <div style={{ color: '#888', fontSize: '12px', textAlign: 'center' }}>
            {t("receiveHistory.empty")}
          </div>
        </PanelSectionRow>
      ) : (
        <>
          <PanelSectionRow>
            <Field label={t("receiveHistory.recordCount")}>
              {history.length}
            </Field>
          </PanelSectionRow>
          <PanelSectionRow>
            <Focusable style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {history.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 4px',
                    borderBottom: '1px solid #3d3d3d',
                    fontSize: '12px',
                  }}
                >
                  <div
                    style={{ 
                      flex: 1, 
                      cursor: 'pointer',
                      overflow: 'hidden',
                    }}
                    onClick={() => handleViewItem(item)}
                  >
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      marginBottom: '2px'
                    }}>
                      {item.isText ? (
                        <FaFileAlt size={12} style={{ color: '#ffa500' }} />
                      ) : (
                        <FaFolder size={12} style={{ color: '#4a9eff' }} />
                      )}
                      <span style={{ 
                        fontWeight: 'bold',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {item.isText 
                          ? (item.textPreview || t("receiveHistory.textReceived"))
                          : `${item.fileCount} ${t("common.files")}`
                        }
                      </span>
                    </div>
                    <div style={{ 
                      color: '#888', 
                      fontSize: '10px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {formatTime(item.timestamp)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(item.id);
                    }}
                    style={{
                      marginLeft: '8px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      backgroundColor: '#dc3545',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <FaTimes size={10} />
                  </button>
                </div>
              ))}
            </Focusable>
          </PanelSectionRow>
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={handleClearAll}>
              {t("receiveHistory.clearAll")}
            </ButtonItem>
          </PanelSectionRow>
        </>
      )}
    </PanelSection>
  );
};
