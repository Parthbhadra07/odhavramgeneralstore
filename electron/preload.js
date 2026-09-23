// Preload script for Electron desktop POS app
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  printSilent: (options) => ipcRenderer.invoke("print-silent", options),
  getPrinters: () => ipcRenderer.invoke("get-printers"),

  // Bluetooth device discovery & selection
  onBluetoothDeviceList: (callback) => {
    const handler = (_event, devices) => callback(devices);
    ipcRenderer.on("bluetooth-device-list", handler);
    return () => ipcRenderer.removeListener("bluetooth-device-list", handler);
  },
  selectBluetoothDevice: (deviceId) => ipcRenderer.send("select-bluetooth-device", deviceId),
  cancelBluetoothDevice: () => ipcRenderer.send("cancel-bluetooth-device"),

  // Application menu triggers
  onOpenPrinterSettings: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("open-printer-settings", handler);
    return () => ipcRenderer.removeListener("open-printer-settings", handler);
  },
});

