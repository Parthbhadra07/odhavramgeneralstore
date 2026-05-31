import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <WifiOff className="mb-4 h-16 w-16 text-gray-400" />
      <h1 className="text-2xl font-bold">You&apos;re Offline</h1>
      <p className="mt-2 text-gray-600">
        Please check your internet connection and try again.
      </p>
      <Button href="/" className="mt-6">
        Go Home
      </Button>
    </div>
  );
}
