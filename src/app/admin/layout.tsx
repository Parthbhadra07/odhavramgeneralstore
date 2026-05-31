import { AdminShell } from "@/components/admin/admin-shell";

export const metadata = { title: "Admin Panel" };

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full max-w-[100vw] overflow-x-hidden">
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
