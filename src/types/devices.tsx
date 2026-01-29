  
  type ScanDevice = {
    alias?: string;
    ip_address?: string;
    deviceModel?: string;
    deviceType?: string;
    fingerprint?: string;
    port?: number;
    protocol?: string;
  };

  type NetworkInfo = {
    interface_name: string;
    ip_address: string;
    number: string;
    number_int: number;
  };
  
export type { ScanDevice, NetworkInfo };