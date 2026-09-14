"use client";

import { useEffect, useState } from "react";
import { Globe, KeyRound, Mail, Phone, User, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/admin/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { customerService } from "@/services/erp";
import type { Customer } from "@/types/erp";
import { isValidMobile } from "@/utils/phone";

interface PosCreateOnlineAccountModalProps {
  open: boolean;
  onClose: () => void;
  customer?: Customer | null;
  draftName?: string;
  draftMobile?: string;
  onAccountCreated: (customer: Customer) => void;
}

export function PosCreateOnlineAccountModal({
  open,
  onClose,
  customer,
  draftName = "",
  draftMobile = "",
  onAccountCreated,
}: PosCreateOnlineAccountModalProps) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      const initialName = customer?.name ?? draftName ?? "";
      const initialMobile = customer?.mobile ?? draftMobile ?? "";
      setName(initialName === "Customer" ? "" : initialName);
      setMobile(initialMobile);
      setEmail(customer?.email ?? "");
      // Default suggested password: Store<Last4Digits>!
      const lastDigits = initialMobile.replace(/\D/g, "").slice(-4) || "2026";
      setPassword(`Store${lastDigits}!`);
    }
  }, [open, customer, draftName, draftMobile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.trim();
    const cleanName = name.trim() || "Customer";
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Please enter a valid customer email address");
      return;
    }
    if (!isValidMobile(cleanMobile)) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }
    if (cleanPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);
    try {
      let targetCustomerId = customer?.id;

      // If customer doesn't exist yet in the database, create them first
      if (!targetCustomerId) {
        const resolved = await customerService.resolveForPos({
          mobile: cleanMobile,
          name: cleanName,
        });
        if (!resolved?.id) {
          throw new Error("Could not register customer profile");
        }
        targetCustomerId = resolved.id;
      }

      const updatedCustomer = await customerService.createOnlineAccountForCustomer(
        targetCustomerId,
        cleanEmail,
        cleanPassword
      );

      toast.success(
        `Online store account created! Login: ${cleanEmail}`,
        {
          description: `Customer can now log in at the online store. Their walk-in and online orders are unified.`,
          duration: 6000,
        }
      );

      onAccountCreated(updatedCustomer);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create online account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Online Store Account"
      size="md"
    >
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-800">
          <div className="flex items-start gap-2">
            <Globe className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-950">Unified In-Store & Online Account</p>
              <p className="mt-0.5 text-emerald-800">
                This enables the customer to log into the web shop, place orders online, and view their in-store receipts and loyalty points.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
              Customer Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
              Mobile Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="10-digit mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
            Online Store Login Email <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9 font-mono"
              required
            />
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            Share this password with the customer. They can change it after logging in.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5"
          >
            <CheckCircle2 className="h-4 w-4" />
            Create Online Account
          </Button>
        </div>
      </form>
    </Modal>
  );
}
