"use client";

import type { ReceiptData, StoreSettings } from "@/types/erp";
import { formatPrice } from "@/utils/format";
import { settingsService } from "@/services/erp/settings.service";
import { UpiQr } from "@/components/erp/upi-qr";
import {
  cloneReceiptHtml,
  getReceiptDimensions,
  getReceiptPrintOptions,
  getReceiptPrintStyles,
  type ReceiptWidth,
} from "@/utils/receipt-styles";
import { PRINT_FONT_CSS, PRINT_DENSITY_WEIGHT } from "@/utils/print-style-shared";
import {
  isBluetoothPrinterConnected,
  printElementToBluetooth,
} from "@/utils/bluetooth-printer";

interface ReceiptPrintProps {
  data: ReceiptData;
  settings?: StoreSettings | null;
  width?: ReceiptWidth;
  id?: string;
}

function shouldShowUpiQr(data: ReceiptData, settings: StoreSettings): boolean {
  if (!settings.enable_upi_qr || !settings.upi_id || data.grandTotal <= 0) {
    return false;
  }
  if (data.showUpiQr === false) return false;
  const method = data.paymentMethod.toLowerCase();
  if (method.includes("cod") || method.includes("cash on delivery")) return false;
  return true;
}

function wrapName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  const words = name.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length <= maxLen) {
      current = (current + " " + w).trim();
    } else {
      if (current) lines.push(current);
      current = w.length > maxLen ? w.slice(0, maxLen) : w;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

export function ReceiptPrint({
  data,
  settings: settingsProp,
  width = "80mm",
  id = "thermal-receipt",
}: ReceiptPrintProps) {
  const settings = settingsProp ?? {
    ...settingsService.getDefaults(),
    id: "default",
    created_at: "",
    updated_at: "",
  };

  const printOpts = getReceiptPrintOptions(width);
  const dim = getReceiptDimensions(width, printOpts);
  const fontFamily = PRINT_FONT_CSS[printOpts.fontFamily];
  const fontWeight = PRINT_DENSITY_WEIGHT[printOpts.printDensity];
  const showUpiQr = shouldShowUpiQr(data, settings);
  const upiPayAmount = data.upiAmount ?? data.creditDue ?? data.grandTotal;
  const upiUrl = showUpiQr
    ? settingsService.buildUpiUrl(settings, upiPayAmount)
    : null;
  const showGstNote =
    data.gstIncluded ||
    Boolean(settings.gst_number) ||
    (data.taxCgst ?? 0) > 0 ||
    (data.taxSgst ?? 0) > 0 ||
    (data.taxIgst ?? 0) > 0;

  return (
    <div
      id={id}
      className="receipt-container receipt-container-border"
      style={{
        width: dim.width,
        maxWidth: dim.width,
        minWidth: dim.width,
        fontFamily,
        fontSize: dim.fontSize,
        fontWeight,
        lineHeight: 1.4,
        background: "#fff",
        color: "#000",
        boxSizing: "border-box",
      }}
    >
      {/* Store header */}
      <div style={{ paddingBottom: 8, textAlign: "center" }}>
        {settings.store_logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={settings.store_logo_url}
            alt=""
            className="receipt-logo"
            style={{
              display: "block",
              margin: "0 auto 8px",
              maxHeight: 48,
              width: "auto",
              objectFit: "contain",
            }}
          />
        )}
        <p
          style={{
            fontWeight: 700,
            textTransform: "uppercase",
            lineHeight: 1.2,
            letterSpacing: "0.05em",
            fontSize: dim.storeTitleSize,
            margin: 0,
          }}
        >
          {settings.store_name}
        </p>
        <p style={{ margin: "4px 0 0" }}>Mobile: {settings.store_mobile}</p>
        {settings.store_address && (
          <p style={{ margin: "4px 0 0", fontSize: "0.85em", lineHeight: 1.3 }}>
            {settings.store_address}
          </p>
        )}
      </div>

      <div className="receipt-line-solid" />

      {/* Order ID */}
      <div style={{ padding: "4px 0", textAlign: "center", fontSize: "0.95em" }}>
        <p style={{ fontWeight: 700, margin: 0 }}>Order ID: {data.orderId}</p>
        <p style={{ fontSize: "0.9em", margin: "2px 0 0" }}>
          {data.date} · {data.time}
        </p>
        {data.cashierName && (
          <p style={{ fontSize: "0.9em", margin: "2px 0 0" }}>
            Cashier: {data.cashierName}
          </p>
        )}
      </div>

      <div className="receipt-line" />

      {/* Customer box */}
      {(data.customerName || data.customerMobile || data.deliveryAddress) && (
        <>
          <p className="receipt-section-title">Customer Information</p>
          <div className="receipt-line" />
          <div style={{ padding: "4px 0", fontSize: "0.95em" }}>
            {data.customerName && (
              <p style={{ margin: "2px 0" }}>
                <span style={{ fontWeight: 600 }}>Name:</span> {data.customerName}
              </p>
            )}
            {data.customerMobile && (
              <p style={{ margin: "2px 0" }}>
                <span style={{ fontWeight: 600 }}>Mobile:</span> {data.customerMobile}
              </p>
            )}
            {data.deliveryAddress && (
              <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                <span style={{ fontWeight: 600 }}>Address:</span> {data.deliveryAddress}
              </p>
            )}
          </div>
          <div className="receipt-line" />
        </>
      )}

      {/* Items */}
      <p className="receipt-section-title">Items</p>
      <div className="receipt-line" />

      <table className="receipt-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Amt</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => (
            <tr key={i}>
              <td style={{ whiteSpace: "pre-wrap" }}>
                {wrapName(item.name, dim.nameMaxLen)}
              </td>
              <td>{item.quantity}</td>
              <td>{formatPrice(item.rate)}</td>
              <td>{formatPrice(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="receipt-line" />

      {/* Totals */}
      <div style={{ padding: "4px 0", fontSize: "0.95em" }}>
        <div className="receipt-row">
          <span>Subtotal</span>
          <span>{formatPrice(data.subtotal)}</span>
        </div>
        {data.deliveryCharge !== undefined && (
          <div className="receipt-row">
            <span>Delivery</span>
            <span>{formatPrice(data.deliveryCharge)}</span>
          </div>
        )}
        {data.discount !== undefined && data.discount > 0 && (
          <div
            className="receipt-row"
            style={{
              fontWeight: 700,
              padding: "2px 0",
            }}
          >
            <span>
              DISCOUNT
              {data.discountPercent ? ` (${data.discountPercent}%)` : ""}
            </span>
            <span>- {formatPrice(data.discount)}</span>
          </div>
        )}
        {showGstNote && (
          <p style={{ margin: "4px 0 0", fontSize: "0.85em", fontStyle: "italic" }}>
            (Inclusive of GST)
          </p>
        )}
        <p style={{ margin: "4px 0 0", fontSize: "0.85em" }}>
          Payment: {data.paymentMethod}
          {data.orderStatus ? ` · ${data.orderStatus}` : ""}
        </p>
        {(data.creditDue ?? 0) > 0 && (
          <p style={{ margin: "4px 0 0", fontWeight: 600, fontSize: "0.85em" }}>
            Credit This Bill: {formatPrice(data.creditDue!)}
          </p>
        )}
        {data.creditBalance !== undefined && data.creditBalance > 0 && (
          <p style={{ fontSize: "0.85em", margin: "2px 0 0" }}>
            Total Credit Due: {formatPrice(data.creditBalance)}
          </p>
        )}
      </div>

      <div className="receipt-line-solid" />

      <div
        className="receipt-row"
        style={{
          padding: "4px 0",
          fontWeight: 700,
          fontSize: dim.grandTotalSize,
        }}
      >
        <span>GRAND TOTAL</span>
        <span>{formatPrice(data.grandTotal)}</span>
      </div>

      {data.discount !== undefined && data.discount > 0 && (
        <>
          <div
            style={{
              margin: "5px 0",
              padding: "4px 6px",
              textAlign: "center",
              fontWeight: 800,
              fontSize: "0.95em",
              border: "1.5px dashed #000",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            ★ TOTAL SAVINGS: {formatPrice(data.discount)} ★
          </div>
        </>
      )}

      <div className="receipt-line-solid" />

      {data.deliveryOtp && (
        <>
          <div style={{ padding: "8px 4px", textAlign: "center" }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95em" }}>
              Delivery OTP
            </p>
            <p
              style={{
                margin: "6px 0 4px",
                fontWeight: 700,
                fontSize: dim.grandTotalSize,
                letterSpacing: "0.28em",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              {data.deliveryOtp}
            </p>
            <p style={{ margin: 0, fontSize: "0.8em", lineHeight: 1.3 }}>
              Share this code only with our delivery person when the order arrives.
            </p>
          </div>
          <div className="receipt-line-solid" />
        </>
      )}

      {/* UPI QR */}
      {showUpiQr && upiUrl && (
        <>
          <div style={{ padding: "8px 0", textAlign: "center" }}>
            <p style={{ margin: "0 0 4px", fontSize: "0.9em", fontWeight: 600 }}>
              Scan to Pay via UPI
            </p>
            <p style={{ margin: "0 0 4px", fontSize: "0.85em" }}>
              Amount: {formatPrice(upiPayAmount)}
            </p>
            <div className="receipt-qr-wrap">
              <UpiQr upiUrl={upiUrl} size={dim.qrSize} />
            </div>
            {settings.upi_id && (
              <p style={{ margin: "4px 0 0", fontSize: "0.8em" }}>{settings.upi_id}</p>
            )}
            {settings.upi_merchant_name && (
              <p style={{ margin: "4px 0 0", fontSize: "0.85em" }}>
                {settings.upi_merchant_name}
              </p>
            )}
          </div>
          <div className="receipt-line" />
        </>
      )}

      {/* Footer */}
      <div style={{ paddingTop: 8, textAlign: "center", fontSize: "0.95em" }}>
        <p style={{ fontWeight: 600, margin: 0 }}>
          {settings.receipt_header_text ?? "Thank You! Visit Again"}
        </p>
        <p style={{ margin: "8px 0 0", fontWeight: 700, textTransform: "uppercase" }}>
          {settings.store_name}
        </p>
        {settings.receipt_footer_text && (
          <p style={{ margin: "4px 0 0", fontSize: "0.85em" }}>
            {settings.receipt_footer_text}
          </p>
        )}
      </div>

      <div className="receipt-line-solid" />
    </div>
  );
}

export { getReceiptPrintStyles } from "@/utils/receipt-styles";

function buildPrintDocument(receiptHtml: string, width: ReceiptWidth, title = "Receipt") {
  const opts = getReceiptPrintOptions(width);
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>${getReceiptPrintStyles(width, opts)}</style>
  </head>
  <body>${receiptHtml}</body>
</html>`;
}

/** Direct thermal print — Bluetooth ESC/POS when connected, otherwise browser dialog. */
export function printReceipt(
  elementId = "thermal-receipt",
  width: ReceiptWidth = "80mm"
) {
  if (isBluetoothPrinterConnected()) {
    void printElementToBluetooth(elementId).catch((err) => {
      console.warn("Bluetooth print failed, using system print", err);
      printReceiptBrowser(elementId, width);
    });
    return true;
  }
  return printReceiptBrowser(elementId, width);
}

function printReceiptBrowser(
  elementId: string,
  width: ReceiptWidth
) {
  const receipt = document.getElementById(elementId);
  if (!receipt) return false;

  const receiptHtml = cloneReceiptHtml(receipt);
  const html = buildPrintDocument(receiptHtml, width);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = `position:fixed;left:0;top:0;width:${width};height:100vh;border:0;opacity:0;pointer-events:none;z-index:-1;`;
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = iframe.contentDocument ?? frameWindow?.document;
  if (!frameDoc || !frameWindow) {
    document.body.removeChild(iframe);
    return printReceiptPopup(elementId, width);
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  const doPrint = () => {
    frameWindow.focus();
    frameWindow.print();
    setTimeout(cleanup, 1000);
  };

  if (frameDoc.readyState === "complete") {
    requestAnimationFrame(doPrint);
  } else {
    iframe.onload = doPrint;
  }

  return true;
}

/** Fallback when iframe print is blocked — still direct print, not PDF. */
function printReceiptPopup(elementId: string, width: ReceiptWidth) {
  const receipt = document.getElementById(elementId);
  if (!receipt) return false;

  const printWindow = window.open("", "_blank", "width=320,height=800");
  if (!printWindow) return false;

  printWindow.document.write(buildPrintDocument(cloneReceiptHtml(receipt), width));
  printWindow.document.close();
  printWindow.focus();

  const triggerPrint = () => {
    printWindow.print();
    printWindow.close();
  };

  if (printWindow.document.readyState === "complete") {
    requestAnimationFrame(triggerPrint);
  } else {
    printWindow.onload = triggerPrint;
  }

  return true;
}

export function downloadReceiptPdf(
  elementId = "thermal-receipt",
  width: ReceiptWidth = "80mm",
  filename = "receipt"
) {
  const receipt = document.getElementById(elementId);
  if (!receipt) return;

  const printWindow = window.open("", "_blank", "width=320,height=800");
  if (!printWindow) return;

  printWindow.document.write(
    buildPrintDocument(cloneReceiptHtml(receipt), width, filename)
  );
  printWindow.document.close();
  printWindow.document.title = filename;
  printWindow.focus();
  printWindow.print();
}
