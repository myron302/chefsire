import { Card, CardContent } from "@/components/ui/card";
import { TestTube2 } from "lucide-react";

export default function RecipesTestPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <TestTube2 className="h-8 w-8 text-blue-500" />
            <h1 className="text-2xl font-bold text-gray-900">Recipes Test Page</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            This is the recipes test page. The route /recipes-test is now working!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}