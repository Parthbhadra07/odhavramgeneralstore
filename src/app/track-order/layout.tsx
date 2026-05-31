import { Suspense } from "react";

export default function TrackOrderLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="py-16 text-center">Loading...</div>}>{children}</Suspense>;
}
