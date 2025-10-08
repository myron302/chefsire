import * as React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChefHat } from "lucide-react";

export default function StartCookoffButton({ className = "" }: { className?: string }) {
  return (
    <Link href="/competitions/new">
      <Button className={className}>
        <ChefHat className="mr-2 h-4 w-4" />
        Start a Cookoff
      </Button>
    </Link>
  );
}
