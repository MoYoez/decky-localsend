import { toaster } from "@decky/api";
import { getNotifyServerStatus, getUploadSessions, clearUploadSessions } from "./api";

export const createDevToolsHandlers = () => {
  const handleCheckNotifyStatus = async () => {
    try {
      const status = await getNotifyServerStatus();
      toaster.toast({
        title: "Notification Server Status",
        body: `Running: ${status.running}, Socket exists: ${status.socket_exists}`,
      });
    } catch (error) {
      toaster.toast({
        title: "Failed to get status",
        body: String(error),
      });
    }
  };

  const handleViewUploadHistory = async () => {
    try {
      const sessions = await getUploadSessions();
      if (sessions.length === 0) {
        toaster.toast({
          title: "Upload History",
          body: "No upload records",
        });
      } else {
        toaster.toast({
          title: "Upload History",
          body: `Total: ${sessions.length} files`,
        });
      }
    } catch (error) {
      toaster.toast({
        title: "Failed to get history",
        body: String(error),
      });
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearUploadSessions();
      toaster.toast({
        title: "History Cleared",
        body: "Upload history has been cleared",
      });
    } catch (error) {
      toaster.toast({
        title: "Failed to clear history",
        body: String(error),
      });
    }
  };

  return { handleCheckNotifyStatus, handleViewUploadHistory, handleClearHistory };
};
