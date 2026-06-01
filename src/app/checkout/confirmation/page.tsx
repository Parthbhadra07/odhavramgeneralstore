"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const order = searchParams.get("order");

  return (
    <div className="container mx-auto flex flex-col items-center px-4 py-16 text-center">
      <CheckCircle className="mb-4 h-16 w-16 text-green-600" />
      <h1 className="text-3xl font-bold text-gray-900">Order Confirmed!</h1>
      <p className="mt-2 max-w-md text-gray-600">
        Thank you for your order. We&apos;re preparing your fresh groceries for delivery.
      </p>
      {order && (
        <p className="mt-4 rounded-lg bg-green-50 px-4 py-2 font-mono text-sm text-green-800">
          Order ID: {order}
        </p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Button href={order ? `/dashboard/orders/view?id=${order}` : "/dashboard/orders"}>
          Track Order
        </Button>
        <Button variant="outline" href="/products">
          Continue Shopping
        </Button>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center">Loading...</p>}>
      <ConfirmationContent />
    </Suspense>
  );
}
