import { PanelSection, PanelSectionRow, ButtonItem } from "@decky/ui";
import type { ScanDevice } from "../types/devices";

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
      <PanelSection title="Available Devices">
        {devices.length === 0 ? (
          <PanelSectionRow>
            <div>No devices</div>
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
                    {selectedDevice?.fingerprint === device.fingerprint ? " (Selected)" : ""}
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