import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-green-700">404</h1>
      <p className="mt-2 text-xl text-gray-600">Page not found</p>
      <Button href="/" className="mt-6">
        Back to Home
      </Button>
    </div>
  );
}
