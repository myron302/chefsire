import { Plus, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

type StoreDashboardEmptyStateProps = {
  onCreateStore: () => void;
};

export default function StoreDashboardEmptyState({ onCreateStore }: StoreDashboardEmptyStateProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-4">
        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Store className="w-10 h-10 text-orange-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">No Store Yet</h1>
        <p className="text-gray-500 mb-6">
          Create your storefront to start selling your products to the ChefSire community.
        </p>
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={onCreateStore}>
          <Plus className="mr-2 w-4 h-4" />
          Create Your Store
        </Button>
      </div>
    </div>
  );
}
