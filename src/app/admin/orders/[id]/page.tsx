"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Save, Printer } from "lucide-react";
import { orderService } from "@/services/order.service";
import { productService } from "@/services/product.service";
import { ThermalReceipt, printThermalReceipt } from "@/components/orders/thermal-receipt";
import { OrderTimeline } from "@/features/orders/order-timeline";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  FREE_DELIVERY_MIN,
  STANDARD_DELIVERY_CHARGE,
} from "@/lib/constants";
import { formatPrice, formatDate } from "@/utils/format";
import {
  calculateDeliveryCharge,
  orderItemsSubtotal,
  resolveDeliveryCharge,
} from "@/utils/order-pricing";
import { Button } from "@/components/ui/button";
import type { Order, Product, OrderStatus } from "@/types/database";

interface EditableItem {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<OrderStatus>("received");
  const [note, setNote] = useState("");
  const [printWidth, setPrintWidth] = useState<"58mm" | "80mm">("80mm");
  const [saving, setSaving] = useState(false);
  const [addProductId, setAddProductId] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState(0);

  const load = () => {
    if (!id) return;
    orderService.getById(id).then((o) => {
      if (o) {
        setOrder(o);
        setStatus(o.order_status);
        const mapped = (o.order_items ?? []).map((i) => ({
          id: i.id,
          productId: i.product_id,
          productName: i.products?.name ?? "Item",
          quantity: i.quantity,
          price: i.price,
        }));
        setItems(mapped);
        const sub = orderItemsSubtotal(mapped);
        setDeliveryCharge(
          resolveDeliveryCharge(sub, o.total_amount, o.delivery_charge)
        );
      }
    });
  };

  useEffect(() => {
    load();
    productService.getAll().then(setProducts);
  }, [id]);

  const subtotal = orderItemsSubtotal(items);
  const grandTotal = subtotal + deliveryCharge;

  const mapItems = () =>
    items.map((i) => ({
      id: i.id,
      productId: i.productId,
      quantity: i.quantity,
      price: i.price,
    }));

  const orderErrorMessage = (err: unknown) =>
    err instanceof Error ? err.message : "Failed to update order";

  const updateStatus = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await orderService.updateOrderTotals({
        orderId: id,
        totalAmount: grandTotal,
        deliveryCharge,
      });
      await orderService.updateStatus(id, status, note);
      toast.success("Order updated");
      load();
    } catch (err: unknown) {
      toast.error(orderErrorMessage(err), { duration: 6000 });
      console.error("Update order status:", err);
    } finally {
      setSaving(false);
    }
  };

  const cancelOrder = async () => {
    if (!id || !confirm("Cancel this order?")) return;
    try {
      await orderService.updateStatus(id, "cancelled", "Cancelled by admin");
      toast.success("Order cancelled");
      load();
    } catch (err: unknown) {
      toast.error(orderErrorMessage(err), { duration: 6000 });
    }
  };

  const saveItems = async () => {
    if (!id) return;
    if (items.length === 0) {
      toast.error("Order must have at least one item");
      return;
    }
    setSaving(true);
    try {
      await orderService.updateOrder({
        orderId: id,
        totalAmount: grandTotal,
        deliveryCharge,
        items: mapItems(),
      });
      toast.success("Order items saved");
      load();
    } catch (err: unknown) {
      toast.error(orderErrorMessage(err), { duration: 6000 });
      console.error("Save order items:", err);
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    const p = products.find((x) => x.id === addProductId);
    if (!p) return;
    setItems((prev) => [
      ...prev,
      {
        productId: p.id,
        productName: p.name,
        quantity: 1,
        price: p.price,
      },
    ]);
    setAddProductId("");
  };

  if (!order) return <p>Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-all text-xl font-bold font-mono sm:text-2xl">
            {order.order_number}
          </h1>
          <p className="text-sm text-gray-600">{formatDate(order.created_at)}</p>
        </div>
        <OrderStatusBadge status={order.order_status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold">Customer</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd>{order.customer_name ?? order.users?.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Mobile</dt>
              <dd>{order.customer_phone ?? order.users?.phone ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Payment</dt>
              <dd>
                {PAYMENT_METHOD_LABELS[order.payment_method ?? "cod"]}
              </dd>
            </div>
          </dl>
          {order.addresses && (
            <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-medium">Address</p>
              <p>{order.addresses.address_line}</p>
              <p>
                {order.addresses.city}, {order.addresses.state} -{" "}
                {order.addresses.postal_code}
              </p>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold">Confirm Order</h2>
          <div className="mb-4 space-y-2 rounded-lg bg-gray-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-600">Delivery charge</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">₹</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={deliveryCharge}
                  onChange={(e) =>
                    setDeliveryCharge(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-20 rounded border px-2 py-1 text-right font-medium"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Free delivery on orders above {formatPrice(FREE_DELIVERY_MIN)} ·
              standard {formatPrice(STANDARD_DELIVERY_CHARGE)}
            </p>
            <button
              type="button"
              onClick={() => setDeliveryCharge(calculateDeliveryCharge(subtotal))}
              className="text-xs font-medium text-green-700 hover:underline"
            >
              Apply standard delivery ({formatPrice(calculateDeliveryCharge(subtotal))})
            </button>
            <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
              <span>Grand total</span>
              <span className="text-green-800">{formatPrice(grandTotal)}</span>
            </div>
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as OrderStatus)}
            className="mb-3 w-full rounded-lg border px-3 py-2 text-sm"
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="mb-3 w-full rounded-lg border px-3 py-2 text-sm"
            rows={2}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={updateStatus} loading={saving} className="w-full sm:w-auto">
              Update Status
            </Button>
            <Button variant="danger" onClick={cancelOrder} className="w-full sm:w-auto">
              Cancel Order
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold">Tracking</h2>
        <OrderTimeline
          currentStatus={order.order_status}
          history={order.tracking_history}
        />
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Order Items</h2>
          <Button size="sm" loading={saving} onClick={saveItems} className="w-full sm:w-auto">
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="mb-4 w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Item</th>
              <th className="py-2">Qty</th>
              <th className="py-2">Price</th>
              <th className="py-2">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b">
                <td className="py-2">{item.productName}</td>
                <td className="py-2">
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, quantity: Number(e.target.value) } : x
                        )
                      )
                    }
                    className="w-16 rounded border px-2 py-1"
                  />
                </td>
                <td className="py-2">
                  <input
                    type="number"
                    min={0}
                    value={item.price}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, price: Number(e.target.value) } : x
                        )
                      )
                    }
                    className="w-20 rounded border px-2 py-1"
                  />
                </td>
                <td className="py-2">{formatPrice(item.price * item.quantity)}</td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <select
            value={addProductId}
            onChange={(e) => setAddProductId(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Add product...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatPrice(p.price)}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        <div className="mt-4 space-y-1 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Delivery</span>
            <span>
              {deliveryCharge === 0 ? "FREE" : formatPrice(deliveryCharge)}
            </span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Grand total</span>
            <span>{formatPrice(grandTotal)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Thermal Bill</h2>
          <div className="flex gap-2">
            <select
              value={printWidth}
              onChange={(e) => setPrintWidth(e.target.value as "58mm" | "80mm")}
              className="rounded border px-2 py-1 text-sm"
            >
              <option value="58mm">58mm</option>
              <option value="80mm">80mm</option>
            </select>
            <Button
              variant="outline"
              onClick={() => {
                orderService.getById(order.id).then((o) => o && printThermalReceipt(printWidth));
              }}
            >
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </div>
        <ThermalReceipt
          order={{
            ...order,
            order_items: order.order_items,
            total_amount: grandTotal,
            delivery_charge: deliveryCharge,
          }}
          width={printWidth}
        />
      </div>

      <Button variant="ghost" onClick={() => router.push("/admin/orders")}>
        ← Back to Orders
      </Button>
    </div>
  );
}
