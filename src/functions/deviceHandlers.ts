import { toaster } from "@decky/api";
import { proxyGet } from "../utils/proxyReq";
import type { BackendStatus } from "../types/backend";
import type { ScanDevice } from "../types/devices";

export const createDeviceHandlers = (
  backend: BackendStatus,
  setDevices: (devices: ScanDevice[]) => void,
  setLoading: (loading: boolean) => void
) => {
  const handleScan = async () => {
    if (!backend.running) {
      toaster.toast({
        title: "Backend not running",
        body: "Please start the LocalSend backend first",
      });
      return;
    }
    setLoading(true);
    try {
      const result = await proxyGet("/api/self/v1/scan-current");
      if (result.status !== 200) {
        throw new Error(`Scan failed: ${result.status}`);
      }
      setDevices(result.data?.data ?? []);
    } catch (error) {
      toaster.toast({
        title: "Scan failed",
        body: `${error}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return { handleScan };
};
