"use client";

import { useEffect, useState } from "react";
import { Bluetooth, BluetoothOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  bluetoothPrinterHint,
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  getBluetoothPrinterName,
  isBluetoothPrinterConnected,
  isWebBluetoothSupported,
} from "@/utils/bluetooth-printer";

export function BluetoothPrinterPanel() {
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const isElectron = typeof window !== "undefined" && Boolean(window.electronAPI?.isElectron);
  const supported = isWebBluetoothSupported() || isElectron;

  useEffect(() => {
    const refresh = () => {
      setConnected(isBluetoothPrinterConnected());
      setName(getBluetoothPrinterName());
    };
    refresh();
    window.addEventListener("ogs-bluetooth-printer-changed", refresh);
    return () => window.removeEventListener("ogs-bluetooth-printer-changed", refresh);
  }, []);

  const connect = async () => {
    setBusy(true);
    try {
      const printerName = await connectBluetoothPrinter();
      toast.success(`Connected to ${printerName}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not connect";
      if (!/cancel/i.test(message)) {
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    await disconnectBluetoothPrinter();
    toast.message("Bluetooth printer disconnected");
  };

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
      <div className="mb-2 flex items-center gap-2 font-medium text-gray-800">
        <Bluetooth className="h-4 w-4 text-blue-700" />
        Bluetooth printer
      </div>
      <p className="mb-3 text-xs text-gray-600">{bluetoothPrinterHint()}</p>
      {connected ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-green-800">
            Connected: {name || "Printer"}
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => void disconnect()}>
            <BluetoothOff className="mr-1 h-3.5 w-3.5" />
            Disconnect
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!supported || busy}
          onClick={() => void connect()}
        >
          {busy ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Bluetooth className="mr-1 h-3.5 w-3.5" />
          )}
          Connect Bluetooth printer
        </Button>
      )}
    </div>
  );
}
