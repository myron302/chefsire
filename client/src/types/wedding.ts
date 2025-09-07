export interface Vendor {
  id: string;
  businessName: string;
  category: 'caterer' | 'venue' | 'photographer' | 'dj' | 'florist' | 'planner';
  description: string;
  pricing: string;
  rating: number;
  reviewCount: number;
  images: string[];
  verified: boolean;
  featured: boolean;
  sponsored: boolean;
  availability: 'available' | 'limited' | 'booked';
  responseTime: string;
  amenities: string[];
  location: {
    city: string;
    state: string;
    serviceRadius: number;
  };
  contactInfo: {
    email: string;
    phone: string;
    website?: string;
  };
}

export interface WeddingEvent {
  id: string;
  userId: string;
  date: string;
  title: string;
  type: 'appointment' | 'payment' | 'task' | 'milestone';
  description?: string;
  reminder: boolean;
  vendorId?: string;
  completed: boolean;
}

export interface Registry {
  id: string;
  userId: string;
  registries: {
    name: string;
    url: string;
    icon: string;
  }[];
  publicUrl: string;
  viewCount: number;
}

export interface Lead {
  id: string;
  vendorId: string;
  coupleId: string;
  eventDate: string;
  guestCount: number;
  budget: string;
  message: string;
  status: 'new' | 'contacted' | 'quoted' | 'booked' | 'declined';
  createdAt: Date;
}
