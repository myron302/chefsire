import { Store } from "lucide-react";

export default function StoreDashboardLoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Store className="mx-auto w-12 h-12 text-orange-400 animate-pulse mb-3" />
        <p className="text-gray-500">Loading your store...</p>
      </div>
    </div>
  );
}
