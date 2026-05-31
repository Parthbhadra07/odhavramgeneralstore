"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { addressService } from "@/services/address.service";
import { CheckoutForm } from "@/components/checkout-form";
import { Button } from "@/components/ui/button";
import type { Address } from "@/types/database";
import type { AddressInput } from "@/lib/validators";
import { Trash2 } from "lucide-react";

export default function AddressesPage() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    if (user) addressService.getByUser(user.id).then(setAddresses);
  };

  useEffect(() => { load(); }, [user]);

  const handleCreate = async (data: AddressInput) => {
    if (!user) return;
    await addressService.create(user.id, data);
    setShowForm(false);
    load();
    toast.success("Address added");
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await addressService.remove(id, user.id);
    load();
    toast.success("Address removed");
  };

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Saved Addresses</h1>
        <Button variant="outline" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Address"}
        </Button>
      </div>
      {showForm && (
        <div className="mb-6 max-w-md">
          <CheckoutForm onSubmit={handleCreate} />
        </div>
      )}
      <div className="space-y-3">
        {addresses.map((addr) => (
          <div
            key={addr.id}
            className="flex items-start justify-between rounded-lg border p-4"
          >
            <div>
              {addr.is_default && (
                <span className="mb-1 inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                  Default
                </span>
              )}
              <p>{addr.address_line}</p>
              <p className="text-sm text-gray-600">
                {addr.city}, {addr.state} - {addr.postal_code}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(addr.id)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
