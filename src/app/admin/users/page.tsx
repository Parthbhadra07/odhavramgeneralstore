"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminService } from "@/services/admin.service";
import { formatDate } from "@/utils/format";
import { Badge } from "@/components/ui/badge";
import type { User } from "@/types/database";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    adminService.getUsers().then(setUsers);
  }, []);

  const toggleRole = async (user: User) => {
    const newRole = user.role === "admin" ? "customer" : "admin";
    await adminService.updateUserRole(user.id, newRole);
    toast.success(`Role updated to ${newRole}`);
    adminService.getUsers().then(setUsers);
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Users</h1>
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Joined</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b">
                <td className="px-4 py-3">{user.name || "—"}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">
                  <Badge variant={user.role === "admin" ? "info" : "default"}>
                    {user.role}
                  </Badge>
                </td>
                <td className="px-4 py-3">{formatDate(user.created_at)}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleRole(user)}
                    className="text-sm text-green-700 hover:underline"
                  >
                    Toggle Role
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
