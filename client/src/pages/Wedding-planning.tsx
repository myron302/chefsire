import { useState } from 'react';
import { 
  Calendar, MapPin, Users, DollarSign, Clock, Heart, 
  ChefHat, Camera, Music, Flower, Sparkles, Star,
  Filter, Search, ArrowRight, Check, Info, Phone,
  Mail, Instagram, Globe, ChevronDown, TrendingUp,
  Award, Shield, Bookmark, Share2, MessageCircle
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

export default function WeddingPlanner() {
  const [selectedVendorType, setSelectedVendorType] = useState('all');
  const [budgetRange, setBudgetRange] = useState([5000, 50000]);
  const [guestCount, setGuestCount] = useState([100]);
  const [selectedDate, setSelectedDate] = useState('');
  const [savedVendors, setSavedVendors] = useState(new Set());
  const [activeView, setActiveView] = useState('grid');
  const [showBudgetCalculator, setShowBudgetCalculator] = useState(false);

  // Sample vendor data - in production this would come from your database
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
      availability: 'Available',
      minGuests: 50,
      maxGuests: 500,
      description: 'Award-winning catering with locally sourced ingredients',
      amenities: ['Tastings', 'Custom Menus', 'Dietary Options', 'Bar Service'],
      responseTime: '2 hours'
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
    { value: 'all', label: 'All Vendors', icon: Sparkles },
    { value: 'caterer', label: 'Catering', icon: ChefHat },
    { value: 'venue', label: 'Venues', icon: MapPin },
    { value: 'photographer', label: 'Photography', icon: Camera },
    { value: 'dj', label: 'Entertainment', icon: Music },
    { value: 'florist', label: 'Florals', icon: Flower },
    { value: 'planner', label: 'Planners', icon: Heart }
  ];

  const budgetBreakdown = [
    { category: 'Catering & Bar', percentage: 40, amount: budgetRange[1] * 0.4, icon: ChefHat },
    { category: 'Venue', percentage: 20, amount: budgetRange[1] * 0.2, icon: MapPin },
    { category: 'Photography', percentage: 12, amount: budgetRange[1] * 0.12, icon: Camera },
    { category: 'Music & Entertainment', percentage: 8, amount: budgetRange[1] * 0.08, icon: Music },
    { category: 'Flowers & Decor', percentage: 10, amount: budgetRange[1] * 0.1, icon: Flower },
    { category: 'Other', percentage: 10, amount: budgetRange[1] * 0.1, icon: Sparkles }
  ];

  const toggleSaveVendor = (vendorId) => {
    setSavedVendors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(vendorId)) {
        newSet.delete(vendorId);
      } else {
        newSet.add(vendorId);
      }
      return newSet;
    });
  };

  const filteredVendors = selectedVendorType === 'all' 
    ? vendors 
    : vendors.filter(v => v.type === selectedVendorType);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header Section */}
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
            <Button variant="outline" onClick={() => setShowBudgetCalculator(!showBudgetCalculator)}>
              <DollarSign className="w-4 h-4 mr-2" />
              Budget Calculator
            </Button>
            <Button className="bg-gradient-to-r from-pink-600 to-purple-600">
              <Heart className="w-4 h-4 mr-2" />
              Start Planning
            </Button>
          </div>
        </div>

        {/* Planning Progress Bar */}
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

        {/* Budget Calculator Modal */}
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

        {/* Quick Filters */}
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
                    onChange={(e) => setGuestCount([parseInt(e.target.value)])}
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

      {/* Vendor Categories */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {vendorCategories.map((category) => {
          const Icon = category.icon;
          return (
            <Button
              key={category.value}
              variant={selectedVendorType === category.value ? 'default' : 'outline'}
              onClick={() => setSelectedVendorType(category.value)}
              className="whitespace-nowrap"
            >
              <Icon className="w-4 h-4 mr-2" />
              {category.label}
            </Button>
          );
        })}
      </div>

      {/* Results Header */}
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
          <Select defaultValue="featured">
            <SelectTrigger className="w-40">
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

      {/* Vendor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {filteredVendors.map((vendor) => (
          <Card key={vendor.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="relative">
              <img 
                src={vendor.image} 
                alt={vendor.name}
                className="w-full h-48 object-cover"
              />
              {vendor.featured && (
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

            <CardContent className="p-4">
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

              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  Responds in {vendor.responseTime}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                  <Button size="sm" className="bg-gradient-to-r from-pink-600 to-purple-600">
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Call to Action Section */}
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

      {/* Trending Venues Alert */}
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
