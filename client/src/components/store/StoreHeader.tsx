import React from 'react';
import { Store, MapPin, Clock, Star, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface StoreHeaderProps {
  store: {
    name: string;
    handle: string;
    bio?: string;
    logo_url?: string;
    banner_url?: string;
    location?: string;
    rating?: number;
    review_count?: number;
    hours?: string;
    published?: boolean;
  };
  isOwner?: boolean;
  onEdit?: () => void;
}

export const StoreHeader: React.FC<StoreHeaderProps> = ({ store, isOwner, onEdit }) => {
  return (
    <div className="w-full">
      {/* Banner */}
      <div className="relative h-48 md:h-64 bg-gradient-to-r from-orange-400 to-red-500 overflow-hidden">
        {store.banner_url ? (
          <img src={store.banner_url} alt="Store banner" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Store size={64} className="text-white opacity-50" />
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

      {/* Store Info */}
      <div className="max-w-6xl mx-auto px-4 -mt-12 relative z-10">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-start gap-4">
            {/* Logo */}
            <div className="w-24 h-24 rounded-lg bg-gray-200 flex-shrink-0 overflow-hidden border-4 border-white shadow">
              {store.logo_url ? (
                <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Store size={32} className="text-gray-400" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold">{store.name}</h1>
                  <p className="text-gray-600">@{store.handle}</p>
                </div>
                {!store.published && isOwner && (
                  <Badge variant="secondary">Unpublished</Badge>
                )}
              </div>

              {store.bio && (
                <p className="text-gray-700 mt-3">{store.bio}</p>
              )}

              <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
                {store.location && (
                  <div className="flex items-center gap-1">
                    <MapPin size={16} />
                    <span>{store.location}</span>
                  </div>
                )}
                {store.hours && (
                  <div className="flex items-center gap-1">
                    <Clock size={16} />
                    <span>{store.hours}</span>
                  </div>
                )}
                {store.rating && (
                  <div className="flex items-center gap-1">
                    <Star size={16} className="fill-yellow-400 text-yellow-400" />
                    <span>{store.rating.toFixed(1)} ({store.review_count} reviews)</span>
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
