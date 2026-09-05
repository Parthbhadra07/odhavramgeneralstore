"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminService } from "@/services/admin.service";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/utils/format";
import { Badge } from "@/components/ui/badge";
import type { User, UserRole } from "@/types/database";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "customer", label: "Customer" },
  { value: "cashier", label: "Cashier" },
  { value: "staff", label: "Store Staff" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

const ROLE_LABELS: Record<UserRole, string> = {
  customer: "Customer",
  admin: "Admin",
  super_admin: "Super Admin",
  staff: "Store Staff",
  cashier: "Cashier",
};

export default function AdminUsersPage() {
  const { user: authUser, profile, isSuperAdmin, isAdmin, loading: authLoading } =
    useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const canChangeRoles = isSuperAdmin || isAdmin;

  useEffect(() => {
    adminService.getUsers().then(setUsers).catch((err) => {
      toast.error(err instanceof Error ? err.message : "Could not load users");
    });
  }, []);

  const changeRole = async (target: User, role: UserRole) => {
    if (role === target.role) return;
    if (!canChangeRoles) {
      toast.error("Only admin or super admin can change user roles");
      return;
    }
    if (!isSuperAdmin && role === "super_admin") {
      toast.error("Only super admin can assign the Super Admin role");
      return;
    }
    if (!isSuperAdmin && target.role === "super_admin") {
      toast.error("Only super admin can change a Super Admin account");
      return;
    }
    if (authUser?.id === target.id && isSuperAdmin && role !== "super_admin") {
      toast.error("You cannot remove your own super admin role");
      return;
    }

    setSavingId(target.id);
    try {
      await adminService.updateUserRole(target.id, role);
      toast.success(`${target.name || target.email} is now ${ROLE_LABELS[role]}`);
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, role } : u))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role", {
        duration: 8000,
      });
    } finally {
      setSavingId(null);
    }
  };

  const roleOptionsFor = (target: User) =>
    ROLE_OPTIONS.filter((r) => {
      if (isSuperAdmin) return true;
      if (r.value === "super_admin") return target.role === "super_admin";
      return true;
    });

  return (
    <div>
      <h1 className="admin-page-title mb-1">Users & Roles</h1>
      <p className="mb-6 text-sm text-gray-600">
        Signed in as{" "}
        <strong>{ROLE_LABELS[(profile?.role as UserRole) ?? "customer"] ?? profile?.role}</strong>
        . Super admin can assign any role. Admin can assign Cashier, Staff, Admin, or
        Customer.
      </p>
      {!authLoading && !canChangeRoles && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You can view users, but only admin or super admin can change roles.
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Name</th>
              <th className="px-4 py-3 text-left font-semibold">Email</th>
              <th className="px-4 py-3 text-left font-semibold">Role</th>
              <th className="px-4 py-3 text-left font-semibold">Joined</th>
              <th className="px-4 py-3 text-left font-semibold">Change Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">{user.name || "—"}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">
                  <Badge variant={user.role !== "customer" ? "info" : "default"}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </Badge>
                </td>
                <td className="px-4 py-3">{formatDate(user.created_at)}</td>
                <td className="px-4 py-3">
                  <select
                    value={user.role}
                    disabled={
                      authLoading ||
                      !canChangeRoles ||
                      savingId === user.id ||
                      (!isSuperAdmin && user.role === "super_admin")
                    }
                    onChange={(e) => changeRole(user, e.target.value as UserRole)}
                    className="rounded-lg border px-2 py-1 text-sm disabled:cursor-not-allowed disabled:bg-gray-100"
                  >
                    {roleOptionsFor(user).map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
