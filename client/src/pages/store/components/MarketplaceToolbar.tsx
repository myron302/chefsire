import React from "react";
import { Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MarketplaceToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onToggleFilters: () => void;
}

export function MarketplaceToolbar({
  searchValue,
  onSearchChange,
  onSubmit,
  onToggleFilters,
}: MarketplaceToolbarProps) {
  return (
    <form onSubmit={onSubmit} className="flex gap-4 mb-4">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
        <Input
          placeholder="Search products, chefs, or stores..."
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-10"
        />
      </div>
      <Button type="submit">Search</Button>
      <Button type="button" variant="outline" onClick={onToggleFilters}>
        <Filter className="w-4 h-4 mr-2" />
        Filters
      </Button>
    </form>
  );
}
