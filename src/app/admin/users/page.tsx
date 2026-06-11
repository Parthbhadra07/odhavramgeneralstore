"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminService } from "@/services/admin.service";
import { formatDate } from "@/utils/format";
import { Badge } from "@/components/ui/badge";
import { ERP_ROLES } from "@/lib/erp/constants";
import type { User, UserRole } from "@/types/database";

const ROLE_LABELS: Record<UserRole, string> = {
  customer: "Customer",
  admin: "Admin",
  super_admin: "Super Admin",
  staff: "Store Staff",
  cashier: "Cashier",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    adminService.getUsers().then(setUsers);
  }, []);

  const changeRole = async (user: User, role: UserRole) => {
    await adminService.updateUserRole(user.id, role);
    toast.success(`Role updated to ${ROLE_LABELS[role]}`);
    adminService.getUsers().then(setUsers);
  };

  return (
    <div>
      <h1 className="admin-page-title mb-1">Users & Roles</h1>
      <p className="mb-6 text-sm text-gray-600">Manage role-based access for staff</p>
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
                    onChange={(e) => changeRole(user, e.target.value as UserRole)}
                    className="rounded-lg border px-2 py-1 text-sm"
                  >
                    <option value="customer">Customer</option>
                    {ERP_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r as UserRole] ?? r}
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
