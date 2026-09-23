export interface ElectronPrinter {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
}

export interface BluetoothDiscoveredDevice {
  deviceId: string;
  deviceName: string;
}

export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  printSilent: (options?: {
    silent?: boolean;
    deviceName?: string;
    pageSize?: { width: number; height: number };
  }) => Promise<{ success: boolean; error?: string }>;
  getPrinters: () => Promise<ElectronPrinter[]>;
  onBluetoothDeviceList: (
    callback: (devices: BluetoothDiscoveredDevice[]) => void
  ) => () => void;
  selectBluetoothDevice: (deviceId: string) => void;
  cancelBluetoothDevice: () => void;
  onOpenPrinterSettings: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
