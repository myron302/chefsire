import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  marketplaceCategories,
  marketplaceDeliveryMethods,
  MarketplaceFilters,
  marketplaceSortOptions,
} from "../lib/marketplaceFilters";

interface MarketplaceFiltersPanelProps {
  filters: MarketplaceFilters;
  totalCount: number;
  onCategoryChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onDeliveryMethodChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onClearFilters: () => void;
}

export function MarketplaceFiltersPanel({
  filters,
  totalCount,
  onCategoryChange,
  onLocationChange,
  onDeliveryMethodChange,
  onSortChange,
  onClearFilters,
}: MarketplaceFiltersPanelProps) {
  return (
    <div className="border-t pt-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <Select value={filters.category} onValueChange={onCategoryChange}>
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {marketplaceCategories.map((category) => (
              <SelectItem key={category.value} value={category.value}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Location..."
          value={filters.location}
          onChange={(event) => onLocationChange(event.target.value)}
        />

        <Select value={filters.deliveryMethod} onValueChange={onDeliveryMethodChange}>
          <SelectTrigger>
            <SelectValue placeholder="Delivery" />
          </SelectTrigger>
          <SelectContent>
            {marketplaceDeliveryMethods.map((method) => (
              <SelectItem key={method.value} value={method.value}>
                {method.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.sortBy} onValueChange={onSortChange}>
          <SelectTrigger>
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {marketplaceSortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-between items-center">
        <Button variant="ghost" onClick={onClearFilters}>
          Clear Filters
        </Button>
        <span className="text-sm text-gray-500">{totalCount} products found</span>
      </div>
    </div>
  );
}
