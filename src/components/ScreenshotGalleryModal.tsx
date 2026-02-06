import {
  ModalRoot,
  DialogButton,
  Focusable,
  ToggleField,
} from "@decky/ui";
import { useState, useEffect } from "react";
import { toaster } from "@decky/api";
import { t } from "../i18n";
import { proxyGet } from "../utils/proxyReq";

interface Screenshot {
  path: string;
  filename: string;
  size: number;
  mtime: number;
  mtime_str: string;
}

interface ScreenshotGalleryModalProps {
  backendUrl: string;
  onSelectScreenshots: (screenshots: Screenshot[]) => void;
  closeModal: () => void;
}

export const ScreenshotGalleryModal = ({ onSelectScreenshots, closeModal }: ScreenshotGalleryModalProps) => {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectAll, setSelectAll] = useState(false);
  const [imageBlobUrls, setImageBlobUrls] = useState<Map<string, string>>(new Map());

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    loadScreenshots(1);
  }, []);

  // Load images through proxyGet
  useEffect(() => {
    if (screenshots.length === 0) return;

    const loadImages = async () => {
      const urlMap = new Map<string, string>();
      
      for (const screenshot of screenshots) {
        try {
          const imageUrl = `/api/self/v1/get-image?fileName=file://${encodeURIComponent(screenshot.path)}`;
          const result = await proxyGet(imageUrl);
          
          if (result.status === 200 && result.data) {
            // Convert base64 to blob URL
            const base64Data = result.data;
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'image/png' });
            const blobUrl = URL.createObjectURL(blob);
            urlMap.set(screenshot.path, blobUrl);
          }
        } catch (error) {
          console.error(`Failed to load image for ${screenshot.filename}:`, error);
        }
      }
      
      setImageBlobUrls(urlMap);
    };

    loadImages();

    // Cleanup blob URLs on unmount
    return () => {
      imageBlobUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [screenshots]);

  
  const loadScreenshots = async (page: number, refreshNow?: boolean) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (refreshNow) {
        params.set("refresh-now", "1");
      }
      const result = await proxyGet(`/api/self/v1/get-user-screenshot?${params.toString()}`);
      const status = result?.status;
      const data = result?.data;
      if (status !== 200 || data?.error) {
        toaster.toast({
          title: t("screenshot.loadFailed"),
          body: data?.error || t("common.unknownError"),
        });
        return;
      }
      const list = data?.data?.screenshots ?? [];
      const totalCount = data?.data?.total ?? 0;
      setScreenshots(list);
      setTotal(totalCount);
      setCurrentPage(page);
    } catch (error) {
      toaster.toast({
        title: t("screenshot.loadFailed"),
        body: String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleScreenshot = (path: string) => {
    const newSelected = new Set(selectedPaths);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedPaths(newSelected);
    setSelectAll(newSelected.size === screenshots.length);
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedPaths(new Set(screenshots.map(s => s.path)));
    } else {
      setSelectedPaths(new Set());
    }
  };

  const handleConfirm = () => {
    const selected = screenshots.filter(s => selectedPaths.has(s.path));
    if (selected.length === 0) {
      toaster.toast({
        title: t("screenshot.noSelection"),
        body: t("screenshot.pleaseSelectScreenshots"),
      });
      return;
    }
    onSelectScreenshots(selected);
    closeModal();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const currentScreenshots = screenshots;

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      loadScreenshots(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      loadScreenshots(currentPage - 1);
    }
  };

  return (
    <ModalRoot onCancel={closeModal}>
      <style>
        {`
          .screenshot-item.gpfocus {
            box-shadow: 0 0 0 3px #1a9fff !important;
            outline: none !important;
          }
        `}
      </style>
      <Focusable style={{ 
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "15px"
      }}>
        <h2 style={{ margin: 0 }}>{t("screenshot.gallery")}</h2>
        
        {loading ? (
          <div style={{ textAlign: "center", padding: "20px" }}>
            {t("screenshot.loading")}
          </div>
        ) : screenshots.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px" }}>
            {t("screenshot.noScreenshots")}
          </div>
        ) : (
          <>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              padding: "10px 0",
              flexWrap: "wrap",
              gap: "10px"
            }}>
              <ToggleField
                label={t("screenshot.selectAll")}
                checked={selectAll}
                onChange={toggleSelectAll}
              />
              <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
                <span style={{ fontSize: "14px", opacity: 0.8 }}>
                  {t("screenshot.page")}: {currentPage} / {totalPages}
                </span>
                <span style={{ fontSize: "14px", opacity: 0.8 }}>
                  {t("screenshot.selected")}: {selectedPaths.size} / {screenshots.length}
                </span>
              </div>
            </div>

            <Focusable 
              flow-children="horizontal"
              style={{ 
                flex: 1,
                overflowY: "auto",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "15px",
              }}
            >
              {currentScreenshots.map((screenshot) => (
                <Focusable 
                  key={screenshot.path}
                  onActivate={() => toggleScreenshot(screenshot.path)}
                  onClick={() => toggleScreenshot(screenshot.path)}
                  className="screenshot-item"
                  style={{
                    border: selectedPaths.has(screenshot.path) 
                      ? "3px solid #4CAF50" 
                      : "1px solid #666",
                    borderRadius: "8px",
                    overflow: "hidden",
                    cursor: "pointer",
                    backgroundColor: "#1a1a1a",
                    transition: "all 0.2s",
                    outline: "none"
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      paddingTop: "56.25%",
                      backgroundColor: "#000"
                    }}
                  >
                    {imageBlobUrls.has(screenshot.path) ? (
                      <img 
                        src={imageBlobUrls.get(screenshot.path)}
                        alt={screenshot.filename}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "contain"
                        }}
                      />
                    ) : (
                      <div style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#666"
                      }}>
                        {t("screenshot.loading")}
                      </div>
                    )}
                    {selectedPaths.has(screenshot.path) && (
                      <div style={{
                        position: "absolute",
                        top: "5px",
                        right: "5px",
                        backgroundColor: "#4CAF50",
                        borderRadius: "50%",
                        width: "24px",
                        height: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontWeight: "bold"
                      }}>
                        ✓
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "10px" }}>
                    <div style={{ 
                      fontSize: "12px", 
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      marginBottom: "5px"
                    }}>
                      {screenshot.filename}
                    </div>
                    <div style={{ 
                      fontSize: "10px", 
                      opacity: 0.7,
                      display: "flex",
                      justifyContent: "space-between"
                    }}>
                      <span>{formatFileSize(screenshot.size)}</span>
                    </div>
                    <div style={{ fontSize: "10px", opacity: 0.7 }}>
                      {screenshot.mtime_str}
                    </div>
                  </div>
                </Focusable>
              ))}
            </Focusable>

            <Focusable style={{ 
              display: "flex", 
              gap: "8px", 
              justifyContent: "space-between",
              paddingTop: "10px",
              borderTop: "1px solid #333"
            }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <DialogButton 
                  style={{ minWidth: "60px", padding: "8px 12px", fontSize: "13px" }}
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                >
                  {t("screenshot.prevPage")}
                </DialogButton>
                <DialogButton 
                  style={{ minWidth: "60px", padding: "8px 12px", fontSize: "13px" }}
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                >
                  {t("screenshot.nextPage")}
                </DialogButton>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <DialogButton 
                  style={{ minWidth: "50px", padding: "8px 12px", fontSize: "13px" }}
                  onClick={() => loadScreenshots(currentPage, true)}
                >
                  {t("screenshot.refresh")}
                </DialogButton>
                <DialogButton 
                  style={{ minWidth: "50px", padding: "8px 12px", fontSize: "13px" }}
                  onClick={closeModal}
                >
                  {t("common.cancel")}
                </DialogButton>
                <DialogButton 
                  style={{ minWidth: "80px", padding: "8px 12px", fontSize: "13px" }}
                  onClick={handleConfirm}
                  disabled={selectedPaths.size === 0}
                >
                  {t("screenshot.addToQueue")} ({selectedPaths.size})
                </DialogButton>
              </div>
            </Focusable>
          </>
        )}
      </Focusable>
    </ModalRoot>
  );
};
