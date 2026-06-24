/** True when running inside a Capacitor native WebView */
export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor?.isNativePlatform?.()
  );
}

export function isCapacitorBuild(): boolean {
  return process.env.NEXT_PUBLIC_CAPACITOR === "1";
}
