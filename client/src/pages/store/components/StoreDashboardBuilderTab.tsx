import { Edit } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type StoreDashboardBuilderTabProps = {
  onOpenBuilder: () => void;
};

export default function StoreDashboardBuilderTab({ onOpenBuilder }: StoreDashboardBuilderTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Store Builder</CardTitle>
        <CardDescription>Drag and drop elements to customise your storefront layout</CardDescription>
      </CardHeader>
      <CardContent className="text-center py-10">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Edit className="w-8 h-8 text-orange-500" />
        </div>
        <h3 className="font-semibold text-lg mb-2">Launch the Visual Editor</h3>
        <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
          Build your store layout with drag-and-drop containers, banners, text blocks, and product cards.
        </p>
        <Button className="bg-orange-500 hover:bg-orange-600" onClick={onOpenBuilder}>
          <Edit className="w-4 h-4 mr-2" />
          Open Store Builder
        </Button>
      </CardContent>
    </Card>
  );
}
