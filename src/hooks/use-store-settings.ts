"use client";

import { useEffect, useState } from "react";
import { settingsService } from "@/services/erp/settings.service";
import type { StoreSettings } from "@/types/erp";

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    settingsService
      .get()
      .then(setSettings)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return { settings, loading, reload: load };
}
