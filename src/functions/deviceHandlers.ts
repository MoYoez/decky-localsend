import { toaster } from "@decky/api";
import { t } from "../i18n";
import { proxyGet } from "../utils/proxyReq";
import type { BackendStatus } from "../types/backend";
import type { ScanDevice } from "../types/devices";

export const createDeviceHandlers = (
  backend: BackendStatus,
  setDevices: (devices: ScanDevice[]) => void,
  setRefreshLoading: (loading: boolean) => void,
  setScanLoading: (loading: boolean) => void,
  selectedDevice: ScanDevice | null,
  setSelectedDevice: (device: ScanDevice | null) => void
) => {
  // Helper function to update device list
  const updateDeviceList = (newDevices: ScanDevice[]) => {
    setDevices(newDevices);
    
    if (selectedDevice) {
      const stillExists = newDevices.some(
        (d) => d.fingerprint === selectedDevice.fingerprint
      );
      if (stillExists) {
        const updatedDevice = newDevices.find(
          (d) => d.fingerprint === selectedDevice.fingerprint
        );
        setSelectedDevice(updatedDevice ?? null);
      }
    }
  };

  // Refresh device list - gets current cached devices (scan-current)
  const handleRefreshDevices = async () => {
    if (!backend.running) {
      toaster.toast({
        title: t("toast.backendNotRunning"),
        body: t("toast.backendNotRunningBody"),
      });
      return;
    }
    setRefreshLoading(true);
    
    try {
      const result = await proxyGet("/api/self/v1/scan-current");
      if (result.status !== 200) {
        throw new Error(`Refresh failed: ${result.status}`);
      }
      const newDevices: ScanDevice[] = result.data?.data ?? [];
      updateDeviceList(newDevices);
    } catch (error) {
      toaster.toast({
        title: "Refresh failed",
        body: `${error}`,
      });
    } finally {
      setRefreshLoading(false);
    }
  };

  // Trigger immediate scan (scan-now)
  const handleScanNow = async () => {
    if (!backend.running) {
      toaster.toast({
        title: t("toast.backendNotRunning"),
        body: t("toast.backendNotRunningBody"),
      });
      return;
    }
    setScanLoading(true);

    // Clear current devices before scanning
    setDevices([]);
    setSelectedDevice(null);
    
    try {
      const result = await proxyGet("/api/self/v1/scan-now");
      if (result.status !== 200) {
        throw new Error(`Scan failed: ${result.status}`);
      }
      const newDevices: ScanDevice[] = result.data?.data ?? [];
      updateDeviceList(newDevices);
    } catch (error) {
      toaster.toast({
        title: "Scan failed",
        body: `${error}`,
      });
    } finally {
      setScanLoading(false);
    }
  };

  // Legacy handleScan - now calls scan-now for immediate scan
  const handleScan = handleScanNow;

  return { handleScan, handleRefreshDevices, handleScanNow };
};
