// client/src/pages/services/wedding-planning.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { 
  Calendar, MapPin, Users, DollarSign, Clock, Heart, 
  ChefHat, Camera, Music, Flower, Sparkles, Star,
  Filter, Search, ArrowRight, Check, Info, Phone,
  Mail, Instagram, Globe, ChevronDown, TrendingUp,
  Award, Shield, Bookmark, Share2, MessageCircle,
  Gift, Calendar as CalendarIcon, Link2, Plus, X, BellRing,
  AlertCircle, Zap, Grid, List
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// ---------- Types ----------
type VendorType = 'caterer' | 'venue' | 'photographer' | 'dj' | 'florist' | 'planner';
type Vendor = {
  id: number;
  type: VendorType;
  name: string;
  rating: number;
  reviews: number;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  image: string;
  specialty?: string;
  style?: string;
  verified: boolean;
  featured: boolean;
  sponsored?: boolean;
  availability: 'Available' | 'Limited' | 'Booked';
  minGuests?: number;
  maxGuests?: number;
  capacity?: string;
  description: string;
  amenities?: string[];
  packages?: string[];
  responseTime: string;
  viewsToday?: number;
  phone?: string;
  website?: string;
};

// ---------- Mock Vendors (seed) ----------
const vendorsSeed: Vendor[] = [
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
    viewsToday: 23,
    phone: '(860) 555-2000',
    website: 'www.bellavistacatering.com'
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
    responseTime: '24 hours',
    phone: '(860) 555-0123',
    website: 'www.grandballroom.com'
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
    responseTime: '1 hour',
    phone: '(860) 555-0789',
    website: 'www.momentsphotography.com'
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
    responseTime: '3 hours',
    phone: '(860) 555-0345',
    website: 'www.elitedj.com'
  }
];

// ---------- Helpers ----------
const priceToNum = (p: Vendor['priceRange']) => (p ? p.length : 0);

// ---------- Component ----------
export default function WeddingPlanner() {
  // Core UI state
  const [selectedVendorType, setSelectedVendorType] = useState<'all' | VendorType>('all');
  const [sortBy, setSortBy] = useState<'featured'|'rating'|'price-low'|'price-high'|'availability'>('featured');
  const [activeView, setActiveView] = useState<'grid'|'list'>('grid');

  // Planning inputs
  const [budgetRange, setBudgetRange] = useState<[number, number]>([5000, 50000]);
  const [guestCount, setGuestCount] = useState<[number]>([100]);
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Persisted sets
  const [savedVendors, setSavedVendors] = useState<Set<number>>(new Set());
  const [requestedQuotes, setRequestedQuotes] = useState<Set<number>>(new Set());

  // Optional UI
  const [showBudgetCalculator, setShowBudgetCalculator] = useState(false);
  const [showTrialBanner, setShowTrialBanner] = useState(true);

  // Registry + Calendar
  const [registryLinks, setRegistryLinks] = useState(
    [
      { id: 1, name: 'Amazon', url: '', icon: '🎁' },
      { id: 2, name: 'Target', url: '', icon: '🎯' },
      { id: 3, name: 'Zola', url: '', icon: '💑' }
    ]
  );
  const [calendarEvents, setCalendarEvents] = useState(
    [
      { id: 1, date: '2025-03-15', title: 'Venue Tour - Grand Ballroom', type: 'appointment', reminder: true },
      { id: 2, date: '2025-03-20', title: 'Cake Tasting', type: 'appointment', reminder: true },
      { id: 3, date: '2025-04-01', title: 'Catering Deposit Due', type: 'payment', reminder: true },
      { id: 4, date: '2025-04-15', title: 'Send Save the Dates', type: 'task', reminder: false }
    ]
  );

  // Add-Event form state
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventType, setNewEventType] = useState<'appointment'|'payment'|'task'|'milestone'|''>('');
  const [newEventNotes, setNewEventNotes] = useState('');
  const [newEventReminder, setNewEventReminder] = useState(false);

  // Vendor list (memo)
  const vendors: Vendor[] = useMemo(() => vendorsSeed, []);
  const filteredVendors = useMemo(() => {
    const base = selectedVendorType === 'all'
      ? vendors
      : vendors.filter(v => v.type === selectedVendorType);
    const sorted = [...base].sort((a, b) => {
      if (sortBy === 'featured') {
        // Sponsored/Featured first, then rating
        const aScore = (a.sponsored ? 2 : 0) + (a.featured ? 1 : 0);
        const bScore = (b.sponsored ? 2 : 0) + (b.featured ? 1 : 0);
        if (bScore !== aScore) return bScore - aScore;
        return b.rating - a.rating;
      }
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'price-low') return priceToNum(a.priceRange) - priceToNum(b.priceRange);
      if (sortBy === 'price-high') return priceToNum(b.priceRange) - priceToNum(a.priceRange);
      if (sortBy === 'availability') {
        const order = { 'Available': 0, 'Limited': 1, 'Booked': 2 } as const;
        const delta = order[a.availability] - order[b.availability];
        return delta !== 0 ? delta : b.rating - a.rating;
      }
      return 0;
    });
    return sorted;
  }, [vendors, selectedVendorType, sortBy]);

  // Budget breakdown (recompute as budget changes)
  const budgetBreakdown = useMemo(() => ([
    { category: 'Catering & Bar', percentage: 40, amount: budgetRange[1] * 0.4, icon: ChefHat },
    { category: 'Venue', percentage: 20, amount: budgetRange[1] * 0.2, icon: MapPin },
    { category: 'Photography', percentage: 12, amount: budgetRange[1] * 0.12, icon: Camera },
    { category: 'Music & Entertainment', percentage: 8, amount: budgetRange[1] * 0.08, icon: Music },
    { category: 'Flowers & Decor', percentage: 10, amount: budgetRange[1] * 0.1, icon: Flower },
    { category: 'Other', percentage: 10, amount: budgetRange[1] * 0.1, icon: Sparkles }
  ]), [budgetRange]);

  // Persistence
  useEffect(() => {
    try {
      const sv = localStorage.getItem('weddingHub.savedVendors');
      const rq = localStorage.getItem('weddingHub.requestedQuotes');
      const rl = localStorage.getItem('weddingHub.registryLinks');
      const ce = localStorage.getItem('weddingHub.calendarEvents');
      const st = localStorage.getItem('weddingHub.showTrial');
      const br = localStorage.getItem('weddingHub.budgetRange');
      const gc = localStorage.getItem('weddingHub.guestCount');
      const dt = localStorage.getItem('weddingHub.selectedDate');
      const vt = localStorage.getItem('weddingHub.view');

      if (sv) setSavedVendors(new Set(JSON.parse(sv)));
      if (rq) setRequestedQuotes(new Set(JSON.parse(rq)));
      if (rl) setRegistryLinks(JSON.parse(rl));
      if (ce) setCalendarEvents(JSON.parse(ce));
      if (st !== null) setShowTrialBanner(st === 'true');
      if (br) setBudgetRange(JSON.parse(br));
      if (gc) setGuestCount(JSON.parse(gc));
      if (dt) setSelectedDate(dt);
      if (vt === 'list' || vt === 'grid') setActiveView(vt);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { localStorage.setItem('weddingHub.savedVendors', JSON.stringify(Array.from(savedVendors))); }, [savedVendors]);
  useEffect(() => { localStorage.setItem('weddingHub.requestedQuotes', JSON.stringify(Array.from(requestedQuotes))); }, [requestedQuotes]);
  useEffect(() => { localStorage.setItem('weddingHub.registryLinks', JSON.stringify(registryLinks)); }, [registryLinks]);
  useEffect(() => { localStorage.setItem('weddingHub.calendarEvents', JSON.stringify(calendarEvents)); }, [calendarEvents]);
  useEffect(() => { localStorage.setItem('weddingHub.showTrial', String(showTrialBanner)); }, [showTrialBanner]);
  useEffect(() => { localStorage.setItem('weddingHub.budgetRange', JSON.stringify(budgetRange)); }, [budgetRange]);
  useEffect(() => { localStorage.setItem('weddingHub.guestCount', JSON.stringify(guestCount)); }, [guestCount]);
  useEffect(() => { localStorage.setItem('weddingHub.selectedDate', selectedDate); }, [selectedDate]);
  useEffect(() => { localStorage.setItem('weddingHub.view', activeView); }, [activeView]);

  // Actions
  const toggleSaveVendor = (vendorId: number) => {
    setSavedVendors(prev => {
      const s = new Set(prev);
      s.has(vendorId) ? s.delete(vendorId) : s.add(vendorId);
      return s;
    });
  };

  const requestQuote = (vendorId: number) => {
    setRequestedQuotes(prev => {
      const s = new Set(prev);
      s.add(vendorId);
      return s;
    });
  };

  const addRegistry = () => {
    setRegistryLinks(prev => {
      const nextId = (prev.at(-1)?.id ?? 0) + 1;
      return [...prev, { id: nextId, name: 'Custom', url: '', icon: '🧧' }];
    });
  };

  const removeRegistry = (id: number) => {
    setRegistryLinks(prev => prev.filter(r => r.id !== id));
  };

  const copyShareLink = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      alert('Link copied: ' + text);
    }
  };

  const addEvent = () => {
    if (!newEventDate || !newEventTitle || !newEventType) return;
    setCalendarEvents(prev => [
      ...prev,
      {
        id: (prev.at(-1)?.id ?? 0) + 1,
        date: newEventDate,
        title: newEventTitle,
        type: newEventType,
        reminder: newEventReminder
      }
    ]);
    setNewEventDate('');
    setNewEventTitle('');
    setNewEventType('');
    setNewEventNotes('');
    setNewEventReminder(false);
  };

  const removeEvent = (id: number) => {
    setCalendarEvents(prev => prev.filter(e => e.id !== id));
  };

  // Vendor details modal
  const [showDetails, setShowDetails] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {showTrialBanner && (
        <Card className="mb-6 border-2 border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Sparkles className="w-8 h-8 text-purple-600" />
                  <Badge className="absolute -top-2 -right-2 bg-green-500 text-white">
                    FREE
                  </Badge>
                </div>
                <div>
                  <h3 className="font-bold text-lg">Start Your 14-Day Premium Trial</h3>
                  <p className="text-sm text-muted-foreground">
                    Unlimited vendor messaging • Priority responses • Advanced planning tools
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowTrialBanner(false)}>
                  <X className="w-4 h-4" />
                </Button>
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white" size="sm">
                  <Zap className="w-4 h-4 mr-2" />
                  Start Free Trial
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              Wedding Planning Hub
            </h1>
            <p className="text-muted-foreground mt-2">
              Find and book the perfect vendors for your special day
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/services/wedding-vendors">
              <Button variant="outline">
                <MapPin className="w-4 h-4 mr-2" />
                Open Vendor Map
              </Button>
            </Link>
            <Button variant="outline" onClick={() => setShowBudgetCalculator(!showBudgetCalculator)}>
              <DollarSign className="w-4 h-4 mr-2" />
              Budget Calculator
            </Button>
            <Button className="bg-gradient-to-r from-pink-600 to-purple-600 text-white">
              <Heart className="w-4 h-4 mr-2" />
              Start Planning
            </Button>
          </div>
        </div>

        {/* Progress */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Your Wedding Planning Progress</h3>
              <span className="text-sm text-muted-foreground">3 of 7 vendors booked</span>
            </div>
            <Progress value={43} className="mb-4" />
            <div className="grid grid-cols-7 gap-2">
              {['Venue', 'Catering', 'Photo', 'Music', 'Flowers', 'Planner', 'Cake'].map((item, idx) => (
                <div key={item} className="text-center">
                  <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center mb-1 ${
                    idx < 3 ? 'bg-green-500' : 'bg-gray-200'
                  }`}>
                    {idx < 3 && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <span className="text-xs">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Budget Calculator */}
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
                    <span className="text-2xl font-bold">${budgetRange[1].toLocaleString()}</span>
                    <Slider
                      value={budgetRange}
                      onValueChange={(v:any) => setBudgetRange(v)}
                      max={100000}
                      min={5000}
                      step={1000}
                      className="flex-1"
                    />
                  </div>
                </div>
                
                <div className="grid gap-3 mt-6">
                  {budgetBreakdown.map((item) => (
                    <div key={item.category} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <item.icon className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{item.category}</p>
                          <p className="text-xs text-muted-foreground">{item.percentage}% of budget</p>
                        </div>
                      </div>
                      <span className="font-semibold">${item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Based on {guestCount[0]} guests. Catering typically represents the largest portion of your wedding budget.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Event Date</label>
                <Input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Guest Count</label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    value={guestCount[0]}
                    onChange={(e) => setGuestCount([Math.max(1, parseInt(e.target.value || '0'))])}
                    className="w-full"
                  />
                  <Users className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Location</label>
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
                <label className="text-sm font-medium mb-2 block">Style</label>
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

      {/* Category pills */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { value: 'all', label: 'All Vendors', icon: Sparkles },
          { value: 'caterer', label: 'Catering', icon: ChefHat },
          { value: 'venue', label: 'Venues', icon: MapPin },
          { value: 'photographer', label: 'Photography', icon: Camera },
          { value: 'dj', label: 'Entertainment', icon: Music },
          { value: 'florist', label: 'Florals', icon: Flower },
          { value: 'planner', label: 'Planners', icon: Heart }
        ].map((category) => {
          const Icon = category.icon as any;
          return (
            <Button
              key={category.value}
              variant={selectedVendorType === category.value ? 'default' : 'outline'}
              onClick={() => setSelectedVendorType(category.value as any)}
              className="whitespace-nowrap"
            >
              <Icon className="w-4 h-4 mr-2" />
              {category.label}
            </Button>
          );
        })}
      </div>

      {/* Result header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">
            {filteredVendors.length} Vendors Available
          </h2>
          {selectedDate && (
            <Badge variant="secondary">
              <Calendar className="w-3 h-3 mr-1" />
              {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={activeView === 'list' ? 'default' : 'ghost'}
            onClick={() => setActiveView('list')}
            aria-label="List view"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant={activeView === 'grid' ? 'default' : 'ghost'}
            onClick={() => setActiveView('grid')}
            aria-label="Grid view"
          >
            <Grid className="w-4 h-4" />
          </Button>

          <Select value={sortBy} onValueChange={(v:any)=>setSortBy(v)}>
            <SelectTrigger className="w-44">
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

      {/* Vendor cards */}
      <div className={
        activeView === 'grid'
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
          : "space-y-4 mb-8"
      }>
        {filteredVendors.map((vendor) => (
          <Card key={vendor.id} className={`overflow-hidden hover:shadow-lg transition-shadow ${activeView === 'list' ? 'flex' : ''}`}>
            <div className={`relative ${activeView === 'list' ? 'w-72 flex-shrink-0' : ''}`}>
              <img 
                src={vendor.image} 
                alt={vendor.name}
                className={`${activeView === 'list' ? 'w-72 h-full object-cover' : 'w-full h-48 object-cover'}`}
              />
              {vendor.sponsored && (
                <Badge className="absolute top-2 left-2 bg-gradient-to-r from-yellow-500 to-orange-500">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Sponsored
                </Badge>
              )}
              {vendor.featured && !vendor.sponsored && (
                <Badge className="absolute top-2 left-2 bg-gradient-to-r from-pink-600 to-purple-600">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Featured
                </Badge>
              )}
              <Button
                size="sm"
                variant="secondary"
                className="absolute top-2 right-2 rounded-full p-2"
                onClick={() => toggleSaveVendor(vendor.id)}
                aria-label={savedVendors.has(vendor.id) ? 'Unsave' : 'Save'}
              >
                <Bookmark 
                  className={`w-4 h-4 ${savedVendors.has(vendor.id) ? 'fill-current' : ''}`}
                />
              </Button>
              <Badge 
                className={`absolute bottom-2 left-2 ${
                  vendor.availability === 'Available' 
                    ? 'bg-green-500' 
                    : vendor.availability === 'Limited'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
              >
                {vendor.availability}
              </Badge>
            </div>

            <CardContent className={`p-4 ${activeView === 'list' ? 'flex-1' : ''}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-lg flex items-center gap-1">
                    {vendor.name}
                    {vendor.verified && (
                      <Shield className="w-4 h-4 text-blue-500" />
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground">{vendor.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold">{vendor.rating}</span>
                  <span className="text-sm text-muted-foreground">({vendor.reviews})</span>
                </div>
                <span className="text-sm font-medium">{vendor.priceRange}</span>
              </div>

              {vendor.amenities && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {vendor.amenities.slice(0, 3).map((amenity) => (
                    <Badge key={amenity} variant="secondary" className="text-xs">
                      {amenity}
                    </Badge>
                  ))}
                  {vendor.amenities.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{vendor.amenities.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              {vendor.viewsToday && (
                <Alert className="mb-3 p-2">
                  <AlertCircle className="h-3 w-3" />
                  <AlertDescription className="text-xs">
                    {vendor.viewsToday} couples viewed today
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  Responds in {vendor.responseTime}
                </div>
                <div className="flex gap-2">
                  {requestedQuotes.has(vendor.id) ? (
                    <Badge variant="secondary" className="text-xs">
                      Quote Requested
                    </Badge>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => requestQuote(vendor.id)}>
                        Get Quote
                      </Button>
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-pink-600 to-purple-600"
                        onClick={() => { setSelectedVendor(vendor); setShowDetails(true); }}
                      >
                        View Details
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Registry */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5" />
            Gift Registry Hub
          </CardTitle>
          <CardDescription>
            Manage all your registries in one place and share with guests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {registryLinks.map((registry) => (
              <div key={registry.id} className="flex items-center gap-3">
                <span className="text-2xl">{registry.icon}</span>
                <div className="flex-1">
                  <Input
                    placeholder={`${registry.name} Registry URL`}
                    value={registry.url}
                    onChange={(e) => {
                      const url = e.target.value;
                      setRegistryLinks(prev => prev.map(r => r.id === registry.id ? { ...r, url } : r));
                    }}
                    className="w-full"
                  />
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeRegistry(registry.id)} aria-label="Remove registry">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            
            <Button variant="outline" className="w-full" onClick={addRegistry}>
              <Plus className="w-4 h-4 mr-2" />
              Add Another Registry
            </Button>

            <div className="border-t pt-4 mt-6">
              <h4 className="font-medium mb-3">Share Your Registries</h4>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => window.open('https://facebook.com', '_blank')}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Facebook
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.open('https://instagram.com', '_blank')}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Instagram
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.location.href = 'mailto:?subject=Our%20Registry&body=Check%20our%20registry:%20chefsire.com/registry/sarah-john-2025'}>
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>
                <Button variant="outline" size="sm" onClick={() => copyShareLink('https://chefsire.com/registry/sarah-john-2025')}>
                  <Link2 className="w-4 h-4 mr-2" />
                  Copy Link
                </Button>
              </div>
              
              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Your unique registry page: <strong>chefsire.com/registry/sarah-john-2025</strong>
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Planning Calendar
          </CardTitle>
          <CardDescription>
            Track important dates, appointments, and deadlines
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Upcoming Events</h4>
              <div className="space-y-2">
                {calendarEvents
                  .slice()
                  .sort((a,b) => a.date.localeCompare(b.date))
                  .map((event) => (
                  <div key={event.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                    <div className="text-center min-w-[50px]">
                      <div className="text-xs text-muted-foreground">
                        {new Date(event.date).toLocaleDateString('en-US', { month: 'short' })}
                      </div>
                      <div className="text-lg font-bold">
                        {new Date(event.date).getDate()}
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{event.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={
                          event.type === 'payment' ? 'destructive' : 
                          event.type === 'appointment' ? 'default' : 'secondary'
                        } className="text-xs capitalize">
                          {event.type}
                        </Badge>
                        {event.reminder && (
                          <BellRing className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeEvent(event.id)} aria-label="Remove event">
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Add Event</h4>
              <div className="space-y-3">
                <Input type="date" placeholder="Date" value={newEventDate} onChange={(e)=>setNewEventDate(e.target.value)} />
                <Input placeholder="Event title" value={newEventTitle} onChange={(e)=>setNewEventTitle(e.target.value)} />
                <Select value={newEventType} onValueChange={(v:any)=>setNewEventType(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Event type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appointment">Appointment</SelectItem>
                    <SelectItem value="payment">Payment Due</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea placeholder="Notes (optional)" className="h-20" value={newEventNotes} onChange={(e)=>setNewEventNotes(e.target.value)} />
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="reminder" className="rounded" checked={newEventReminder} onChange={(e)=>setNewEventReminder(e.target.checked)} />
                  <label htmlFor="reminder" className="text-sm">Set reminder</label>
                </div>
                <Button className="w-full" onClick={addEvent}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Calendar
                </Button>
              </div>

              <Alert className="mt-6">
                <TrendingUp className="h-4 w-4" />
                <AlertDescription>
                  <strong>Pro tip:</strong> Most couples book venues 10–12 months before their wedding date.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vendor CTA */}
      <Card className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950 dark:to-purple-950 border-pink-200 dark:border-pink-800">
        <CardContent className="p-8 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-pink-600" />
          <h3 className="text-2xl font-bold mb-2">Are You a Wedding Vendor?</h3>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Join ChefSire's wedding marketplace and connect with thousands of engaged couples. 
            Get more bookings, manage your calendar, and grow your business.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" variant="outline">
              Learn More
            </Button>
            <Button size="lg" className="bg-gradient-to-r from-pink-600 to-purple-600">
              <TrendingUp className="w-4 h-4 mr-2" />
              List Your Business
            </Button>
          </div>
        </CardContent>
      </Card>

      <Alert className="mt-6">
        <TrendingUp className="h-4 w-4" />
        <AlertDescription>
          <strong>Trending:</strong> Barn venues are 40% more popular this season. 
          Book early for Fall 2025 dates!
        </AlertDescription>
      </Alert>

      {/* Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedVendor && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl flex items-center gap-2">
                  {selectedVendor.name}
                  {selectedVendor.verified && <Shield className="w-5 h-5 text-blue-500" />}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">{selectedVendor.type}</Badge>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{selectedVendor.priceRange}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="w-full h-64 rounded-lg overflow-hidden">
                  <img src={selectedVendor.image} alt={selectedVendor.name} className="w-full h-full object-cover" />
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-lg">{selectedVendor.rating}</span>
                    <span className="text-muted-foreground">({selectedVendor.reviews} reviews)</span>
                  </div>
                  <Badge variant="outline">{selectedVendor.availability}</Badge>
                </div>

                {selectedVendor.description && (
                  <p className="text-sm text-muted-foreground">{selectedVendor.description}</p>
                )}

                {(selectedVendor.amenities || selectedVendor.packages) && (
                  <div>
                    <h4 className="font-semibold mb-2">
                      {selectedVendor.amenities ? 'Amenities' : 'Packages'}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(selectedVendor.amenities || selectedVendor.packages)!.map((x) => (
                        <Badge key={x} variant="outline">{x}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Contact</h4>
                  <div className="space-y-2">
                    {selectedVendor.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <a href={`tel:${selectedVendor.phone}`} className="text-sm hover:underline">
                          {selectedVendor.phone}
                        </a>
                      </div>
                    )}
                    {selectedVendor.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <a
                          href={`https://${selectedVendor.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm hover:underline"
                        >
                          {selectedVendor.website}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  {requestedQuotes.has(selectedVendor.id) ? (
                    <Badge variant="secondary" className="text-xs self-center">Quote Requested</Badge>
                  ) : (
                    <Button className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600" onClick={() => requestQuote(selectedVendor.id)}>
                      Request Quote
                    </Button>
                  )}
                  <Button variant="outline" className="flex-1" onClick={() => window.open(selectedVendor.website ? `https://${selectedVendor.website}` : '#', '_blank')}>
                    Visit Site
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
