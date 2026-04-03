import { RefObject } from "react";

import { Calendar, Calendar as CalendarIcon, MapPin, Sparkles, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { VENDORS, VENDOR_CATEGORIES, vendorIconTone } from "@/pages/services/lib/wedding-planning-core";

interface WeddingPlanningVendorFiltersProps {
  selectedDate: string;
  onSelectedDateChange: (value: string) => void;
  guestCount: number;
  onGuestCountChange: (value: number) => void;
  searchLocation: string;
  onSearchLocationChange: (value: string) => void;
  vendorLocationRef: RefObject<HTMLInputElement>;
  selectedVendorType: string;
  onSelectedVendorTypeChange: (value: string) => void;
  filteredVendorCount: number;
}

export function WeddingPlanningVendorFilters({
  selectedDate,
  onSelectedDateChange,
  guestCount,
  onGuestCountChange,
  searchLocation,
  onSearchLocationChange,
  vendorLocationRef,
  selectedVendorType,
  onSelectedVendorTypeChange,
  filteredVendorCount,
}: WeddingPlanningVendorFiltersProps) {
  return (
    <>
      <Card className="mb-6">
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-sm">
                  <CalendarIcon className="h-4 w-4 text-white" />
                </div>
                <label className="text-xs md:text-sm font-medium block">Event Date</label>
              </div>
              <Input type="date" value={selectedDate} onChange={(e) => onSelectedDateChange(e.target.value)} className="w-full" />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-sm">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <label className="text-xs md:text-sm font-medium block">Guest Count</label>
              </div>
              <Input type="number" value={guestCount} onChange={(e) => onGuestCountChange(parseInt(e.target.value || "0", 10))} className="w-full" />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-sm">
                  <MapPin className="h-4 w-4 text-white" />
                </div>
                <label className="text-xs md:text-sm font-medium block">Location</label>
              </div>
              <Input
                ref={vendorLocationRef}
                placeholder="City, State (e.g., New York, NY)"
                value={searchLocation}
                onChange={(e) => onSearchLocationChange(e.target.value)}
                className="w-full"
              />
              <p className="mt-1 text-[10px] md:text-xs text-muted-foreground">
                Start typing any city/state in the US — this is no longer limited to a single state.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-pink-600 to-rose-500 flex items-center justify-center shadow-sm">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <label className="text-xs md:text-sm font-medium block">Style</label>
              </div>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Wedding style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">Classic & Elegant</SelectItem>
                  <SelectItem value="rustic">Rustic & Barn</SelectItem>
                  <SelectItem value="modern">Modern & Chic</SelectItem>
                  <SelectItem value="beach">Beach & Outdoor</SelectItem>
                  <SelectItem value="vintage">Vintage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
        {VENDOR_CATEGORIES.map((category) => {
          const Icon = category.icon as any;
          const isSelected = selectedVendorType === category.value;
          const count = category.value === "all" ? VENDORS.length : VENDORS.filter((v) => v.type === category.value).length;

          return (
            <Button
              key={category.value}
              variant={isSelected ? "default" : "outline"}
              onClick={() => onSelectedVendorTypeChange(category.value)}
              className="w-full flex items-center justify-center sm:justify-between px-2"
              size="sm"
            >
              <div className="flex items-center gap-1 min-w-0">
                <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? "text-white" : vendorIconTone(category.value)}`} />
                <span className="text-xs sm:text-sm hidden sm:inline truncate">{category.label}</span>
              </div>
              <Badge variant="secondary" className="text-xs hidden sm:flex flex-shrink-0">
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <h2 className="text-lg md:text-xl font-semibold">{filteredVendorCount} Vendors Available</h2>
          {selectedDate && (
            <Badge variant="secondary" className="w-fit">
              <Calendar className="w-3 h-3 mr-1 text-blue-600" />
              <span className="text-xs">
                {new Date(selectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select defaultValue="featured">
            <SelectTrigger className="w-full sm:w-40 text-xs md:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">Featured</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
              <SelectItem value="availability">Available First</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  );
}
