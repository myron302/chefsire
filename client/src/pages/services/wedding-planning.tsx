import { useState, useMemo, memo, useCallback, useEffect, useRef } from 'react';
import {
  Calendar, MapPin, Users, DollarSign, Clock, Heart,
  ChefHat, Camera, Music, Flower, Sparkles, Star,
  Filter, Search, ArrowRight, Check, Info, Phone,
  Mail, Instagram, Globe, ChevronDown, TrendingUp,
  Award, Shield, Bookmark, Share2, MessageCircle,
  Gift, Calendar as CalendarIcon, Link2, Plus, X, BellRing,
  AlertCircle, Zap, Lock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import WeddingTrialSelector from '@/components/WeddingTrialSelector';
import { couplePlans } from '@/config/wedding-pricing';

// =========================================================
// STATIC DATA - Moved outside component for performance
// =========================================================

const VENDORS = [
  {
    id: 1,
    type: 'caterer',
    name: 'Bella Vista Catering',
    rating: 4.9,
    reviews: 127,
    priceRange: '$$$',
    image: 'https://images.unsplash.com/photo-1555244162-803834f70033',
    specialty: 'Farm-to-Table',
    verified: true,
    featured: true,
    sponsored: true,
    availability: 'Available',
    minGuests: 50,
    maxGuests: 500,
    description: 'Award-winning catering with locally sourced ingredients',
    amenities: ['Tastings', 'Custom Menus', 'Dietary Options', 'Bar Service'],
    responseTime: '2 hours',
    viewsToday: 23
  },
  {
    id: 2,
    type: 'venue',
    name: 'The Grand Ballroom',
    rating: 4.8,
    reviews: 89,
    priceRange: '$$$$',
    image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3',
    capacity: '50-300',
    verified: true,
    featured: false,
    availability: 'Limited',
    description: 'Elegant historic venue with stunning architecture',
    amenities: ['In-House Catering', 'Parking', 'Bridal Suite', 'Dance Floor'],
    responseTime: '24 hours'
  },
  {
    id: 3,
    type: 'photographer',
    name: 'Moments Photography',
    rating: 5.0,
    reviews: 203,
    priceRange: '$$$',
    image: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b',
    style: 'Documentary',
    verified: true,
    featured: false,
    availability: 'Available',
    description: 'Capturing authentic moments with artistic flair',
    packages: ['6 hours', '8 hours', 'Full day'],
    responseTime: '1 hour'
  },
  {
    id: 4,
    type: 'dj',
    name: 'Elite Entertainment DJ',
    rating: 4.7,
    reviews: 156,
    priceRange: '$$',
    image: 'https://images.unsplash.com/photo-1493676304819-0d7a8d026dcf',
    specialty: 'All Genres',
    verified: false,
    featured: false,
    availability: 'Available',
    description: 'Professional DJ services with premium sound systems',
    amenities: ['MC Services', 'Lighting', 'Dance Floor', 'Wireless Mics'],
    responseTime: '3 hours'
  }
];

const VENDOR_CATEGORIES = [
  { value: 'all', label: 'All', icon: Sparkles },
  { value: 'caterer', label: 'Catering', icon: ChefHat },
  { value: 'venue', label: 'Venues', icon: MapPin },
  { value: 'photographer', label: 'Photo', icon: Camera },
  { value: 'dj', label: 'DJ & Music', icon: Music },
  { value: 'florist', label: 'Florist', icon: Flower },
  { value: 'planner', label: 'Planner', icon: Heart }
];

// =========================================================
// MEMOIZED VENDOR CARD - Prevents re-renders on scroll
// =========================================================
interface VendorCardProps {
  vendor: typeof VENDORS[0];
  isSaved: boolean;
  isQuoteRequested: boolean;
  onToggleSave: (id: number) => void;
  onRequestQuote: (id: number) => void;
}

const VendorCard = memo(
  ({ vendor, isSaved, isQuoteRequested, onToggleSave, onRequestQuote }: VendorCardProps) => {
    return (
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <div className="relative">
          <img
            src={vendor.image}
            alt={vendor.name}
            className="w-full h-40 md:h-48 object-cover"
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            style={{ contentVisibility: 'auto' }}
          />
          {vendor.sponsored && (
            <Badge className="absolute top-2 left-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-xs">
              <TrendingUp className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Sponsored</span>
            </Badge>
          )}
          {vendor.featured && !vendor.sponsored && (
            <Badge className="absolute top-2 left-2 bg-gradient-to-r from-pink-600 to-purple-600 text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Featured</span>
            </Badge>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="absolute top-2 right-2 rounded-full p-1.5 md:p-2"
            onClick={() => onToggleSave(vendor.id)}
          >
            <Bookmark className={`w-3 h-3 md:w-4 md:h-4 ${isSaved ? 'fill-current' : ''}`} />
          </Button>
          <Badge
            className={`absolute bottom-2 left-2 text-xs ${
              (vendor as any).availability === 'Available'
                ? 'bg-green-500'
                : (vendor as any).availability === 'Limited'
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
          >
            {(vendor as any).availability}
          </Badge>
        </div>

        <CardContent className="p-3 md:p-4">
          <div className="mb-2">
            <h3 className="font-semibold text-base md:text-lg flex items-center gap-1">
              {vendor.name}
              {(vendor as any).verified && (
                <Shield className="w-3 h-3 md:w-4 md:h-4 text-blue-500" />
              )}
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
              {(vendor as any).description}
            </p>
          </div>

          <div className="flex items-center gap-3 md:gap-4 mb-2 md:mb-3">
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 md:w-4 md:h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-semibold text-sm md:text-base">{vendor.rating}</span>
              <span className="text-xs md:text-sm text-muted-foreground">
                ({vendor.reviews})
              </span>
            </div>
            <span className="text-xs md:text-sm font-medium">{vendor.priceRange}</span>
          </div>

          {(vendor as any).amenities && (
            <div className="flex flex-wrap gap-1 mb-2 md:mb-3">
              {(vendor as any).amenities.slice(0, 3).map((amenity: string) => (
                <Badge key={amenity} variant="secondary" className="text-[10px] md:text-xs">
                  {amenity}
                </Badge>
              ))}
              {(vendor as any).amenities.length > 3 && (
                <Badge variant="secondary" className="text-[10px] md:text-xs">
                  +{(vendor as any).amenities.length - 3}
                </Badge>
              )}
            </div>
          )}

          {(vendor as any).viewsToday && (
            <Alert className="mb-2 md:mb-3 p-2">
              <AlertCircle className="h-3 w-3" />
              <AlertDescription className="text-[10px] md:text-xs">
                {(vendor as any).viewsToday} couples viewed today
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-3 border-t">
            <div className="flex items-center gap-1 text-[10px] md:text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span className="hidden sm:inline">
                Responds in {(vendor as any).responseTime}
              </span>
              <span className="sm:hidden">{(vendor as any).responseTime}</span>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              {isQuoteRequested ? (
                <Badge variant="secondary" className="text-[10px] md:text-xs">
                  Quote Requested
                </Badge>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRequestQuote(vendor.id)}
                    className="flex-1 sm:flex-none text-xs"
                  >
                    <span className="hidden sm:inline">Get Quote</span>
                    <span className="sm:hidden">Quote</span>
                  </Button>
                  <Link href="/catering/wedding-map" className="flex-1 sm:flex-none">
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-pink-600 to-purple-600 w-full text-xs"
                    >
                      <span className="hidden sm:inline">View Map</span>
                      <span className="sm:hidden">Map</span>
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  },
  // Custom comparison to prevent re-renders when unrelated vendors change
  (prevProps, nextProps) => {
    return (
      prevProps.vendor.id === nextProps.vendor.id &&
      prevProps.isSaved === nextProps.isSaved &&
      prevProps.isQuoteRequested === nextProps.isQuoteRequested
    );
  }
);

VendorCard.displayName = 'VendorCard';

export default function WeddingPlanning() {
  const { toast } = useToast();

  // Load Google Maps API
  const isGoogleMapsLoaded = useGoogleMaps();

  // Get user context and check subscription status
  const { user, updateUser } = useUser();
  const currentTier = user?.subscriptionTier || 'free';
  const isPremium = currentTier === 'premium' || currentTier === 'elite';
  const isElite = currentTier === 'elite';

  // =========================================================
  // ALL STATE DECLARATIONS - Must be declared BEFORE useEffects
  // =========================================================

  // Simulated dynamic savings data (replace with a real API call if needed)
  const dynamicSavings = 4200;

  const [selectedVendorType, setSelectedVendorType] = useState('all');
  const [budgetRange, setBudgetRange] = useState([5000, 50000]);
  const [guestCount, setGuestCount] = useState([100]);
  const [selectedDate, setSelectedDate] = useState('');
  const [savedVendors, setSavedVendors] = useState(new Set<number>());
  const [activeView, setActiveView] = useState('grid');
  const [showBudgetCalculator, setShowBudgetCalculator] = useState(false);
  const [showTrialBanner, setShowTrialBanner] = useState(() => {
    // Check if user has dismissed the banner before
    return localStorage.getItem('weddingTrialBannerDismissed') !== 'true';
  });
  const [requestedQuotes, setRequestedQuotes] = useState(new Set<number>());

  const [registryLinks, setRegistryLinks] = useState([
    { id: 1, name: 'Amazon', url: '', icon: '🎁' },
    { id: 2, name: 'Target', url: '', icon: '🎯' },
    { id: 3, name: 'Zola', url: '', icon: '💑' }
  ]);

  const [calendarEvents, setCalendarEvents] = useState<Array<{
    id: number;
    date: string;
    title: string;
    type: string;
    reminder: boolean;
  }>>([]);

  // Email Invitations State
  const [guestList, setGuestList] = useState<Array<{
    id: number | string;
    name: string;
    email: string;
    rsvp: string;
    plusOne: boolean;
  }>>([]);
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestEmail, setNewGuestEmail] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('elegant');

  // Wedding Event Details State
  const [partner1Name, setPartner1Name] = useState('');
  const [partner2Name, setPartner2Name] = useState('');
  const [weddingTime, setWeddingTime] = useState('');
  const [weddingLocation, setWeddingLocation] = useState('');
  const [receptionDate, setReceptionDate] = useState('');
  const [receptionTime, setReceptionTime] = useState('');
  const [receptionLocation, setReceptionLocation] = useState('');
  const [customMessage, setCustomMessage] = useState('We would be honored to have you celebrate with us!');
  const [useSameLocation, setUseSameLocation] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Refs for Google Places Autocomplete
  const ceremonyRef = useRef<HTMLInputElement>(null);
  const receptionRef = useRef<HTMLInputElement>(null);

  // Trial selector modal - only show once if user is on free tier
  const [showTrialSelector, setShowTrialSelector] = useState(() => {
    // Check if user already selected a tier
    const hasSelected = localStorage.getItem('weddingTierSelected');
    if (hasSelected) return false;

    // Check if user already has a subscription tier
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        if (userData.subscriptionTier === 'premium' || userData.subscriptionTier === 'elite') {
          // User already has a tier, don't show modal
          localStorage.setItem('weddingTierSelected', 'true');
          return false;
        }
      } catch (e) {
        console.error('[Wedding Planning] Failed to parse user from localStorage:', e);
      }
    }

    // User is on free tier and hasn't selected, show modal
    return true;
  });

  // Hide selector if user already has premium/elite tier (in case state updates after mount)
  useEffect(() => {
    if (currentTier === 'premium' || currentTier === 'elite') {
      setShowTrialSelector(false);
      localStorage.setItem('weddingTierSelected', 'true');
    }
  }, [currentTier]);

  // Load guest list from backend and localStorage on mount
  useEffect(() => {
    const fetchGuestList = async () => {
      if (!user?.id) return;

      try {
        // Load sent invitations from backend
        const response = await fetch('/api/wedding/guest-list', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.guests) {
            const sentGuests = data.guests.map((g: any) => ({
              id: g.id,
              name: g.name,
              email: g.email,
              rsvp: g.rsvp,
              plusOne: g.plusOne,
            }));

            // Also load unsent guests from localStorage
            const unsentGuestsKey = `wedding-unsent-guests-${user.id}`;
            const unsentGuests = JSON.parse(localStorage.getItem(unsentGuestsKey) || '[]');

            // Combine both lists (sent guests from DB + unsent from localStorage)
            setGuestList([...sentGuests, ...unsentGuests]);
          }
        } else {
          // If API fails, still load unsent guests from localStorage
          const unsentGuestsKey = `wedding-unsent-guests-${user.id}`;
          const unsentGuests = JSON.parse(localStorage.getItem(unsentGuestsKey) || '[]');
          setGuestList(unsentGuests);
        }
      } catch (error) {
        console.error('[Wedding Planning] Failed to fetch guest list:', error);
        // On error, still load unsent guests from localStorage
        const unsentGuestsKey = `wedding-unsent-guests-${user.id}`;
        const unsentGuests = JSON.parse(localStorage.getItem(unsentGuestsKey) || '[]');
        setGuestList(unsentGuests);
      }
    };

    fetchGuestList();
  }, [user?.id]);

  // Google Places Autocomplete initialization
  useEffect(() => {
    if (!isGoogleMapsLoaded || !window.google?.maps?.places) {
      return;
    }

    if (!isPremium) {
      return;
    }

    // Options for autocomplete - use 'establishment' for venues/businesses
    const options = {
      types: ['establishment'],
      fields: ['formatted_address', 'name', 'place_id']
    };

    // Ceremony Autocomplete
    if (ceremonyRef.current) {
      const ceremonyAutocomplete = new window.google.maps.places.Autocomplete(ceremonyRef.current, options);
      ceremonyAutocomplete.addListener('place_changed', () => {
        const place = ceremonyAutocomplete.getPlace();
        const addr = place.formatted_address || place.name || '';
        setWeddingLocation(addr);
        if (useSameLocation) setReceptionLocation(addr);
      });
    }

    // Reception Autocomplete
    if (receptionRef.current && !useSameLocation) {
      const receptionAutocomplete = new window.google.maps.places.Autocomplete(receptionRef.current, options);
      receptionAutocomplete.addListener('place_changed', () => {
        const place = receptionAutocomplete.getPlace();
        const addr = place.formatted_address || place.name || '';
        setReceptionLocation(addr);
      });
    }
  }, [isGoogleMapsLoaded, useSameLocation, isPremium]);

  const handleStartTrial = () => {
    // Wedding planning features are free - just dismiss the banner permanently
    setShowTrialBanner(false);
    localStorage.setItem('weddingTrialBannerDismissed', 'true');

    // Show confirmation toast
    toast({
      description: '🎉 All wedding planning features are completely free! Enjoy unlimited access.',
    });
  };

  // Memoized budget breakdown - only recalculates when budgetRange changes
  const budgetBreakdown = useMemo(
    () => [
      {
        category: 'Catering & Bar',
        percentage: 40,
        amount: budgetRange[1] * 0.4,
        icon: ChefHat
      },
      { category: 'Venue', percentage: 20, amount: budgetRange[1] * 0.2, icon: MapPin },
      {
        category: 'Photography',
        percentage: 12,
        amount: budgetRange[1] * 0.12,
        icon: Camera
      },
      {
        category: 'Music & Entertainment',
        percentage: 8,
        amount: budgetRange[1] * 0.08,
        icon: Music
      },
      {
        category: 'Flowers & Decor',
        percentage: 10,
        amount: budgetRange[1] * 0.1,
        icon: Flower
      },
      {
        category: 'Other',
        percentage: 10,
        amount: budgetRange[1] * 0.1,
        icon: Sparkles
      }
    ],
    [budgetRange]
  );

  // Memoized filtered vendors - only recalculates when filter changes
  const filteredVendors = useMemo(
    () =>
      selectedVendorType === 'all'
        ? VENDORS
        : VENDORS.filter((v) => v.type === selectedVendorType),
    [selectedVendorType]
  );

  // Memoized callbacks to prevent re-creating functions on every render
  const toggleSaveVendor = useCallback((vendorId: number) => {
    setSavedVendors((prev) => {
      const next = new Set(prev);
      next.has(vendorId) ? next.delete(vendorId) : next.add(vendorId);
      return next;
    });
  }, []);

  const requestQuote = useCallback((vendorId: number) => {
    setRequestedQuotes((prev) => new Set(prev).add(vendorId));
  }, []);

  // Email Invitation Handlers
  const addGuest = useCallback(async () => {
    if (newGuestName && newGuestEmail) {
      const tempGuest = {
        id: Date.now(),
        name: newGuestName,
        email: newGuestEmail,
        rsvp: 'pending',
        plusOne: false
      };

      // Update state
      setGuestList(prev => {
        const updated = [...prev, tempGuest];

        // Persist unsent guests to localStorage
        if (user?.id) {
          const unsentGuestsKey = `wedding-unsent-guests-${user.id}`;
          const unsentGuests = updated.filter(g => typeof g.id === 'number'); // temp IDs are numbers, DB IDs are strings
          localStorage.setItem(unsentGuestsKey, JSON.stringify(unsentGuests));
        }

        return updated;
      });

      setNewGuestName('');
      setNewGuestEmail('');

      toast({
        title: "Guest Added",
        description: `${newGuestName} has been added to your guest list.`,
      });
    }
  }, [newGuestName, newGuestEmail, user?.id, toast]);

  const removeGuest = useCallback(async (guestId: number | string) => {
    // Check if this is a sent guest (from database) or unsent guest (from localStorage)
    const guest = guestList.find(g => g.id === guestId);
    const isSentGuest = typeof guestId === 'string';

    // If it's a sent guest, delete from database
    if (isSentGuest && user?.id) {
      try {
        const response = await fetch(`/api/wedding/guest/${guestId}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          toast({
            title: "Error",
            description: "Failed to remove guest from database.",
            variant: "destructive",
          });
          return;
        }
      } catch (error) {
        console.error('Failed to delete guest:', error);
        toast({
          title: "Error",
          description: "Failed to remove guest. Please try again.",
          variant: "destructive",
        });
        return;
      }
    }

    // Update local state
    setGuestList(prev => {
      const updated = prev.filter(g => g.id !== guestId);

      // Update localStorage for unsent guests
      if (user?.id) {
        const unsentGuestsKey = `wedding-unsent-guests-${user.id}`;
        const unsentGuests = updated.filter(g => typeof g.id === 'number');
        localStorage.setItem(unsentGuestsKey, JSON.stringify(unsentGuests));
      }

      return updated;
    });

    toast({
      title: "Guest Removed",
      description: guest ? `${guest.name} has been removed from your guest list.` : "Guest removed successfully.",
    });
  }, [user?.id, guestList, toast]);

  const sendInvitations = useCallback(async () => {
    if (!isPremium) {
      toast({
        title: "Premium Feature",
        description: "Email invitations are a Premium feature. Upgrade to send beautiful wedding invitations!",
        variant: "destructive",
      });
      return;
    }

    if (guestList.length === 0) {
      toast({
        title: "No Guests",
        description: "Please add guests to your list before sending invitations.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/api/wedding/send-invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          guests: guestList.map(g => ({
            name: g.name,
            email: g.email,
            plusOne: g.plusOne
          })),
          eventDetails: {
            partner1Name: partner1Name || undefined,
            partner2Name: partner2Name || undefined,
            coupleName: partner1Name && partner2Name
              ? `${partner1Name} & ${partner2Name}`
              : (partner1Name || partner2Name || user?.displayName)
              ? `${partner1Name || partner2Name || user?.displayName}'s Wedding`
              : 'Our Wedding',
            eventDate: selectedDate && weddingTime
              ? `${selectedDate}T${weddingTime}`
              : selectedDate || undefined,
            eventLocation: weddingLocation || undefined,
            receptionDate: receptionDate && receptionTime
              ? `${receptionDate}T${receptionTime}`
              : receptionDate || undefined,
            receptionLocation: receptionLocation || undefined,
            useSameLocation: useSameLocation,
            hasReception: !!(receptionDate || receptionTime || receptionLocation),
            coupleEmail: user?.email || undefined,
            message: customMessage || 'We would be honored to have you celebrate with us!',
            template: selectedTemplate
          }
        })
      });

      const data = await response.json();

      if (data.ok) {
        // Clear unsent guests from localStorage since they're now saved to database
        if (user?.id) {
          const unsentGuestsKey = `wedding-unsent-guests-${user.id}`;
          localStorage.removeItem(unsentGuestsKey);
        }

        // Check if there were any errors
        if (data.errors && data.errors.length > 0) {
          const errorMessages = data.errors.map((err: any) =>
            `${err.email}: ${err.error}`
          ).join('\n');

          toast({
            title: data.sent > 0 ? "Partial Success" : "Failed to Send Invitations",
            description: `${data.sent} of ${data.total} invitations sent successfully.\n\nErrors:\n${errorMessages}`,
            variant: data.sent > 0 ? "default" : "destructive",
          });
        } else {
          toast({
            title: "Invitations Sent!",
            description: `${data.sent} of ${data.total} invitations sent successfully.`,
          });
        }

        // Refresh the guest list to show updated status from database
        const listResponse = await fetch('/api/wedding/guest-list', {
          credentials: 'include'
        });

        if (listResponse.ok) {
          const listData = await listResponse.json();
          if (listData.ok) {
            setGuestList(listData.guests.map((g: any) => ({
              id: g.id,
              name: g.name,
              email: g.email,
              rsvp: g.rsvp,
              plusOne: g.plusOne,
            })));
          }
        }
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to send invitations",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to send invitations:', error);
      toast({
        title: "Error",
        description: "Failed to send invitations. Please try again.",
        variant: "destructive",
      });
    }
  }, [isPremium, guestList, selectedDate, weddingTime, weddingLocation, receptionDate, receptionTime, receptionLocation, partner1Name, partner2Name, customMessage, selectedTemplate, user, toast]);

  const rsvpStats = useMemo(() => {
    const accepted = guestList.filter(g => g.rsvp === 'accepted').length;
    const declined = guestList.filter(g => g.rsvp === 'declined').length;
    const pending = guestList.filter(g => g.rsvp === 'pending').length;
    return { accepted, declined, pending, total: guestList.length };
  }, [guestList]);

  // Button Click Handlers
  const handleStartPlanning = useCallback(() => {
    toast({
      title: "Let's Start Planning!",
      description: "Scroll down to explore vendors, manage your budget, and track your calendar.",
    });
    // Scroll to vendors section
    window.scrollTo({ top: 600, behavior: 'smooth' });
  }, [toast]);

  const handleViewBudgetReport = useCallback(() => {
    if (!isPremium) {
      toast({
        title: "Premium Feature",
        description: "Unlock detailed budget reports by upgrading to Premium!",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Budget Report",
      description: "Opening your detailed budget analysis...",
    });
  }, [isPremium, toast]);

  const handleGoPremium = useCallback(() => {
    toast({
      title: "Upgrade to Premium",
      description: "Redirecting to subscription page...",
    });
    // In production, this would redirect to payment page
    setTimeout(() => {
      toast({
        title: "Coming Soon",
        description: "Premium subscription checkout will be available soon!",
      });
    }, 1000);
  }, [toast]);

  const handleAddRegistry = useCallback(() => {
    const newRegistry = {
      id: Date.now(),
      name: 'Custom Registry',
      url: '',
      icon: '🎁'
    };
    setRegistryLinks(prev => [...prev, newRegistry]);
    toast({
      title: "Registry Added",
      description: "Add your registry URL to share with guests.",
    });
  }, [toast]);

  const handleShareRegistry = useCallback((platform: string) => {
    // Generate registry URL from user's username
    const registrySlug = user?.username || user?.id || 'my-registry';
    const url = `https://chefsire.com/registry/${registrySlug}`;

    if (platform === 'copy') {
      navigator.clipboard.writeText(url);
      toast({
        title: "Link Copied!",
        description: "Registry link copied to clipboard.",
      });
    } else if (platform === 'Email') {
      // Actually open email client with pre-filled subject and body
      const subject = encodeURIComponent('Check out our wedding registry!');
      const body = encodeURIComponent(`We've created a wedding registry to help us start our new life together.\n\nView our registry here: ${url}\n\nThank you for your love and support!`);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    } else if (platform === 'Facebook') {
      // Open Facebook share dialog
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'Instagram') {
      // Instagram doesn't support direct link sharing, copy to clipboard instead
      navigator.clipboard.writeText(url);
      toast({
        title: "Link Copied!",
        description: "Paste this link in your Instagram bio or story.",
      });
    }
  }, [user, toast]);

  const handleAddCalendarEvent = useCallback(() => {
    toast({
      title: "Event Added",
      description: "Your event has been added to the calendar.",
    });
  }, [toast]);


  const handleTrialSelect = useCallback(async (tier: 'free' | 'premium' | 'elite') => {
    console.log('[Wedding Planning] Trial selected:', tier);

    // Prevent selecting trial if already have premium/elite
    if (currentTier === 'premium' || currentTier === 'elite') {
      toast({
        title: "Already Subscribed",
        description: "You already have an active subscription!",
      });
      setShowTrialSelector(false);
      return;
    }

    const plan = couplePlans[tier];

    try {
      // Calculate trial end date
      let subscriptionEndsAt: string | null = null;
      if (tier !== 'free' && plan.trialDays) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.trialDays);
        subscriptionEndsAt = endDate.toISOString();
      }

      // Update user's subscription tier in database and local state FIRST
      console.log('[Wedding Planning] Updating user tier to:', tier, 'ends at:', subscriptionEndsAt);
      await updateUser({
        subscriptionTier: tier,
        subscriptionStatus: 'active' as any,
        subscriptionEndsAt: subscriptionEndsAt as any,
      });

      console.log('[Wedding Planning] User updated successfully');

      // Wait a moment for state to update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Store the selection and close modal AFTER update completes
      localStorage.setItem('weddingTierSelected', 'true');
      setShowTrialSelector(false);

      if (tier === 'free') {
        toast({
          title: "Free Plan Activated",
          description: "You can upgrade to Premium or Elite anytime to unlock more features!",
        });
      } else {
        toast({
          title: `${plan.trialDays}-Day ${plan.name} Trial Started!`,
          description: `Enjoy all ${plan.name} features for free. Features should unlock immediately!`,
        });
      }
    } catch (error) {
      console.error('[Wedding Planning] Failed to update tier:', error);
      toast({
        title: "Update Failed",
        description: "Failed to activate trial. Please try again or refresh the page.",
        variant: "destructive",
      });
    }
  }, [updateUser, toast, currentTier]);

  // Invitation Preview Component
  const InvitationPreview = () => {
    try {
      console.log('[InvitationPreview] Rendering, selectedTemplate:', selectedTemplate);

      // Style configurations
      const styleTemplates = {
        elegant: {
          container: "bg-white font-serif border-double border-pink-200",
          accent: "text-pink-500",
          title: "font-light tracking-widest uppercase text-3xl",
          button: "rounded-full border-pink-200"
        },
        rustic: {
          container: "bg-orange-50 font-sans border-dashed border-amber-300",
          accent: "text-amber-700",
          title: "font-bold text-4xl italic text-amber-900",
          button: "rounded-none border-amber-500 bg-amber-50"
        },
        modern: {
          container: "bg-slate-900 text-white font-sans border-solid border-white/20",
          accent: "text-cyan-400",
          title: "font-black tracking-tighter text-5xl uppercase italic",
          button: "rounded-md border-cyan-400 text-cyan-400 hover:bg-cyan-400/10"
        }
      };

      const styles = styleTemplates[selectedTemplate as 'elegant' | 'rustic' | 'modern'] || styleTemplates.elegant;
      console.log('[InvitationPreview] Styles loaded:', styles);

    return (
      <div className={`p-8 rounded-lg text-center space-y-6 border-4 shadow-xl transition-all duration-500 ${styles.container}`}>

        {/* Header Section */}
        <div className="space-y-2">
          <Sparkles className={`w-6 h-6 mx-auto ${styles.accent}`} />
          <h2 className={styles.title}>
            {partner1Name || 'Partner 1'} <span className="text-xl block md:inline">&</span> {partner2Name || 'Partner 2'}
          </h2>
          <div className={`h-px w-24 mx-auto opacity-50 ${selectedTemplate === 'modern' ? 'bg-cyan-400' : 'bg-current'}`} />
        </div>

        {/* Message */}
        <p className={`text-lg px-4 ${selectedTemplate === 'modern' ? 'text-slate-300' : 'italic text-muted-foreground'}`}>
          "{customMessage}"
        </p>

        {/* Event Details Grid */}
        <div className="space-y-6 py-4">
          <div className="flex flex-col items-center">
            <CalendarIcon className={`w-5 h-5 mb-1 ${styles.accent}`} />
            <p className="font-semibold text-lg">{selectedDate || 'Saturday, June 14th'}</p>
            <p className="text-sm opacity-80">{weddingTime || '4:00 PM'}</p>
          </div>

          <div className="flex flex-col items-center">
            <MapPin className={`w-5 h-5 mb-1 ${styles.accent}`} />
            <p className="font-bold uppercase tracking-widest text-xs mb-1">The Ceremony</p>
            <p className="text-sm max-w-xs">{weddingLocation || 'The Grand Estate, Main Hall'}</p>
          </div>

          {/* Sync Logic: Show separate reception or single footer */}
          {!useSameLocation && receptionLocation ? (
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500 pt-4 border-t border-current/10">
              <ChefHat className={`w-5 h-5 mb-1 ${styles.accent}`} />
              <p className="font-bold uppercase tracking-widest text-xs mb-1">The Reception</p>
              <p className="text-sm max-w-xs">{receptionLocation}</p>
              {receptionTime && <p className="text-xs opacity-70 mt-1">Dinner served at {receptionTime}</p>}
            </div>
          ) : useSameLocation ? (
            <div className="pt-4 border-t border-current/10">
              <p className={`text-xs uppercase tracking-[0.2em] font-medium ${styles.accent}`}>
                Dinner & Dancing to follow at the same venue
              </p>
            </div>
          ) : null}
        </div>

        <Button variant="outline" className={`pointer-events-none px-10 ${styles.button}`}>
          RSVP Online
        </Button>
      </div>
    );
    } catch (error) {
      console.error('[InvitationPreview] Error rendering:', error);
      toast({ title: "Debug Error", description: `Preview error: ${error}`, variant: "destructive" });
      return <div className="p-8 text-center text-red-500">Error rendering preview</div>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-8">
      {/* Trial Selector Modal */}
      <WeddingTrialSelector
        open={showTrialSelector}
        onSelect={handleTrialSelect}
      />

      {showTrialBanner && (
        <Card className="mb-4 md:mb-6 border-2 border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2 md:gap-3 flex-1">
                <div className="relative flex-shrink-0">
                  <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-purple-600" />
                  <Badge className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-green-500 text-white text-[10px] md:text-xs">
                    FREE
                  </Badge>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm md:text-lg">Start Your 14-Day Premium Trial</h3>
                  <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                    Unlimited vendor messaging • Priority responses • Advanced planning tools
                  </p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowTrialBanner(false);
                    localStorage.setItem('weddingTrialBannerDismissed', 'true');
                  }}
                  className="flex-shrink-0"
                >
                  <X className="w-3 h-3 md:w-4 md:h-4" />
                </Button>
                <Button
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white flex-1 sm:flex-none"
                  size="sm"
                  onClick={handleStartTrial}
                >
                  <Zap className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  <span className="text-xs md:text-sm">Start Free Trial</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-8">
        <div className="mb-6">
          <div className="mb-4">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              Wedding Planning Hub
            </h1>
            <p className="text-muted-foreground mt-2 text-sm md:text-base">
              Find and book the perfect vendors for your special day
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowBudgetCalculator(!showBudgetCalculator)}
              className="w-full sm:w-auto"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Budget Calculator</span>
              <span className="sm:hidden">Budget</span>
            </Button>
            <Link href="/catering/wedding-map" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full">
                <MapPin className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Open Vendor Map</span>
                <span className="sm:hidden">Map</span>
              </Button>
            </Link>
            <Button
              className="bg-gradient-to-r from-pink-600 to-purple-600 text-white w-full sm:w-auto"
              onClick={handleStartPlanning}
            >
              <Heart className="w-4 h-4 mr-2" />
              Start Planning
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <h3 className="font-semibold text-sm md:text-base">Your Wedding Planning Progress</h3>
              <span className="text-xs md:text-sm text-muted-foreground">3 of 7 vendors booked</span>
            </div>
            <Progress value={43} className="mb-4" />
            <div className="grid grid-cols-4 md:grid-cols-7 gap-2 md:gap-3">
              {['Venue', 'Catering', 'Photo', 'Music', 'Flowers', 'Planner', 'Cake'].map(
                (item, idx) => (
                  <div key={item} className="text-center">
                    <div
                      className={`w-7 h-7 md:w-8 md:h-8 mx-auto rounded-full flex items-center justify-center mb-1 ${
                        idx < 3 ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    >
                      {idx < 3 && (
                        <Check className="w-3 h-3 md:w-4 md:h-4 text-white" />
                      )}
                    </div>
                    <span className="text-[10px] md:text-xs">{item}</span>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {showBudgetCalculator && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Smart Budget Calculator</CardTitle>
              <CardDescription>
                Optimize your wedding budget across all vendor categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Total Budget</label>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-2xl font-bold">
                      ${budgetRange[1].toLocaleString()}
                    </span>
                    <Slider
                      value={budgetRange}
                      onValueChange={setBudgetRange}
                      max={100000}
                      min={5000}
                      step={1000}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="grid gap-3 mt-6">
                  {budgetBreakdown.map((item) => (
                    <div
                      key={item.category}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{item.category}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.percentage}% of budget
                          </p>
                        </div>
                      </div>
                      <span className="font-semibold">
                        ${item.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Based on {guestCount[0]} guests. Catering typically represents the
                    largest portion of your wedding budget.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Premium Budget Tool Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Current Budget Card */}
          <Card>
            <CardHeader>
              <CardTitle>Your Current Budget</CardTitle>
              <CardDescription>
                Target: ${budgetRange[1].toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Slider
                  value={budgetRange}
                  onValueChange={setBudgetRange}
                  max={100000}
                  min={5000}
                  step={1000}
                  className="flex-1"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>${budgetRange[0].toLocaleString()}</span>
                  <span>${budgetRange[1].toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dynamic Budget Advisor Card */}
          <Card className={isElite ? 'border-amber-500/50' : 'border-gray-200'}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className={isElite ? 'text-amber-700' : 'text-gray-500'}>
                {isElite
                  ? 'AI-Powered Budget Optimizer'
                  : 'Budget Optimization (Elite)'}
              </CardTitle>
              {isElite ? (
                <TrendingUp className="w-6 h-6 text-amber-600" />
              ) : (
                <Lock className="w-6 h-6 text-gray-400" />
              )}
            </CardHeader>
            <CardContent>
              {isElite ? (
                <div className="space-y-3">
                  <p className="text-4xl font-bold text-green-600">
                    <DollarSign className="w-6 h-6 inline mr-1" />
                    {dynamicSavings.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Projected savings by optimizing your venue and catering budget
                    against similar couples in your area.
                  </p>
                  <Button size="sm" onClick={handleViewBudgetReport}>View Detailed Report</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-4xl font-bold text-gray-400">Locked</p>
                  <p className="text-sm text-muted-foreground">
                    Unlock the AI-Powered Budget Optimizer (Elite tier) to find an average of
                    <span className="font-bold text-amber-600"> $4,200</span> in hidden
                    savings based on your criteria and AI recommendations.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-amber-100 border-amber-300"
                    onClick={handleGoPremium}
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Upgrade to Elite
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <div>
                <label className="text-xs md:text-sm font-medium mb-2 block">
                  Event Date
                </label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs md:text-sm font-medium mb-2 block">
                  Guest Count
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={guestCount[0]}
                    onChange={(e) =>
                      setGuestCount([parseInt(e.target.value || '0', 10)])
                    }
                    className="w-full"
                  />
                  <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              </div>

              <div>
                <label className="text-xs md:text-sm font-medium mb-2 block">
                  Location
                </label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hartford">Hartford Area</SelectItem>
                    <SelectItem value="newhaven">New Haven</SelectItem>
                    <SelectItem value="stamford">Stamford</SelectItem>
                    <SelectItem value="greenwich">Greenwich</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs md:text-sm font-medium mb-2 block">
                  Style
                </label>
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
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
        {VENDOR_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const isSelected = selectedVendorType === category.value;
          const count =
            category.value === 'all'
              ? VENDORS.length
              : VENDORS.filter((v) => v.type === category.value).length;
          return (
            <Button
              key={category.value}
              variant={isSelected ? 'default' : 'outline'}
              onClick={() => setSelectedVendorType(category.value)}
              className="w-full flex items-center justify-center sm:justify-between px-2"
              size="sm"
            >
              <div className="flex items-center gap-1 min-w-0">
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs sm:text-sm hidden sm:inline truncate">
                  {category.label}
                </span>
              </div>
              <Badge
                variant="secondary"
                className="text-xs hidden sm:flex flex-shrink-0"
              >
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <h2 className="text-lg md:text-xl font-semibold">
            {filteredVendors.length} Vendors Available
          </h2>
          {selectedDate && (
            <Badge variant="secondary" className="w-fit">
              <Calendar className="w-3 h-3 mr-1" />
              <span className="text-xs">
                {new Date(selectedDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8">
        {filteredVendors.map((vendor) => (
          <VendorCard
            key={vendor.id}
            vendor={vendor}
            isSaved={savedVendors.has(vendor.id)}
            isQuoteRequested={requestedQuotes.has(vendor.id)}
            onToggleSave={toggleSaveVendor}
            onRequestQuote={requestQuote}
          />
        ))}
      </div>

      <Card className="mb-8">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Gift className="w-4 h-4 md:w-5 md:h-5" />
            Gift Registry Hub
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Manage all your registries in one place and share with guests
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="space-y-3 md:space-y-4">
            {registryLinks.map((registry) => (
              <div
                key={registry.id}
                className="flex items-center gap-2 md:gap-3"
              >
                <span className="text-xl md:text-2xl flex-shrink-0">
                  {registry.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder={`${registry.name} Registry URL`}
                    value={registry.url}
                    onChange={(e) => {
                      setRegistryLinks((prev) =>
                        prev.map((r) =>
                          r.id === registry.id
                            ? { ...r, url: e.target.value }
                            : r
                        )
                      );
                    }}
                    className="w-full text-sm"
                  />
                </div>
                <Button size="sm" variant="ghost" className="flex-shrink-0">
                  <X className="w-3 h-3 md:w-4 md:h-4" />
                </Button>
              </div>
            ))}

            <Button variant="outline" className="w-full text-sm" onClick={handleAddRegistry}>
              <Plus className="w-4 h-4 mr-2" />
              Add Another Registry
            </Button>

            <div className="border-t pt-4 mt-4 md:mt-6">
              <h4 className="font-medium mb-3 text-sm md:text-base">
                Share Your Registries
              </h4>
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => handleShareRegistry('Facebook')}>
                  <Share2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">Facebook</span>
                  <span className="sm:hidden">FB</span>
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => handleShareRegistry('Instagram')}>
                  <Share2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">Instagram</span>
                  <span className="sm:hidden">IG</span>
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => handleShareRegistry('Email')}>
                  <Mail className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Email
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => handleShareRegistry('copy')}>
                  <Link2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">Copy Link</span>
                  <span className="sm:hidden">Copy</span>
                </Button>
              </div>

              <Alert className="mt-4">
                <Info className="h-3 w-3 md:h-4 md:w-4" />
                <AlertDescription className="text-xs md:text-sm break-all">
                  Your unique registry page:{' '}
                  <strong>chefsire.com/registry/{user?.username || user?.id || 'my-registry'}</strong>
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <CalendarIcon className="w-4 h-4 md:w-5 md:h-5" />
            Planning Calendar
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Track important dates, appointments, and deadlines
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div>
              <h4 className="font-medium mb-3 text-sm md:text-base">
                Upcoming Events
              </h4>
              <div className="space-y-2">
                {calendarEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-2 md:gap-3 p-2 md:p-3 bg-muted rounded-lg"
                  >
                    <div className="text-center min-w-[40px] md:min-w-[50px]">
                      <div className="text-[10px] md:text-xs text-muted-foreground">
                        {new Date(event.date).toLocaleDateString('en-US', {
                          month: 'short'
                        })}
                      </div>
                      <div className="text-base md:text-lg font-bold">
                        {new Date(event.date).getDate()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs md:text-sm truncate">
                        {event.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant={
                            event.type === 'payment'
                              ? 'destructive'
                              : event.type === 'appointment'
                              ? 'default'
                              : 'secondary'
                          }
                          className="text-[10px] md:text-xs"
                        >
                          {event.type}
                        </Badge>
                        {event.reminder && (
                          <BellRing className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="p-1 md:p-2">
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3 text-sm md:text-base">Add Event</h4>
              <div className="space-y-2 md:space-y-3">
                <Input type="date" placeholder="Date" className="text-sm" />
                <Input placeholder="Event title" className="text-sm" />
                <Select>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Event type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appointment">Appointment</SelectItem>
                    <SelectItem value="payment">Payment Due</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Notes (optional)"
                  className="h-16 md:h-20 text-sm"
                />
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="reminder" className="rounded" />
                  <label htmlFor="reminder" className="text-xs md:text-sm">
                    Set reminder
                  </label>
                </div>
                <Button className="w-full text-sm" onClick={handleAddCalendarEvent}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Calendar
                </Button>
              </div>
            </div>
          </div>

          <Alert className="mt-6">
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              <strong>Pro tip:</strong> Most couples book venues 10-12 months before
              their wedding date.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Email Invitations Section - Premium Feature */}
      <Card className={`mb-8 ${isPremium ? 'border-purple-500/50' : 'border-gray-300'}`}>
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 md:w-5 md:h-5" />
              <CardTitle className="text-base md:text-lg">Email Invitations</CardTitle>
              {!isPremium && (
                <Badge className="bg-pink-500 text-white text-xs">Premium</Badge>
              )}
            </div>
            {isPremium && (
              <Badge className="bg-green-500 text-white text-xs">
                <Check className="w-3 h-3 mr-1" />
                Active
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs md:text-sm">
            Send beautiful wedding invitations and track RSVPs
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          {/* Event Details Form */}
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-3 text-sm flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Wedding Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <Input
                placeholder="Partner 1 Name (e.g., Sarah)"
                value={partner1Name}
                onChange={(e) => setPartner1Name(e.target.value)}
                className="text-sm"
                disabled={!isPremium}
              />
              <Input
                placeholder="Partner 2 Name (e.g., John)"
                value={partner2Name}
                onChange={(e) => setPartner2Name(e.target.value)}
                className="text-sm"
                disabled={!isPremium}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <Input
                type="date"
                placeholder="Wedding Date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-sm"
                disabled={!isPremium}
              />
              <Input
                type="time"
                placeholder="Wedding Time"
                value={weddingTime}
                onChange={(e) => setWeddingTime(e.target.value)}
                className="text-sm"
                disabled={!isPremium}
              />
            </div>
            {/* Ceremony Location with Google Places Autocomplete */}
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
                disabled={!isPremium}
              />
            </div>

            {/* Sync Toggle */}
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
                disabled={!isPremium}
              />
              <label htmlFor="sync-location" className="text-sm text-muted-foreground cursor-pointer">
                Reception is at the same location
              </label>
            </div>

            {/* Reception Details - Only show if not synced */}
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
                    disabled={!isPremium}
                  />
                  <Input
                    type="time"
                    placeholder="Reception Time"
                    value={receptionTime}
                    onChange={(e) => setReceptionTime(e.target.value)}
                    className="text-sm"
                    disabled={!isPremium}
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
                    disabled={!isPremium}
                  />
                </div>
              </div>
            )}

            <textarea
              placeholder="Custom message for your guests..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full p-3 text-sm border rounded-md resize-none"
              rows={3}
              disabled={!isPremium}
            />
          </div>

          {/* RSVP Stats */}
          <div className="grid grid-cols-4 gap-3 md:gap-4 mb-6">
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-xl md:text-2xl font-bold">{rsvpStats.total}</p>
              <p className="text-xs text-muted-foreground">Total Guests</p>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <p className="text-xl md:text-2xl font-bold text-green-600">{rsvpStats.accepted}</p>
              <p className="text-xs text-muted-foreground">Accepted</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <p className="text-xl md:text-2xl font-bold text-yellow-600">{rsvpStats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
              <p className="text-xl md:text-2xl font-bold text-red-600">{rsvpStats.declined}</p>
              <p className="text-xs text-muted-foreground">Declined</p>
            </div>
          </div>

          {/* Template Selection */}
          <div className="mb-6">
            <label className="text-sm font-medium mb-2 block">Invitation Template</label>
            <div className="grid grid-cols-3 gap-3">
              {['elegant', 'rustic', 'modern'].map((template) => (
                <button
                  key={template}
                  onClick={() => setSelectedTemplate(template)}
                  className={`p-4 border-2 rounded-lg text-center capitalize transition-all ${
                    selectedTemplate === template
                      ? 'border-pink-500 bg-pink-50 dark:bg-pink-950'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${!isPremium ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  disabled={!isPremium}
                >
                  <Sparkles className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm font-medium">{template}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Add Guest Form */}
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-3 text-sm">Add Guest</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                placeholder="Guest Name"
                value={newGuestName}
                onChange={(e) => setNewGuestName(e.target.value)}
                className="text-sm"
              />
              <Input
                type="email"
                placeholder="Email Address"
                value={newGuestEmail}
                onChange={(e) => setNewGuestEmail(e.target.value)}
                className="text-sm"
              />
              <Button onClick={addGuest} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Guest
              </Button>
            </div>
          </div>

          {/* Guest List */}
          <div className="mb-6">
            <h4 className="font-medium mb-3 text-sm">Guest List ({guestList.length})</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {guestList.map((guest) => (
                <div
                  key={guest.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{guest.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{guest.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        guest.rsvp === 'accepted'
                          ? 'default'
                          : guest.rsvp === 'declined'
                          ? 'destructive'
                          : 'secondary'
                      }
                      className="text-xs"
                    >
                      {guest.rsvp}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeGuest(guest.id)}
                      className="p-1"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Send Invitations & Preview Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {isPremium ? (
              <>
                <Button
                  className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 text-white"
                  onClick={sendInvitations}
                  disabled={guestList.length === 0}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send Invitations ({guestList.length})
                </Button>

                {/* Preview Dialog */}
                <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex-1 border-pink-200 hover:bg-pink-50">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Preview Invitation
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg overflow-hidden">
                    <DialogHeader>
                      <DialogTitle>Invitation Preview</DialogTitle>
                      <p className="text-xs text-muted-foreground">This is exactly what your guests will see in their email.</p>
                    </DialogHeader>
                    <InvitationPreview />
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="ghost" onClick={() => setIsPreviewOpen(false)}>Close</Button>
                      <Button
                        className="bg-pink-600"
                        onClick={() => {
                          setIsPreviewOpen(false);
                          sendInvitations();
                        }}
                        disabled={guestList.length === 0}
                      >
                        Confirm & Send
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <Button variant="outline" className="flex-1 border-pink-300 bg-pink-50" onClick={handleGoPremium}>
                <Heart className="w-4 h-4 mr-2" />
                Upgrade to Premium
              </Button>
            )}
          </div>

          {!isPremium && (
            <Alert className="mt-4 border-pink-300 bg-pink-50/50">
              <Lock className="h-4 w-4 text-pink-600" />
              <AlertDescription className="text-sm">
                Upgrade to Premium to send unlimited email invitations with beautiful templates and automatic RSVP tracking.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
