import { Suspense } from "react";

export default function SuccessLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="py-16 text-center">Loading...</div>}>{children}</Suspense>;
}
