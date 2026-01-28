import { PanelSection, PanelSectionRow, ButtonItem } from "@decky/ui";
import type { ScanDevice } from "../types/devices";
import { t } from "../i18n";

function DevicesPanel({ 
    devices, 
    selectedDevice, 
    onSelectDevice 
  }: { 
    devices: ScanDevice[]; 
    selectedDevice: ScanDevice | null;
    onSelectDevice: (device: ScanDevice) => void;
  }) {
    return (
      <PanelSection title={t("backend.availableDevices")}>
        {devices.length === 0 ? (
          <PanelSectionRow>
            <div>{t("backend.noDevices")}</div>
          </PanelSectionRow>
        ) : (
          devices.map((device, index) => (
            <PanelSectionRow key={`${device.fingerprint ?? device.alias ?? "device"}-${index}`}>
              <ButtonItem 
                layout="below" 
                onClick={() => onSelectDevice(device)}
              >
                <div>
                  <div style={{ fontWeight: 'bold' }}>
                    {device.alias ?? "Unknown Device"}
                    {selectedDevice?.fingerprint === device.fingerprint ? ` (${t("backend.selected")})` : ""}
                  </div>
                  <div style={{ fontSize: '12px', opacity: 0.7 }}>
                    {device.ip_address as string} - {device.deviceModel ?? "unknown"}
                  </div>
                </div>
              </ButtonItem>
            </PanelSectionRow>
          ))
        )}
      </PanelSection>
    );
  };

export default DevicesPanel;