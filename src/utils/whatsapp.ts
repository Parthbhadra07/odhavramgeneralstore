import { STORE_PHONE } from "@/lib/constants";

export function whatsAppShareUrl(message: string, phone = STORE_PHONE) {
  const text = encodeURIComponent(message);
  const num = phone.replace(/\D/g, "");
  return `https://wa.me/91${num}?text=${text}`;
}

export function orderConfirmationMessage(orderNumber: string, total: string) {
  return `Hello from Odhavram General Store!\n\nYour order ${orderNumber} has been received.\nTotal: ${total}\n\nThank you for shopping with us!`;
}

export function orderStatusMessage(
  orderNumber: string,
  status: string
) {
  return `Odhavram General Store — Order Update\n\nOrder: ${orderNumber}\nStatus: ${status}\n\nFor queries call 8160373047`;
}

export function invoiceShareMessage(billNumber: string, total: string) {
  return `Odhavram General Store\nBill: ${billNumber}\nAmount: ${total}\n\nThank you for your purchase!`;
}

export function openWhatsAppShare(message: string, phone?: string) {
  window.open(whatsAppShareUrl(message, phone), "_blank", "noopener,noreferrer");
}
