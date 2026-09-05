"use client";

import { ShieldCheck } from "lucide-react";
import {
  getOrderDeliveryOtp,
  shouldShowCustomerDeliveryOtp,
} from "@/utils/delivery-otp";
import type { Order } from "@/types/database";

export function CustomerDeliveryOtp({ order }: { order: Order }) {
  const otp = getOrderDeliveryOtp(order);
  if (!shouldShowCustomerDeliveryOtp(order) || !otp) return null;

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4">
      <p className="mb-1 flex items-center gap-2 font-semibold text-green-900">
        <ShieldCheck className="h-5 w-5" />
        Delivery verification code
      </p>
      <p className="text-sm text-green-800">
        This code is also printed on your receipt. Share it only with our delivery
        person when the order arrives.
      </p>
      <p className="mt-3 font-mono text-3xl font-bold tracking-[0.35em] text-green-900">
        {otp}
      </p>
    </div>
  );
}
