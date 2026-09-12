import { registerPlugin } from "@capacitor/core";

export interface BondedBluetoothDevice {
  name: string;
  address: string;
}

export interface ThermalPrinterPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  listBondedDevices(): Promise<{ devices: BondedBluetoothDevice[] }>;
  connect(options: { address: string }): Promise<{ name: string; address: string }>;
  write(options: { data: string }): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): Promise<{ connected: boolean }>;
}

export const ThermalPrinter = registerPlugin<ThermalPrinterPlugin>("ThermalPrinter");
