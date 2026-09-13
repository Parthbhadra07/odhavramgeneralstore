"use client";

import { useEffect, useState } from "react";
import { Download, MonitorCheck, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function DesktopInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app is already running as an installed standalone desktop app
    if (typeof window !== "undefined") {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        Boolean((window as unknown as { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron);
      setIsStandalone(isStandaloneMode);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      toast.info(
        "To install on your PC: Click the 'Install' icon in your browser address bar (top right) or use Microsoft Edge / Google Chrome."
      );
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        toast.success("Desktop App installed successfully! You can now open it from your desktop/taskbar.");
        setInstallPrompt(null);
      }
    } catch {
      toast.error("Could not trigger desktop installation");
    }
  };

  if (isStandalone) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
        <MonitorCheck className="h-3.5 w-3.5 text-green-600" />
        Desktop App
      </span>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleInstallClick}
      className="gap-1.5 border-green-300 bg-green-50/80 text-green-900 hover:bg-green-100 font-semibold text-xs shadow-sm"
      title="Install Odhavram General Store as a desktop app on your computer"
    >
      <Laptop className="h-3.5 w-3.5 text-green-700" />
      <span className="hidden md:inline">Install Desktop App</span>
      <span className="md:hidden">Install App</span>
    </Button>
  );
}
