import { format } from "date-fns";
import { POS_PAYMENT_LABELS } from "@/lib/erp/constants";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type StoreOrderStatus,
} from "@/lib/constants";
import { orderItemsSubtotal, resolveDeliveryCharge } from "@/utils/order-pricing";
import { getOrderAddress } from "@/utils/order-address";
import type { Order } from "@/types/database";
import type { PosSale, ReceiptData } from "@/types/erp";

export function receiptFromPosSale(sale: PosSale): ReceiptData {
  const created = new Date(sale.created_at);
  const items = (sale.pos_sale_items ?? []).map((i) => ({
    name: i.product_name,
    quantity: i.quantity,
    rate: Number(i.rate),
    amount: Number(i.total_amount),
  }));

  return {
    orderId: sale.bill_number,
    date: format(created, "dd/MM/yyyy"),
    time: format(created, "hh:mm a"),
    customerName: sale.customer_name,
    customerMobile: sale.customer_mobile,
    paymentMethod:
      POS_PAYMENT_LABELS[sale.payment_method as keyof typeof POS_PAYMENT_LABELS] ??
      sale.payment_method,
    showUpiQr: true,
    creditDue: sale.payment_method === "credit" ? Number(sale.total_amount) : undefined,
    orderStatus: sale.sale_status,
    items,
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount) + Number(sale.loyalty_discount ?? 0),
    taxCgst: Number(sale.cgst),
    taxSgst: Number(sale.sgst),
    taxIgst: Number(sale.igst),
    grandTotal: Number(sale.total_amount),
    notes: sale.notes,
  };
}

export function receiptFromOrder(order: Order): ReceiptData {
  const created = new Date(order.created_at);
  const items = (order.order_items ?? []).map((i) => ({
    name: i.products?.name ?? "Item",
    quantity: i.quantity,
    rate: Number(i.price),
    amount: Number(i.price) * i.quantity,
  }));
  const subtotal = orderItemsSubtotal(order.order_items ?? []);
  const delivery = resolveDeliveryCharge(
    subtotal,
    order.total_amount,
    order.delivery_charge
  );
  const addr = getOrderAddress(order);
  const deliveryAddress = addr
    ? `${addr.address_line}, ${addr.city}, ${addr.state} - ${addr.postal_code}`
    : null;

  return {
    orderId: order.order_number ?? order.id.slice(0, 8),
    date: format(created, "dd/MM/yyyy"),
    time: format(created, "hh:mm a"),
    customerName: order.customer_name ?? order.users?.name,
    customerMobile: order.customer_phone ?? order.users?.phone,
    deliveryAddress,
    paymentMethod:
      PAYMENT_METHOD_LABELS[order.payment_method ?? "cod"] ??
      order.payment_method ??
      "—",
    showUpiQr: order.payment_method === "qr",
    orderStatus:
      ORDER_STATUS_LABELS[order.order_status as StoreOrderStatus] ??
      order.order_status,
    items,
    subtotal,
    deliveryCharge: delivery,
    grandTotal: Number(order.total_amount),
    notes: order.tracking_notes,
  };
}
