import React from 'react';
import { Store, MapPin, Clock, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface StoreHeaderProps {
  store: {
    name: string;
    handle: string;
    bio?: string | null;
    logo_url?: string | null;
    banner_url?: string | null;
    location?: string | null;
    rating?: number | null;
    review_count?: number | null;
    hours?: string | null;
    published?: boolean;
  };
  isOwner?: boolean;
  onEdit?: () => void;
  themeColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export const StoreHeader: React.FC<StoreHeaderProps> = ({ store, isOwner, onEdit, themeColors }) => {
  const primary = themeColors?.primary ?? "#FF6B35";
  const secondary = themeColors?.secondary ?? "#2C3E50";

  return (
    <div className="w-full">
      {/* Banner */}
      <div
        className="relative h-48 md:h-64 overflow-hidden"
        style={
          store.banner_url
            ? undefined
            : { background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)` }
        }
      >
        {store.banner_url ? (
          <img src={store.banner_url} alt="Store banner" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Store size={64} className="text-white opacity-40" />
          </div>
        )}
        {isOwner && (
          <div className="absolute top-4 right-4">
            <Button onClick={onEdit} variant="secondary" size="sm">
              Edit Store
            </Button>
          </div>
        )}
      </div>

      {/* Store Info card */}
      <div className="max-w-6xl mx-auto px-4 -mt-12 relative z-10">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-start gap-4">
            {/* Logo */}
            <div className="w-24 h-24 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border-4 border-white shadow"
              style={!store.logo_url ? { backgroundColor: primary + "22" } : undefined}
            >
              {store.logo_url ? (
                <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Store size={32} style={{ color: primary }} />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-3xl font-bold" style={{ color: secondary }}>{store.name}</h1>
                  <p className="text-gray-500">@{store.handle}</p>
                </div>
                {!store.published && isOwner && (
                  <Badge variant="secondary">Unpublished</Badge>
                )}
              </div>

              {store.bio && (
                <p className="text-gray-700 mt-3 leading-relaxed">{store.bio}</p>
              )}

              <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
                {store.location && (
                  <div className="flex items-center gap-1">
                    <MapPin size={15} style={{ color: primary }} />
                    <span>{store.location}</span>
                  </div>
                )}
                {store.hours && (
                  <div className="flex items-center gap-1">
                    <Clock size={15} style={{ color: primary }} />
                    <span>{store.hours}</span>
                  </div>
                )}
                {store.rating != null && (
                  <div className="flex items-center gap-1">
                    <Star size={15} className="fill-yellow-400 text-yellow-400" />
                    <span>{parseFloat(String(store.rating)).toFixed(1)}
                      {store.review_count != null && ` (${store.review_count} reviews)`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreHeader;
