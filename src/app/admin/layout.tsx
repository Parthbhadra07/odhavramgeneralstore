import { AdminShell } from "@/components/admin/admin-shell";
import { AdminGuard } from "@/components/admin/admin-guard";

export const metadata = { title: "Admin Panel" };

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh w-full max-w-[100vw] overflow-x-hidden">
      <AdminGuard>
        <AdminShell>{children}</AdminShell>
      </AdminGuard>
    </div>
  );
}
