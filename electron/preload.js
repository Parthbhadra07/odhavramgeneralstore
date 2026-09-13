// Preload script for Electron desktop POS app
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  printSilent: (options) => ipcRenderer.invoke("print-silent", options),
  getPrinters: () => ipcRenderer.invoke("get-printers"),
});
