import {
  ADMIN_ROLES,
  CASHIER_ROLES,
  STAFF_ROLES,
  type ErpRole,
} from "@/lib/erp/constants";
import type { UserRole } from "@/types/database";

export function isErpStaff(role?: UserRole | string | null): boolean {
  return STAFF_ROLES.includes(role as ErpRole);
}

export function isErpAdmin(role?: UserRole | string | null): boolean {
  return ADMIN_ROLES.includes(role as ErpRole);
}

export function isSuperAdmin(role?: UserRole | string | null): boolean {
  return role === "super_admin";
}

export function canAccessPos(role?: UserRole | string | null): boolean {
  return CASHIER_ROLES.includes(role as ErpRole);
}

export function canManageInventory(role?: UserRole | string | null): boolean {
  return ["super_admin", "admin", "staff"].includes(role ?? "");
}

export function canManageAccounting(role?: UserRole | string | null): boolean {
  return isErpAdmin(role);
}
