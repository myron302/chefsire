import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function WeddingSubscriptionStatus({ loading, error, onRetry }: {
  loading: boolean;
  error?: string;
  onRetry: () => void;
}) {
  if (loading) return <p role="status" className="mb-4 text-sm text-muted-foreground">Loading your Wedding Planner plan…</p>;
  if (!error) return null;
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <AlertDescription>
        {error}
        <Button type="button" variant="outline" className="ml-3" onClick={onRetry}>
          Retry loading plan
        </Button>
      </AlertDescription>
    </Alert>
  );
}
