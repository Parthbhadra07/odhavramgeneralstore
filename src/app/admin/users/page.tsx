"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  UserPlus,
  Pencil,
  Trash2,
  Search,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
  Phone,
  Mail,
  Lock,
  X,
  AlertTriangle,
} from "lucide-react";
import { adminService } from "@/services/admin.service";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/utils/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/admin/modal";
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
  const { user: authUser, profile, isSuperAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Super Admin action states
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Add user form state
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "customer" as UserRole,
    password: "",
  });

  // Edit user form state
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "customer" as UserRole,
  });

  const loadUsers = () => {
    setLoadingUsers(true);
    adminService
      .getUsers()
      .then(setUsers)
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Could not load users");
      })
      .finally(() => setLoadingUsers(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const changeRole = async (target: User, role: UserRole) => {
    if (role === target.role) return;
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can change user roles");
      return;
    }
    if (authUser?.id === target.id && role !== "super_admin") {
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

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can create users");
      return;
    }
    if (!addForm.name.trim() || !addForm.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (addForm.password && addForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSubmitting(true);
    try {
      const newUser = await adminService.createUser({
        name: addForm.name.trim(),
        email: addForm.email.trim(),
        phone: addForm.phone.trim() || undefined,
        role: addForm.role,
        password: addForm.password.trim() || undefined,
      });
      toast.success(`User ${newUser.name || newUser.email} created successfully`);
      setShowAddModal(false);
      setAddForm({
        name: "",
        email: "",
        phone: "",
        role: "customer",
        password: "",
      });
      loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (target: User) => {
    setEditTarget(target);
    setEditForm({
      name: target.name || "",
      email: target.email || "",
      phone: target.phone || "",
      role: target.role,
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can edit users");
      return;
    }

    setSubmitting(true);
    try {
      await adminService.updateUserDetails(editTarget.id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || null,
        email: editForm.email.trim() || undefined,
        role: editForm.role,
      });
      toast.success(`User updated successfully`);
      setEditTarget(null);
      loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can delete users");
      return;
    }
    if (authUser?.id === deleteTarget.id) {
      toast.error("You cannot delete your own account");
      return;
    }

    setSubmitting(true);
    try {
      await adminService.deleteUser(deleteTarget.id);
      toast.success(`User ${deleteTarget.name || deleteTarget.email} deleted`);
      setDeleteTarget(null);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    const matchQuery =
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q);
    const matchRole =
      selectedRoleFilter === "all" || u.role === selectedRoleFilter;
    return matchQuery && matchRole;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="admin-page-title">Users &amp; Roles</h1>
          <p className="mt-1 text-sm text-gray-600">
            System accounts, staff permissions, and customer profiles
          </p>
        </div>
        {isSuperAdmin && (
          <Button
            onClick={() => setShowAddModal(true)}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
        )}
      </div>

      {/* Role Notice */}
      {!authLoading && !isSuperAdmin && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm shadow-sm">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-semibold">View-Only Access</p>
            <p className="text-xs text-amber-800">
              You are signed in as <strong>{profile?.role ?? "Admin"}</strong>. You can view all entries, but only <strong>Super Admin</strong> can create users, edit user profiles, change roles, or delete accounts.
            </p>
          </div>
        </div>
      )}

      {isSuperAdmin && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50/60 p-3 text-green-900 text-xs">
          <ShieldCheck className="h-4 w-4 text-green-700 shrink-0" />
          <span>
            Signed in as <strong>Super Admin</strong>. You have full access to add, edit, change roles, and delete user accounts.
          </span>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[260px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm shadow-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Role:</span>
          <select
            value={selectedRoleFilter}
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-green-600 focus:outline-none"
          >
            <option value="all">All Roles ({users.length})</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label} ({users.filter((u) => u.role === r.value).length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">User</th>
              <th className="px-4 py-3 text-left font-semibold">Contact</th>
              <th className="px-4 py-3 text-left font-semibold">Role</th>
              <th className="px-4 py-3 text-left font-semibold">Joined</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loadingUsers ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">
                  Loading users...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">
                  No users found matching your search.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-800 font-bold text-xs">
                        {(u.name || u.email || "U").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 leading-tight">
                          {u.name || "—"}
                        </p>
                        {u.role === "customer" && (
                          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            Online Customer
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span className="truncate max-w-[180px]">{u.email}</span>
                      </div>
                      {u.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span>{u.phone}</span>
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <Badge variant={u.role !== "customer" ? "info" : "default"}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </Badge>
                  </td>

                  <td className="px-4 py-3 text-xs text-gray-500">
                    {formatDate(u.created_at)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isSuperAdmin ? (
                        <>
                          {/* Quick Role Select */}
                          <select
                            value={u.role}
                            disabled={
                              authLoading ||
                              savingId === u.id ||
                              authUser?.id === u.id
                            }
                            onChange={(e) => changeRole(u, e.target.value as UserRole)}
                            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs shadow-sm hover:border-gray-400 focus:outline-none disabled:bg-gray-100"
                            title="Quick change role"
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="rounded p-1.5 text-gray-600 hover:bg-gray-100 hover:text-blue-700 transition-colors"
                            title="Edit user details"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            disabled={authUser?.id === u.id}
                            onClick={() => setDeleteTarget(u)}
                            className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                            title={
                              authUser?.id === u.id
                                ? "Cannot delete your own account"
                                : "Delete user"
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 italic">View only</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New User"
        size="md"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="e.g. Ramesh Patel"
            value={addForm.name}
            onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            required
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="user@example.com"
            value={addForm.email}
            onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
            required
          />

          <Input
            label="Mobile Number (10 digits)"
            type="tel"
            placeholder="e.g. 9876543210"
            value={addForm.phone}
            onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              value={addForm.role}
              onChange={(e) =>
                setAddForm({ ...addForm, role: e.target.value as UserRole })
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-green-600 focus:outline-none"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Login Password"
            type="password"
            placeholder="Minimum 6 characters (e.g. Store123456!)"
            value={addForm.password}
            onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
            required
          />

          <div className="mt-6 flex justify-end gap-3 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              Create User
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={`Edit User — ${editTarget?.name || editTarget?.email || ""}`}
        size="md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Full Name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            required
          />

          <Input
            label="Email Address"
            type="email"
            value={editForm.email}
            disabled
            className="bg-gray-100 cursor-not-allowed"
          />

          <Input
            label="Mobile Number (10 digits)"
            type="tel"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              value={editForm.role}
              disabled={authUser?.id === editTarget?.id}
              onChange={(e) =>
                setEditForm({ ...editForm, role: e.target.value as UserRole })
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-green-600 focus:outline-none disabled:bg-gray-100"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {authUser?.id === editTarget?.id && (
              <p className="mt-1 text-xs text-gray-500">
                You cannot change your own super admin role.
              </p>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete User Confirmation Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Confirm User Deletion"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-900 text-sm">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <p>
              Are you sure you want to delete user{" "}
              <strong>{deleteTarget?.name || deleteTarget?.email}</strong>?
            </p>
          </div>

          <p className="text-xs text-gray-600 leading-relaxed">
            This will permanently remove their login credentials. Any past order history, sales bills, and credit ledger entries will remain preserved in the system with an unlinked profile.
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={submitting}
              onClick={handleDeleteConfirm}
            >
              Delete User
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

