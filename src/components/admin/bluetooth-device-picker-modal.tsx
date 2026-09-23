"use client";

import { useEffect, useState } from "react";
import { Bluetooth, Loader2, Printer, Radio, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BluetoothDiscoveredDevice } from "@/types/electron";

export function BluetoothDevicePickerModal() {
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState<BluetoothDiscoveredDevice[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI?.onBluetoothDeviceList) {
      return;
    }

    const unsubscribe = window.electronAPI.onBluetoothDeviceList((deviceList) => {
      setDevices(deviceList);
      setOpen(true);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const handleSelect = (deviceId: string, deviceName: string) => {
    setConnectingId(deviceId);
    try {
      window.electronAPI?.selectBluetoothDevice(deviceId);
      toast.success(`Selected Bluetooth printer: ${deviceName || deviceId}`);
      setTimeout(() => {
        setOpen(false);
        setConnectingId(null);
      }, 500);
    } catch {
      setConnectingId(null);
    }
  };

  const handleCancel = () => {
    try {
      window.electronAPI?.cancelBluetoothDevice();
    } catch {}
    setOpen(false);
    setConnectingId(null);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-blue-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Bluetooth className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Bluetooth Printer Selection
              </h3>
              <p className="text-xs text-gray-500">
                Select your thermal printer to connect
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200/60 hover:text-gray-700 transition"
            aria-label="Cancel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center gap-2 rounded-lg bg-blue-50/80 px-3 py-2 text-xs text-blue-800 border border-blue-100">
            <Radio className="h-3.5 w-3.5 animate-pulse text-blue-600 shrink-0" />
            <span>Scanning for nearby Bluetooth devices... Keep printer turned ON.</span>
          </div>

          {devices.length === 0 ? (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600 mb-2" />
              <p className="text-sm font-medium text-gray-700">Searching for printers...</p>
              <p className="text-xs text-gray-500 mt-1">
                Make sure your thermal printer is turned ON and Bluetooth is enabled on your PC.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Discovered Devices ({devices.length})
              </p>
              {devices.map((dev) => {
                const isLikelyPrinter =
                  /print|pos|thermal|mtp|rpp|inner|tvs|epson|bt/i.test(dev.deviceName || "");
                const isConnecting = connectingId === dev.deviceId;

                return (
                  <div
                    key={dev.deviceId}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition ${
                      isLikelyPrinter
                        ? "border-blue-200 bg-blue-50/40 hover:bg-blue-50"
                        : "border-gray-200 bg-gray-50/50 hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isLikelyPrinter
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        <Printer className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {dev.deviceName || "Unnamed Device"}
                          </p>
                          {isLikelyPrinter && (
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                              PRINTER
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-gray-400 truncate">
                          {dev.deviceId}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      disabled={isConnecting}
                      onClick={() => handleSelect(dev.deviceId, dev.deviceName)}
                      className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm h-8 px-3"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          Pairing...
                        </>
                      ) : (
                        <>
                          <Bluetooth className="mr-1 h-3.5 w-3.5" />
                          Connect
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/80 px-5 py-3">
          <p className="text-[11px] text-gray-500">
            Thermal PIN is usually <span className="font-semibold">0000</span> or <span className="font-semibold">1234</span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className="text-xs text-gray-600 hover:text-gray-900"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
