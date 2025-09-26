import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";

type Params = { params?: Record<string, string> };

export default function SmoothiesPage({ params }: Params) {
  const type = params?.type?.replaceAll("-", " ");
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">
          Smoothies {type ? <span className="text-muted-foreground">• {type}</span> : null}
        </h1>
      </div>
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">
            Starter page for smoothies. Choose a sub-type from the menu (Fruit, Green, High-fiber), or wire this page to your data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
