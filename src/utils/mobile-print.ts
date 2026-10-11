/**
 * Mobile-compatible print utility.
 * Mobile browsers (iOS Safari, Chrome on Android, etc.) do NOT support printing from hidden iframes
 * or popup windows (window.open without an address), which fail silently or get blocked.
 * This helper mounts the content directly into the top-level document with scoped @media print styles,
 * and calls window.print() on the main window to open the native mobile print sheet (AirPrint / Android Print).
 */

export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isSmallScreen = window.innerWidth <= 820;
  const isTouch = Boolean(navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  return isMobileUa || (isSmallScreen && isTouch);
}

export function executeMobilePrint(
  contentHtml: string,
  extraStyles = "",
  title = "Document"
): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  const containerId = "mobile-print-host-container";
  const styleId = "mobile-print-host-style";

  // Cleanup any existing host elements
  document.getElementById(containerId)?.remove();
  document.getElementById(styleId)?.remove();

  const prevTitle = document.title;
  if (title) {
    document.title = title;
  }

  // Create isolated container
  const container = document.createElement("div");
  container.id = containerId;
  container.className = "mobile-print-host-container";
  container.innerHTML = contentHtml;

  // Add print styles hiding everything except the print host container
  const styleEl = document.createElement("style");
  styleEl.id = styleId;
  styleEl.textContent = `
    @media screen {
      #${containerId} {
        display: none !important;
        visibility: hidden !important;
        position: absolute !important;
        left: -9999px !important;
        top: -9999px !important;
      }
    }
    @media print {
      html, body {
        background: #fff !important;
        color: #000 !important;
        margin: 0 !important;
        padding: 0 !important;
        height: auto !important;
        overflow: visible !important;
      }
      body > *:not(#${containerId}) {
        display: none !important;
        visibility: hidden !important;
      }
      #${containerId} {
        display: block !important;
        visibility: visible !important;
        position: static !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        color: #000 !important;
      }
      ${extraStyles}
    }
  `;

  document.head.appendChild(styleEl);
  document.body.appendChild(container);

  const cleanup = () => {
    container.remove();
    styleEl.remove();
    document.title = prevTitle;
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup, { once: true });

  try {
    window.focus();
    requestAnimationFrame(() => {
      // Trigger native print dialog
      window.print();
    });
  } catch (err) {
    console.warn("Mobile print failed, running cleanup:", err);
    cleanup();
    return false;
  }

  // Safety fallback cleanup in case afterprint does not fire (certain Android WebViews)
  setTimeout(cleanup, 4000);
  return true;
}
