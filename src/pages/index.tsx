import { FC, useEffect, useState } from "react";
import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  Field,
  Focusable,
  ToggleField,
  SliderField,
  showModal,
  SidebarNavigation,
} from "@decky/ui";
import { toaster, openFilePicker, FileSelectionType } from "@decky/api";
import { FaTimes } from "react-icons/fa";
import { About } from "./about";
import { t } from "../i18n";

export { SharedViaLinkPage } from "./SharedViaLinkPage";
import { useLocalSendStore } from "../utils/store";
import { proxyGet } from "../utils/proxyReq";


import {
  getBackendConfig,
  getBackendStatus,
  setBackendConfig,
  factoryReset,
  createFavoritesHandlers,
} from "../functions";
import { BasicInputBoxModal } from "../components/basicInputBoxModal";
import { ConfirmModal } from "../components/ConfirmModal";
import { NetworkInterfaceSelectModal } from "../components/NetworkInterfaceSelectModal";
import { FavoritesAddModal } from "../components/FavoritesAddModal";
import type { NetworkInfo } from "../types/devices";

// Scan Mode Enum
enum ScanMode {
  Mixed = 0,
  Normal = 1,
  HTTP = 2,
}

const scanModeNotchLabels = [
  { notchIndex: 0, label: "Mixed", value: 0 },
  { notchIndex: 1, label: "Normal", value: 1 },
  { notchIndex: 2, label: "HTTP", value: 2 },
];

const configToScanMode = (legacyMode: boolean, useMixedScan: boolean): ScanMode => {
  if (useMixedScan) return ScanMode.Mixed;
  if (legacyMode) return ScanMode.HTTP;
  return ScanMode.Normal;
};

const scanModeToConfig = (mode: ScanMode): { legacy_mode: boolean; use_mixed_scan: boolean } => {
  switch (mode) {
    case ScanMode.Mixed:
      return { legacy_mode: false, use_mixed_scan: true };
    case ScanMode.HTTP:
      return { legacy_mode: true, use_mixed_scan: false };
    case ScanMode.Normal:
    default:
      return { legacy_mode: false, use_mixed_scan: false };
  }
};

// Main Config Page with SidebarNavigation
export const ConfigPage: FC = () => {
  const devices = useLocalSendStore((state) => state.devices);
  const setDevices = useLocalSendStore((state) => state.setDevices);

  // Backend running state
  const [backendRunning, setBackendRunning] = useState(false);

  // Config states
  const [configAlias, setConfigAlias] = useState("");
  const [downloadFolder, setDownloadFolder] = useState("");
  const [scanMode, setScanMode] = useState<ScanMode>(ScanMode.Mixed);
  const [skipNotify, setSkipNotify] = useState(false);
  const [multicastAddress, setMulticastAddress] = useState("");
  const [multicastPort, setMulticastPort] = useState("");
  const [pin, setPin] = useState("");
  const [autoSave, setAutoSave] = useState(true);
  const [autoSaveFromFavorites, setAutoSaveFromFavorites] = useState(false);
  const [useHttps, setUseHttps] = useState(true);
  const [networkInterface, setNetworkInterface] = useState("*");
  const [notifyOnDownload, setNotifyOnDownload] = useState(false);
  const [saveReceiveHistory, setSaveReceiveHistory] = useState(true);
  const [enableExperimental, setEnableExperimental] = useState(false);
  const [useDownload, setUseDownload] = useState(false);
  const [doNotMakeSessionFolder, setDoNotMakeSessionFolder] = useState(false);
  const [disableInfoLogging, setDisableInfoLogging] = useState(false);
  const [scanTimeout, setScanTimeout] = useState("500");
  const favorites = useLocalSendStore((state) => state.favorites);
  const setFavorites = useLocalSendStore((state) => state.setFavorites);
  const [networkInterfaces, setNetworkInterfaces] = useState<{ label: string; value: string }[]>([]);

  // Favorites handlers
  const { fetchFavorites, handleAddToFavorites, handleRemoveFromFavorites } = createFavoritesHandlers(
    backendRunning,
    setFavorites
  );

  // Fetch network interfaces
  const fetchNetworkInterfaces = async () => {
    if (!backendRunning) return;
    try {
      const result = await proxyGet("/api/self/v1/get-network-interfaces");
      if (result.status === 200 && result.data?.data) {
        const interfaces = result.data.data as NetworkInfo[];
        const options = [
          { label: t("config.networkInterfaceAll"), value: "*" },
          ...interfaces.map((iface) => ({
            label: `${iface.interface_name} (${iface.ip_address})`,
            value: iface.interface_name,
          })),
        ];
        setNetworkInterfaces(options);
      }
    } catch (error) {
      console.error("Failed to fetch network interfaces:", error);
    }
  };

  // Load config on mount - use getBackendStatus() (same as main page) to detect if backend is running
  useEffect(() => {
    getBackendStatus()
      .then((status) => setBackendRunning(status.running))
      .catch(() => setBackendRunning(false));

    getBackendConfig()
      .then((result) => {
        setConfigAlias(result.alias ?? "");
        setDownloadFolder(result.download_folder ?? "");
        setScanMode(configToScanMode(result.legacy_mode ?? false, result.use_mixed_scan ?? true));
        setSkipNotify(!!result.skip_notify);
        setMulticastAddress(result.multicast_address ?? "");
        setMulticastPort(result.multicast_port === 0 || result.multicast_port == null ? "" : String(result.multicast_port));
        setPin(result.pin ?? "");
        setAutoSave(!!result.auto_save);
        setAutoSaveFromFavorites(!!result.auto_save_from_favorites);
        setUseHttps(result.use_https !== false);
        setNetworkInterface(result.network_interface ?? "*");
        setNotifyOnDownload(!!result.notify_on_download);
        setSaveReceiveHistory(result.save_receive_history !== false);
        setEnableExperimental(!!result.enable_experimental);
        setUseDownload(!!result.use_download);
        setDoNotMakeSessionFolder(!!result.do_not_make_session_folder);
        setDisableInfoLogging(!!result.disable_info_logging);
        setScanTimeout(String(result.scan_timeout ?? 500));
      })
      .catch((error) => {
        toaster.toast({
          title: t("toast.failedGetBackendConfig"),
          body: `${error}`,
        });
      });
  }, []);

  // When backend becomes running, re-load full config so network_interface etc. stay in sync
  useEffect(() => {
    if (backendRunning) {
      getBackendConfig()
        .then((result) => {
          setNetworkInterface(result.network_interface ?? "*");
          fetchFavorites();
          fetchNetworkInterfaces();
        })
        .catch(() => {
          fetchFavorites();
          fetchNetworkInterfaces();
        });
    } else {
      setNetworkInterfaces([]);
      setFavorites([]);
    }
  }, [backendRunning]);

  // Save config helper
  const saveConfig = async (updates: Record<string, any>) => {
    try {
      const { legacy_mode, use_mixed_scan } = scanModeToConfig(scanMode);
      const result = await setBackendConfig({
        alias: updates.alias ?? configAlias,
        download_folder: updates.download_folder ?? downloadFolder,
        legacy_mode: updates.legacy_mode ?? legacy_mode,
        use_mixed_scan: updates.use_mixed_scan ?? use_mixed_scan,
        skip_notify: updates.skip_notify ?? skipNotify,
        multicast_address: updates.multicast_address ?? multicastAddress,
        multicast_port: updates.multicast_port ?? multicastPort,
        pin: updates.pin ?? pin,
        auto_save: updates.auto_save ?? autoSave,
        auto_save_from_favorites: updates.auto_save_from_favorites ?? autoSaveFromFavorites,
        use_https: updates.use_https ?? useHttps,
        network_interface: updates.network_interface ?? networkInterface,
        notify_on_download: updates.notify_on_download ?? notifyOnDownload,
        save_receive_history: updates.save_receive_history ?? saveReceiveHistory,
        enable_experimental: updates.enable_experimental ?? enableExperimental,
        use_download: updates.use_download ?? useDownload,
        do_not_make_session_folder: updates.do_not_make_session_folder ?? doNotMakeSessionFolder,
        disable_info_logging: updates.disable_info_logging ?? disableInfoLogging,
        scan_timeout: updates.scan_timeout ?? (parseInt(scanTimeout) || 500),
      });
      if (result.success) {
        toaster.toast({
          title: result.restarted ? t("config.restartToTakeEffect") : t("config.configSaved"),
          body: t("config.configUpdated"),
        });
      }
    } catch (error) {
      toaster.toast({
        title: t("common.error"),
        body: `${error}`,
      });
    }
  };

  // Helper for input modal
  const openInputModal = (title: string, label: string): Promise<string | null> =>
    new Promise((resolve) => {
      const modal = showModal(
        <BasicInputBoxModal
          title={title}
          label={label}
          onSubmit={(value) => {
            resolve(value);
            modal.Close();
          }}
          onCancel={() => {
            resolve(null);
            modal.Close();
          }}
          closeModal={() => modal.Close()}
        />
      );
    });



  // Handler functions
  const handleEditAlias = async () => {
    const value = await openInputModal(t("config.editAlias"), t("modal.enterAlias"));
    if (value !== null) {
      setConfigAlias(value);
      saveConfig({ alias: value });
    }
  };

  const handleEditDownloadFolder = async () => {
    const value = await openInputModal(t("config.editDownloadFolder"), t("modal.enterDownloadFolder"));
    if (value !== null) {
      setDownloadFolder(value);
      saveConfig({ download_folder: value });
    }
  };

  const handleChooseDownloadFolder = async () => {
    try {
      const result = await openFilePicker(
        FileSelectionType.FOLDER,
        "/home/deck"
      );
      const folder = result.realpath ?? result.path;
      if (folder) {
        setDownloadFolder(folder);
        saveConfig({ download_folder: folder });
        toaster.toast({ title: t("config.downloadFolder"), body: folder });
      }
    } catch (error) {
      toaster.toast({ title: t("toast.failedSelectFolder"), body: `${error}` });
    }
  };

  const handleEditMulticastAddress = async () => {
    const value = await openInputModal(t("config.editMulticastAddress"), t("modal.enterMulticastAddress"));
    if (value !== null) {
      setMulticastAddress(value);
      saveConfig({ multicast_address: value });
    }
  };

  const handleEditMulticastPort = async () => {
    const value = await openInputModal(t("config.editMulticastPort"), t("modal.enterMulticastPort"));
    if (value !== null) {
      setMulticastPort(value);
      saveConfig({ multicast_port: value });
    }
  };

  const handleScanModeChange = (value: number) => {
    const mode = value as ScanMode;
    setScanMode(mode);
    const { legacy_mode, use_mixed_scan } = scanModeToConfig(mode);
    saveConfig({ legacy_mode, use_mixed_scan });
  };

  const handleEditScanTimeout = async () => {
    const value = await openInputModal(t("config.editScanTimeout"), t("modal.enterScanTimeout"));
    if (value !== null) {
      setScanTimeout(value);
      saveConfig({ scan_timeout: parseInt(value) || 500 });
    }
  };

  const handleSelectNetworkInterface = () => {
    const modal = showModal(
      <NetworkInterfaceSelectModal
        options={networkInterfaces}
        currentValue={networkInterface}
        onSelect={(value: string) => {
          setNetworkInterface(value);
          saveConfig({ network_interface: value });
          modal.Close();
        }}
        closeModal={() => modal.Close()}
      />
    );
  };

  const handleEditPin = async () => {
    const value = await openInputModal(t("config.editPin"), t("modal.enterPin"));
    if (value !== null) {
      setPin(value);
      saveConfig({ pin: value });
    }
  };

  const handleClearPin = () => {
    showModal(
      <ConfirmModal
        title={t("config.clearPinTitle")}
        message={t("config.clearPinMessage")}
        onConfirm={() => {
          setPin("");
          saveConfig({ pin: "" });
        }}
      />
    );
  };

  const handleFactoryReset = () => {
    showModal(
      <ConfirmModal
        title={t("settings.resetAllData")}
        message={t("settings.resetAllDataConfirm")}
        onConfirm={async () => {
          try {
            const result = await factoryReset();
            if (result.success) {
              setConfigAlias("");
              setDownloadFolder("");
              setScanMode(ScanMode.Mixed);
              setSkipNotify(false);
              setMulticastAddress("");
              setMulticastPort("");
              setPin("");
              setAutoSave(true);
              setAutoSaveFromFavorites(false);
              setUseHttps(true);
              setNetworkInterface("*");
              setNotifyOnDownload(false);
              setSaveReceiveHistory(true);
              setEnableExperimental(false);
              setUseDownload(false);
              setDisableInfoLogging(false);
              setScanTimeout("500");
              toaster.toast({
                title: t("settings.resetSuccess"),
                body: t("settings.resetSuccessDesc"),
              });
            }
          } catch (error) {
            toaster.toast({ title: t("common.error"), body: `${error}` });
          }
        }}
      />
    );
  };

  // Settings Page Component (all config in one page)
  const SettingsPage: FC = () => (
    <div style={{ padding: "16px" }}>
      {/* Basic Settings */}
      <PanelSection title={t("config.basicConfig")}>
        <PanelSectionRow>
          <Field label={t("config.alias")}>{configAlias || t("config.default")}</Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleEditAlias}>
            {t("config.editAlias")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <Field label={t("config.downloadFolder")}>{downloadFolder || t("config.default")}</Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleEditDownloadFolder}>
            {t("config.editDownloadFolder")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleChooseDownloadFolder}>
            {t("config.chooseDownloadFolder")}
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      {/* Auto Save Settings */}
      <PanelSection title={t("config.autoSave")}>
        <PanelSectionRow>
          <ToggleField
            label={t("config.autoSave")}
            description={t("config.autoSaveDesc")}
            checked={autoSave}
            onChange={(checked: boolean) => {
              setAutoSave(checked);
              if (checked && autoSaveFromFavorites) {
                setAutoSaveFromFavorites(false);
                saveConfig({ auto_save: true, auto_save_from_favorites: false });
              } else {
                saveConfig({ auto_save: checked });
              }
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label={t("config.autoSaveFromFavorites")}
            description={t("config.autoSaveFromFavoritesDesc")}
            checked={autoSaveFromFavorites}
            onChange={(checked: boolean) => {
              setAutoSaveFromFavorites(checked);
              if (checked && autoSave) {
                setAutoSave(false);
                saveConfig({ auto_save: false, auto_save_from_favorites: true });
              } else {
                saveConfig({ auto_save_from_favorites: checked });
              }
            }}
          />
        </PanelSectionRow>
      </PanelSection>

      {/* Favorites */}
      <PanelSection title={t("config.favorites")}>
        <PanelSectionRow>
          <Field label={t("config.favorites")}>{favorites.length} {t("common.devices")}</Field>
        </PanelSectionRow>
        {favorites.length > 0 && (
          <PanelSectionRow>
            <Focusable style={{ maxHeight: "150px", overflowY: "auto" }}>
              {favorites.map((fav) => (
                <div
                  key={fav.favorite_fingerprint}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 0",
                    fontSize: "13px",
                  }}
                >
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {fav.favorite_alias || fav.favorite_fingerprint.substring(0, 16) + "..."}
                  </span>
                  <button
                    onClick={() => {
                      const confirmModal = showModal(
                        <ConfirmModal
                          title={t("config.favoritesRemove")}
                          message={t("config.removeFavoriteConfirm")}
                          confirmText={t("config.favoritesRemove")}
                          onConfirm={() => {
                            handleRemoveFromFavorites(fav.favorite_fingerprint);
                            confirmModal.Close();
                          }}
                          closeModal={() => confirmModal.Close()}
                        />
                      );
                    }}
                    style={{
                      marginLeft: "8px",
                      padding: "3px 6px",
                      fontSize: "11px",
                      backgroundColor: "#dc3545",
                      color: "#fff",
                      border: "none",
                      borderRadius: "3px",
                      cursor: "pointer",
                    }}
                  >
                    <FaTimes size={10} />
                  </button>
                </div>
              ))}
            </Focusable>
          </PanelSectionRow>
        )}
        {favorites.length === 0 && (
          <PanelSectionRow>
            <div style={{ fontSize: "13px", color: "#888" }}>{t("config.favoritesEmpty")}</div>
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => fetchFavorites()}
            disabled={!backendRunning}
          >
            {t("config.refreshFavoritesDevices")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={async () => {
              let devicesToShow = devices;
              if (devices.length === 0 && backendRunning) {
                toaster.toast({ title: t("config.scanningDevices"), body: "" });
                await proxyGet("/api/self/v1/scan-now");
                const res = await proxyGet("/api/self/v1/scan-current");
                const list = res.status === 200 && res.data?.data ? (res.data.data as typeof devices) : [];
                setDevices(list);
                devicesToShow = list;
              }
              const modal = showModal(
                <FavoritesAddModal
                  devices={devicesToShow}
                  favorites={favorites}
                  onAdd={async (fingerprint, alias) => {
                    await handleAddToFavorites(fingerprint, alias);
                    modal.Close();
                  }}
                  closeModal={() => modal.Close()}
                />
              );
            }}
            disabled={!backendRunning}
          >
            {t("config.favoritesAdd")}
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      {/* Network Settings */}
      <PanelSection title={t("config.networkConfig")}>
        <PanelSectionRow>
          <Field label={t("config.multicastAddress")}>{multicastAddress || t("config.default")}</Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleEditMulticastAddress}>
            {t("config.editMulticastAddress")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <Field label={t("config.multicastPort")}>{!multicastPort || multicastPort === "0" ? t("config.default") : multicastPort}</Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleEditMulticastPort}>
            {t("config.editMulticastPort")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <SliderField
            label={t("config.scanMode")}
            description={t("config.scanModeDesc")}
            value={scanMode}
            min={0}
            max={scanModeNotchLabels.length - 1}
            notchCount={scanModeNotchLabels.length}
            notchLabels={scanModeNotchLabels}
            notchTicksVisible={true}
            step={1}
            onChange={handleScanModeChange}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <Field label={t("config.scanTimeout")}>{scanTimeout || "500"}s</Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleEditScanTimeout}>
            {t("config.editScanTimeout")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <Field label={t("config.networkInterface")}>
            {networkInterface === "*" ? t("config.networkInterfaceAll") : networkInterface}
          </Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleSelectNetworkInterface} disabled={!backendRunning}>
            {t("config.networkInterface")}
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      {/* Security Settings */}
      <PanelSection title={t("config.securityConfig")}>
        <PanelSectionRow>
          <ToggleField
            label={t("config.skipNotify")}
            description={t("config.skipNotifyDesc")}
            checked={skipNotify}
            onChange={(checked: boolean) => {
              setSkipNotify(checked);
              saveConfig({ skip_notify: checked });
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <Field label={t("config.pin")}>{pin ? t("config.pinConfigured") : t("config.pinNotSet")}</Field>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleEditPin}>
            {t("config.editPin")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleClearPin} disabled={!pin}>
            {t("config.clearPin")}
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label={t("config.useHttps")}
            description={t("config.useHttpsDesc")}
            checked={useHttps}
            onChange={(checked: boolean) => {
              setUseHttps(checked);
              saveConfig({ use_https: checked });
            }}
          />
        </PanelSectionRow>
      </PanelSection>

      {/* Advanced Settings */}
      <PanelSection title={t("config.advancedConfig")}>
        <PanelSectionRow>
          <ToggleField
            label={t("config.notifyOnDownload")}
            description={t("config.notifyOnDownloadDesc")}
            checked={notifyOnDownload}
            onChange={(checked: boolean) => {
              setNotifyOnDownload(checked);
              saveConfig({ notify_on_download: checked });
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label={t("config.useDownload")}
            description={t("config.useDownloadDesc")}
            checked={useDownload}
            onChange={(checked: boolean) => {
              setUseDownload(checked);
              saveConfig({ use_download: checked });
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label={t("config.doNotMakeSessionFolder")}
            description={t("config.doNotMakeSessionFolderDesc")}
            checked={doNotMakeSessionFolder}
            onChange={(checked: boolean) => {
              setDoNotMakeSessionFolder(checked);
              saveConfig({ do_not_make_session_folder: checked });
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label={t("config.saveReceiveHistory")}
            description={t("config.saveReceiveHistoryDesc")}
            checked={saveReceiveHistory}
            onChange={(checked: boolean) => {
              setSaveReceiveHistory(checked);
              saveConfig({ save_receive_history: checked });
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label={t("config.disableInfoLogging")}
            description={t("config.disableInfoLoggingDesc")}
            checked={disableInfoLogging}
            onChange={(checked: boolean) => {
              setDisableInfoLogging(checked);
              saveConfig({ disable_info_logging: checked });
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField
            label={t("screenshot.experimental")}
            description={t("screenshot.warning")}
            checked={enableExperimental}
            onChange={(checked: boolean) => {
              setEnableExperimental(checked);
              saveConfig({ enable_experimental: checked });
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={handleFactoryReset}>
            {t("settings.resetAllData")}
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>
    </div>
  );

  return (
    <SidebarNavigation
      title={"Decky Localsend"}
      showTitle
      pages={[
        {
          title: t("config.title"),
          content: <SettingsPage />,
          route: "/decky-localsend-config/settings",
        },
        {
          title: t("about.title"),
          content: <About />,
          route: "/decky-localsend-config/about",
        },
      ]}
    />
  );
};
