"use client";

import { useEffect, useState } from "react";

/** True after client hydration — use to avoid SSR/localStorage mismatches */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
