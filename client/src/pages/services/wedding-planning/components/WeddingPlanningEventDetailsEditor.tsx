import type { RefObject } from "react";
import { ChefHat, Heart, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface WeddingPlanningEventDetailsEditorProps {
  isPremium: boolean;
  isEditingEventDetails: boolean;
  onSaveEventDetails: () => void;
  onStartEditing: () => void;
  partner1Name: string;
  setPartner1Name: (value: string) => void;
  partner2Name: string;
  setPartner2Name: (value: string) => void;
  selectedDate: string;
  setSelectedDate: (value: string) => void;
  weddingTime: string;
  setWeddingTime: (value: string) => void;
  weddingLocation: string;
  setWeddingLocation: (value: string) => void;
  receptionDate: string;
  setReceptionDate: (value: string) => void;
  receptionTime: string;
  setReceptionTime: (value: string) => void;
  receptionLocation: string;
  setReceptionLocation: (value: string) => void;
  customMessage: string;
  setCustomMessage: (value: string) => void;
  useSameLocation: boolean;
  setUseSameLocation: (value: boolean) => void;
  ceremonyRef: RefObject<HTMLInputElement>;
  receptionRef: RefObject<HTMLInputElement>;
}

export function WeddingPlanningEventDetailsEditor({
  isPremium,
  isEditingEventDetails,
  onSaveEventDetails,
  onStartEditing,
  partner1Name,
  setPartner1Name,
  partner2Name,
  setPartner2Name,
  selectedDate,
  setSelectedDate,
  weddingTime,
  setWeddingTime,
  weddingLocation,
  setWeddingLocation,
  receptionDate,
  setReceptionDate,
  receptionTime,
  setReceptionTime,
  receptionLocation,
  setReceptionLocation,
  customMessage,
  setCustomMessage,
  useSameLocation,
  setUseSameLocation,
  ceremonyRef,
  receptionRef,
}: WeddingPlanningEventDetailsEditorProps) {
  const isReadOnly = !isPremium || !isEditingEventDetails;

  return (
    <div className="mb-6 p-4 bg-muted rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-rose-600 to-pink-500 flex items-center justify-center shadow-sm">
            <Heart className="w-4 h-4 text-white" />
          </div>
          Wedding Details
        </h4>

        {isPremium &&
          (isEditingEventDetails ? (
            <Button size="sm" onClick={onSaveEventDetails}>
              Save
            </Button>
          ) : (
            <Button size="sm" onClick={onStartEditing}>
              Edit
            </Button>
          ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <Input
          placeholder="Partner 1 Name (e.g., Sarah)"
          value={partner1Name}
          onChange={(e) => setPartner1Name(e.target.value)}
          className="text-sm"
          disabled={isReadOnly}
        />
        <Input
          placeholder="Partner 2 Name (e.g., John)"
          value={partner2Name}
          onChange={(e) => setPartner2Name(e.target.value)}
          className="text-sm"
          disabled={isReadOnly}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <Input
          type="date"
          placeholder="Wedding Date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="text-sm"
          disabled={isReadOnly}
        />
        <Input
          type="time"
          placeholder="Wedding Time"
          value={weddingTime}
          onChange={(e) => setWeddingTime(e.target.value)}
          className="text-sm"
          disabled={isReadOnly}
        />
      </div>

      <div className="space-y-2 mb-3">
        <label className="text-sm font-medium flex items-center gap-2">
          <MapPin className="w-4 h-4 text-pink-500" /> Ceremony Location
        </label>
        <Input
          ref={ceremonyRef}
          placeholder="Search for ceremony venue..."
          value={weddingLocation}
          onChange={(e) => {
            setWeddingLocation(e.target.value);
            if (useSameLocation) setReceptionLocation(e.target.value);
          }}
          className="text-sm"
          disabled={isReadOnly}
        />
      </div>

      <div className="flex items-center space-x-2 py-2 mb-3">
        <input
          type="checkbox"
          id="sync-location"
          checked={useSameLocation}
          onChange={(e) => {
            setUseSameLocation(e.target.checked);
            if (e.target.checked) setReceptionLocation(weddingLocation);
          }}
          className="h-4 w-4 rounded border-gray-300 text-pink-600 focus:ring-pink-500"
          disabled={isReadOnly}
        />
        <label htmlFor="sync-location" className="text-sm text-muted-foreground cursor-pointer">
          Reception is at the same location
        </label>
      </div>

      {!useSameLocation && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <h5 className="font-medium text-sm mb-2 mt-2">Reception Details (Optional)</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              type="date"
              placeholder="Reception Date"
              value={receptionDate}
              onChange={(e) => setReceptionDate(e.target.value)}
              className="text-sm"
              disabled={isReadOnly}
            />
            <Input
              type="time"
              placeholder="Reception Time"
              value={receptionTime}
              onChange={(e) => setReceptionTime(e.target.value)}
              className="text-sm"
              disabled={isReadOnly}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-purple-500" /> Reception Location
            </label>
            <Input
              ref={receptionRef}
              placeholder="Search for reception venue..."
              value={receptionLocation}
              onChange={(e) => setReceptionLocation(e.target.value)}
              className="text-sm"
              disabled={isReadOnly}
            />
          </div>
        </div>
      )}

      <Textarea
        placeholder="Custom message for your guests..."
        value={customMessage}
        onChange={(e) => setCustomMessage(e.target.value)}
        className="w-full p-3 text-sm border rounded-md resize-none"
        rows={3}
        disabled={isReadOnly}
      />
    </div>
  );
}
