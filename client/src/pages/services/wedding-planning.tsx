import { useState } from 'react';
import { 
  Calendar, MapPin, Users, DollarSign, Clock, Heart, 
  ChefHat, Camera, Music, Flower, Sparkles, Star,
  Filter, Search, ArrowRight, Check, Info, Phone,
  Mail, Instagram, Globe, ChevronDown, TrendingUp,
  Award, Shield, Bookmark, Share2, MessageCircle,
  Gift, Calendar as CalendarIcon, Link2, Plus, X, BellRing,
  AlertCircle, Zap
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
import { Link } from 'wouter';

export default function WeddingPlanning() {
  const [selectedVendorType, setSelectedVendorType] = useState('all');
  const [budgetRange, setBudgetRange] = useState([5000, 50000]);
  const [guestCount, setGuestCount] = useState([100]);
  const [selectedDate, setSelectedDate] = useState('');
  const [savedVendors, setSavedVendors] = useState(new Set<number>());
  const [activeView, setActiveView] = useState('grid');
  const [showBudgetCalculator, setShowBudgetCalculator] = useState(false);
  const [showTrialBanner, setShowTrialBanner] = useState(true);
  const [requestedQuotes, setRequestedQuotes] = useState(new Set<number>());

  const [registryLinks, setRegistryLinks] = useState([
    { id: 1, name: 'Amazon', url: '', icon: '🎁' },
    { id: 2, name: 'Target', url: '', icon: '🎯' },
    { id: 3, name: 'Zola', url: '', icon: '💑' }
  ]);

  const [calendarEvents, setCalendarEvents] = useState([
    { id: 1, date: '2025-03-15', title: 'Venue Tour - Grand Ballroom', type: 'appointment', reminder: true },
    { id: 2, date: '2025-03-20', title: 'Cake Tasting', type: 'appointment', reminder: true },
    { id: 3, date: '2025-04-01', title: 'Catering Deposit Due', type: 'payment', reminder: true },
    { id: 4, date: '2025-04-15', title: 'Send Save the Dates', type: 'task', reminder: false }
  ]);

  const vendors = [
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

  const vendorCategories = [
    { value: 'all', label: 'All', icon: Sparkles },
    { value: 'caterer', label: 'Catering', icon: ChefHat },
    { value: 'venue', label: 'Venues', icon: MapPin },
    { value: 'photographer', label: 'Photo', icon: Camera },
    { value: 'dj', label: 'DJ & Music', icon: Music },
    { value: 'florist', label: 'Florist', icon: Flower },
    { value: 'planner', label: 'Planner', icon: Heart }
  ];

  const budgetBreakdown = [
    { category: 'Catering & Bar', percentage: 40, amount: budgetRange[1] * 0.4, icon: ChefHat },
    { category: 'Venue', percentage: 20, amount: budgetRange[1] * 0.2, icon: MapPin },
    { category: 'Photography', percentage: 12, amount: budgetRange[1] * 0.12, icon: Camera },
    { category: 'Music & Entertainment', percentage: 8, amount: budgetRange[1] * 0.08, icon: Music },
    { category: 'Flowers & Decor', percentage: 10, amount: budgetRange[1] * 0.1, icon: Flower },
    { category: 'Other', percentage: 10, amount: budgetRange[1] * 0.1, icon: Sparkles }
  ];

  const toggleSaveVendor = (vendorId: number) => {
    setSavedVendors(prev => {
      const next = new Set(prev);
      next.has(vendorId) ? next.delete(vendorId) : next.add(vendorId);
      return next;
    });
  };

  const requestQuote = (vendorId: number) => {
    setRequestedQuotes(prev => new Set(prev).add(vendorId));
  };

  const filteredVendors =
    selectedVendorType === 'all'
      ? vendors
      : vendors.filter(v => v.type === selectedVendorType);

  return (
    <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-8">
      {showTrialBanner && (
        <Card className="mb-4 md:mb-6 border-2 border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2 md:gap-3 flex-1">
                <div className="relative flex-shrink-0">
                  <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-purple-600" />
                  <Badge className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-green-500 text-white text-[10px] md:text-xs">FREE</Badge>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm md:text-lg">Start Your 14-Day Premium Trial</h3>
                  <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                    Unlimited vendor messaging • Priority responses • Advanced planning tools
                  </p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={() => setShowTrialBanner(false)} className="flex-shrink-0">
                  <X className="w-3 h-3 md:w-4 md:h-4" />
                </Button>
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white flex-1 sm:flex-none" size="sm">
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
            <Button className="bg-gradient-to-r from-pink-600 to-purple-600 text-white w-full sm:w-auto">
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
              {['Venue', 'Catering', 'Photo', 'Music', 'Flowers', 'Planner', 'Cake'].map((item, idx) => (
                <div key={item} className="text-center">
                  <div
                    className={`w-7 h-7 md:w-8 md:h-8 mx-auto rounded-full flex items-center justify-center mb-1 ${
                      idx < 3 ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  >
                    {idx < 3 && <Check className="w-3 h-3 md:w-4 md:h-4 text-white" />}
                  </div>
                  <span className="text-[10px] md:text-xs">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {showBudgetCalculator && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Smart Budget Calculator</CardTitle>
              <CardDescription>Optimize your wedding budget across all vendor categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Total Budget</label>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-2xl font-bold">${budgetRange[1].toLocaleString()}</span>
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

        <Card className="mb-6">
          <CardContent className="p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <div>
                <label className="text-xs md:text-sm font-medium mb-2 block">Event Date</label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs md:text-sm font-medium mb-2 block">Guest Count</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={guestCount[0]}
                    onChange={(e) => setGuestCount([parseInt(e.target.value || '0', 10)])}
                    className="w-full"
                  />
                  <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              </div>

              <div>
                <label className="text-xs md:text-sm font-medium mb-2 block">Location</label>
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
                <label className="text-xs md:text-sm font-medium mb-2 block">Style</label>
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
        {vendorCategories.map((category) => {
          const Icon = category.icon;
          const isSelected = selectedVendorType === category.value;
          const count = category.value === 'all'
            ? vendors.length
            : vendors.filter(v => v.type === category.value).length;
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
          <h2 className="text-lg md:text-xl font-semibold">{filteredVendors.length} Vendors Available</h2>
          {selectedDate && (
            <Badge variant="secondary" className="w-fit">
              <Calendar className="w-3 h-3 mr-1" />
              <span className="text-xs">{new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
          <Card key={vendor.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="relative">
              <img src={vendor.image} alt={vendor.name} className="w-full h-40 md:h-48 object-cover" />
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
                onClick={() => toggleSaveVendor(vendor.id)}
              >
                <Bookmark className={`w-3 h-3 md:w-4 md:h-4 ${savedVendors.has(vendor.id) ? 'fill-current' : ''}`} />
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
                  {(vendor as any).verified && <Shield className="w-3 h-3 md:w-4 md:h-4 text-blue-500" />}
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">{(vendor as any).description}</p>
              </div>

              <div className="flex items-center gap-3 md:gap-4 mb-2 md:mb-3">
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 md:w-4 md:h-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold text-sm md:text-base">{vendor.rating}</span>
                  <span className="text-xs md:text-sm text-muted-foreground">({vendor.reviews})</span>
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
                  <span className="hidden sm:inline">Responds in {(vendor as any).responseTime}</span>
                  <span className="sm:hidden">{(vendor as any).responseTime}</span>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  {requestedQuotes.has(vendor.id) ? (
                    <Badge variant="secondary" className="text-[10px] md:text-xs">
                      Quote Requested
                    </Badge>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => requestQuote(vendor.id)} className="flex-1 sm:flex-none text-xs">
                        <span className="hidden sm:inline">Get Quote</span>
                        <span className="sm:hidden">Quote</span>
                      </Button>
                      <Link href="/catering/wedding-map" className="flex-1 sm:flex-none">
                        <Button size="sm" className="bg-gradient-to-r from-pink-600 to-purple-600 w-full text-xs">
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
        ))}
      </div>

      <Card className="mb-8">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Gift className="w-4 h-4 md:w-5 md:h-5" />
            Gift Registry Hub
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">Manage all your registries in one place and share with guests</CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="space-y-3 md:space-y-4">
            {registryLinks.map((registry) => (
              <div key={registry.id} className="flex items-center gap-2 md:gap-3">
                <span className="text-xl md:text-2xl flex-shrink-0">{registry.icon}</span>
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder={`${registry.name} Registry URL`}
                    value={registry.url}
                    onChange={(e) => {
                      setRegistryLinks(prev =>
                        prev.map(r => (r.id === registry.id ? { ...r, url: e.target.value } : r))
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

            <Button variant="outline" className="w-full text-sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Another Registry
            </Button>

            <div className="border-t pt-4 mt-4 md:mt-6">
              <h4 className="font-medium mb-3 text-sm md:text-base">Share Your Registries</h4>
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                <Button variant="outline" size="sm" className="text-xs">
                  <Share2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">Facebook</span>
                  <span className="sm:hidden">FB</span>
                </Button>
                <Button variant="outline" size="sm" className="text-xs">
                  <Share2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">Instagram</span>
                  <span className="sm:hidden">IG</span>
                </Button>
                <Button variant="outline" size="sm" className="text-xs">
                  <Mail className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Email
                </Button>
                <Button variant="outline" size="sm" className="text-xs">
                  <Link2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">Copy Link</span>
                  <span className="sm:hidden">Copy</span>
                </Button>
              </div>

              <Alert className="mt-4">
                <Info className="h-3 w-3 md:h-4 md:w-4" />
                <AlertDescription className="text-xs md:text-sm break-all">
                  Your unique registry page: <strong>chefsire.com/registry/sarah-john-2025</strong>
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
          <CardDescription className="text-xs md:text-sm">Track important dates, appointments, and deadlines</CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div>
              <h4 className="font-medium mb-3 text-sm md:text-base">Upcoming Events</h4>
              <div className="space-y-2">
                {calendarEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-2 md:gap-3 p-2 md:p-3 bg-muted rounded-lg">
                    <div className="text-center min-w-[40px] md:min-w-[50px]">
                      <div className="text-[10px] md:text-xs text-muted-foreground">
                        {new Date(event.date).toLocaleDateString('en-US', { month: 'short' })}
                      </div>
                      <div className="text-base md:text-lg font-bold">{new Date(event.date).getDate()}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs md:text-sm truncate">{event.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant={
                            event.type === 'payment' ? 'destructive' : event.type === 'appointment' ? 'default' : 'secondary'
                          }
                          className="text-[10px] md:text-xs"
                        >
                          {event.type}
                        </Badge>
                        {event.reminder && <BellRing className="w-3 h-3 text-muted-foreground" />}
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
                <Textarea placeholder="Notes (optional)" className="h-16 md:h-20 text-sm" />
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="reminder" className="rounded" />
                  <label htmlFor="reminder" className="text-xs md:text-sm">Set reminder</label>
                </div>
                <Button className="w-full text-sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Calendar
                </Button>
              </div>
            </div>
          </div>

          <Alert className="mt-6">
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              <strong>Pro tip:</strong> Most couples book venues 10-12 months before their wedding date.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950 dark:to-purple-950 border-pink-200 dark:border-pink-800">
        <CardContent className="p-8 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-pink-600" />
          <h3 className="text-2xl font-bold mb-2">Are You a Wedding Vendor?</h3>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Join ChefSire's wedding marketplace and connect with thousands of engaged couples. 
            Get more bookings, manage your calendar, and grow your business.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" variant="outline">Learn More</Button>
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
    </div>
  );
}
