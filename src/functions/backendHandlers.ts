import { toaster } from "@decky/api";
import { startBackend, stopBackend } from "./api";
import type { BackendStatus } from "../types/backend";

export const createBackendHandlers = (
  setBackend: (status: BackendStatus) => void
) => {
  const handleToggleBackend = async (enabled: boolean) => {
    if (enabled) {
      const status = await startBackend();
      setBackend(status);
      if (!status.running) {
        toaster.toast({
          title: "Failed to start",
          body: status.error ?? "Unknown error",
        });
      }
    } else {
      const status = await stopBackend();
      setBackend(status);
    }
  };

  return { handleToggleBackend };
};
